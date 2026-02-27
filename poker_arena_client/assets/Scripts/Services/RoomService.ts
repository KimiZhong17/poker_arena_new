import { NetworkClient } from '../Network/NetworkClient';
import { LocalUserStore } from '../LocalStore/LocalUserStore';
import { LocalRoomStore, RoomState } from '../LocalStore/LocalRoomStore';
import { LocalGameStore } from '../LocalStore/LocalGameStore';
import {
    ClientMessageType,
    RoomJoinedEvent,
    ReconnectSuccessEvent,
    ServerMessageType,
    PlayerReadyEvent,
    PlayerLeftEvent,
    PlayerJoinedEvent,
    HostChangedEvent
} from '../Network/Messages';
import { NetworkManager } from '../Network/NetworkManager';
import { NetworkConfig } from '../Config/NetworkConfig';
import { EventCenter, GameEvents } from '../Utils/EventCenter';
import { logger } from '../Utils/Logger';

const log = logger('RoomService');

export class RoomService {
    private static instance: RoomService;
    private localUserStore: LocalUserStore;
    private localRoomStore: LocalRoomStore;

    /** 标记当前是否正在进行自动重连（区别于手动加入房间） */
    private _isAutoReconnecting: boolean = false;

    public get isAutoReconnecting(): boolean {
        return this._isAutoReconnecting;
    }

    private constructor() {
        this.localUserStore = LocalUserStore.getInstance();
        this.localRoomStore = LocalRoomStore.getInstance();
        this.initNetworkListeners();
    }

    public static getInstance(): RoomService {
        if (!RoomService.instance) {
            RoomService.instance = new RoomService();
        }
        return RoomService.instance;
    }

    /**
     * 检查是否有保存的重连信息，如果有则尝试重连
     * 应该在客户端启动并连接到服务器后调用
     * @returns 是否有重连信息并尝试重连
     */
    public tryAutoReconnect(): boolean {
        const reconnectInfo = this.localRoomStore.getReconnectInfo();
        if (reconnectInfo) {
            log.debug('Found reconnect info, attempting to reconnect:', reconnectInfo);
            this._isAutoReconnecting = true;
            this.reconnectToRoom(reconnectInfo.roomId, reconnectInfo.myPlayerId);
            return true;
        }
        return false;
    }

    /**
     * 检查是否有待重连的房间
     */
    public hasPendingReconnect(): boolean {
        return this.localRoomStore.getReconnectInfo() !== null;
    }

    /**
     * 初始化网络监听
     * 使用具名函数进行绑定,以便符合双参数 off(event, handler) 的要求
     */
    private initNetworkListeners(): void {
        const net = NetworkManager.getInstance().getClient(NetworkConfig.getServerUrl());

        // --- 先解绑，防止重复 ---
        net.off(ServerMessageType.ROOM_JOINED, this.onRoomJoined);
        net.off(ServerMessageType.RECONNECT_SUCCESS, this.onReconnectSuccess);
        net.off(ServerMessageType.PLAYER_JOINED, this.onPlayerJoined);
        net.off(ServerMessageType.PLAYER_READY, this.onPlayerReady);
        net.off(ServerMessageType.PLAYER_LEFT, this.onPlayerLeft);
        net.off(ServerMessageType.HOST_CHANGED, this.onHostChanged);
        net.off(ServerMessageType.ERROR, this.onError);

        // --- 再绑定 ---
        // 注意：这里使用 .bind(this) 确保函数内部的 this 指向 RoomService 实例
        // 或者将成员函数定义为箭头函数（推荐，如下面定义所示）
        net.on(ServerMessageType.ROOM_JOINED, this.onRoomJoined);
        net.on(ServerMessageType.RECONNECT_SUCCESS, this.onReconnectSuccess);
        net.on(ServerMessageType.PLAYER_JOINED, this.onPlayerJoined);
        net.on(ServerMessageType.PLAYER_READY, this.onPlayerReady);
        net.on(ServerMessageType.PLAYER_LEFT, this.onPlayerLeft);
        net.on(ServerMessageType.HOST_CHANGED, this.onHostChanged);
        net.on(ServerMessageType.ERROR, this.onError);

        // 设置 socket 重连回调
        net.setOnReconnect(() => {
            this.handleSocketReconnect();
        });
    }

    // ==================== 具名处理器 (解决 off 参数匹配问题) ====================

    private onRoomJoined = (data: RoomJoinedEvent) => {
        log.debug('Self joined room:', data.roomId);

        // 1. 存入 LocalRoomStore
        this.localRoomStore.setCurrentRoom({
            id: data.roomId,
            name: `Room ${data.roomId}`,
            gameModeId: 'the_decree',
            state: RoomState.WAITING,
            players: data.players,
            hostId: data.hostId,
            maxPlayers: 4,
            isPrivate: false,
            createdAt: Date.now()
        });

        // 2. 存储当前用户在房间内的玩家ID
        this.localRoomStore.setMyPlayerId(data.myPlayerIdInRoom);

        // 3. 发出事件通知 UI
        EventCenter.emit(GameEvents.UI_NAVIGATE_TO_GAME);
    };

    private onPlayerJoined = (data: PlayerJoinedEvent) => {
        this.localRoomStore.addPlayer(data.player);
        EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
    };

    private onPlayerReady = (data: PlayerReadyEvent) => {
        this.localRoomStore.updatePlayerReady(data.playerId, data.isReady);
        EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
    };

    private onPlayerLeft = (data: PlayerLeftEvent) => {
        const myRoomId = this.localRoomStore.getMyPlayerId();
        if (data.playerId === myRoomId) {
            this.handleLocalLeave();
        } else {
            this.localRoomStore.removePlayer(data.playerId);
            EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
        }
    };

    private onHostChanged = (data: HostChangedEvent) => {
        log.debug('Host changed to:', data.newHostId);
        this.localRoomStore.updateHostId(data.newHostId);
        EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
    };

    private onError = (data: any) => {
        // 自动重连时，如果房间不存在，静默处理：清除重连信息，不弹窗
        if (this._isAutoReconnecting) {
            const errorCode = data.code || '';
            if (errorCode === 'ROOM_NOT_FOUND' || errorCode === 'INVALID_PLAY' || errorCode === 'INTERNAL_ERROR') {
                log.debug('Auto-reconnect failed (room unavailable), clearing reconnect info silently');
                this.localRoomStore.clearReconnectInfo();
                this._isAutoReconnecting = false;
                EventCenter.emit(GameEvents.AUTO_RECONNECT_FAILED);
                return;
            }
            this._isAutoReconnecting = false;
        }
        log.error('Error from server:', data);
        alert(`服务器错误: ${data.message || data.code || '未知错误'}`);
    };

    /**
     * 重连成功处理
     */
    private onReconnectSuccess = (data: ReconnectSuccessEvent) => {
        this._isAutoReconnecting = false;
        log.debug('Reconnect success:', data.roomId);

        // 1. 存入 LocalRoomStore
        this.localRoomStore.setCurrentRoom({
            id: data.roomId,
            name: `Room ${data.roomId}`,
            gameModeId: 'the_decree',
            state: RoomState.PLAYING,  // 重连时房间一定是游戏中
            players: data.players,
            hostId: data.hostId,
            maxPlayers: data.maxPlayers,
            isPrivate: false,
            createdAt: Date.now()
        });

        // 2. 存储当前用户在房间内的玩家ID
        this.localRoomStore.setMyPlayerId(data.myPlayerIdInRoom);

        // 3. 恢复游戏状态到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.resetGame();
        gameStore.setGameActive(true);
        gameStore.initializePlayers(
            data.players.map(player => player.id),
            data.myPlayerIdInRoom
        );
        gameStore.setHandCards(data.handCards);
        gameStore.setCommunityCards(data.communityCards);
        gameStore.setGameState(data.gameState);
        gameStore.setRoundNumber(data.roundNumber);
        gameStore.setDeckSize(data.deckSize);
        if (data.dealerId) {
            gameStore.setDealerId(data.dealerId);
        }
        if (data.cardsToPlay) {
            gameStore.setCardsToPlay(data.cardsToPlay);
        }
        gameStore.setScores(data.scores);

        // 4. 恢复各玩家游戏状态
        for (const playerState of data.playerGameStates) {
            gameStore.setPlayerGameState(playerState.playerId, {
                handCardCount: playerState.handCardCount,
                hasPlayed: playerState.hasPlayed,
                playedCardCount: playerState.playedCardCount,
                isAuto: playerState.isAuto
            });
        }

        // 5. 发出事件通知 UI 刷新
        EventCenter.emit(GameEvents.UI_NAVIGATE_TO_GAME);
        EventCenter.emit(GameEvents.GAME_RECONNECTED, data);
    };

    /**
     * Socket 重连后自动尝试重连房间
     */
    private handleSocketReconnect(): void {
        const reconnectInfo = this.localRoomStore.getReconnectInfo();
        if (reconnectInfo) {
            log.debug('Socket reconnected, attempting to rejoin room:', reconnectInfo);
            this._isAutoReconnecting = true;
            this.reconnectToRoom(reconnectInfo.roomId, reconnectInfo.myPlayerId);
        }
    }

    // ==================== 基础逻辑与业务接口 ====================

    private handleLocalLeave(): void {
        // 1. 清空 Store（clearCurrentRoom 会同时清空 myPlayerIdInRoom）
        this.localRoomStore.clearCurrentRoom();

        // 2. 清空游戏状态
        LocalGameStore.getInstance().clear();

        // 3. 发出事件通知 UI (可能需要导航回大厅)
        EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
    }

    private getNetworkClient(): NetworkClient | null {
        const client = NetworkManager.getInstance().getClient(NetworkConfig.getServerUrl());
        if (!client || !client.getIsConnected()) return null;
        return client;
    }

    public createRoom(gameMode: string, maxPlayers: number): void {
        const client = this.getNetworkClient();
        const playerName = this.localUserStore.getNickname();  // 使用昵称而不是用户名
        const guestId = this.localUserStore.getGuestId();  // 获取持久化的游客ID
        log.debug(`Creating room with playerName: ${playerName}, guestId: ${guestId}`);
        if (client) client.send(ClientMessageType.CREATE_ROOM, {
            playerName: playerName,
            guestId: guestId || undefined,
            gameMode: gameMode as 'the_decree',
            maxPlayers
        });
    }

    public joinRoom(roomId: string): void {
        const client = this.getNetworkClient();
        const guestId = this.localUserStore.getGuestId();
        if (client) client.send(ClientMessageType.JOIN_ROOM, {
            roomId,
            playerName: this.localUserStore.getNickname(),
            guestId: guestId || undefined
        });
    }

    public reconnectToRoom(roomId: string, playerId: string): void {
        const client = this.getNetworkClient();
        const guestId = this.localUserStore.getGuestId();
        if (client) {
            log.debug(`Attempting to reconnect to room ${roomId} with guestId: ${guestId}, playerId: ${playerId}`);
            client.send(ClientMessageType.RECONNECT, {
                roomId,
                playerId,
                guestId: guestId || undefined,
                playerName: this.localUserStore.getNickname()
            });
        }
    }

    public leaveRoom(): void {
        const client = this.getNetworkClient();
        if (client) client.send(ClientMessageType.LEAVE_ROOM, {});
        this.handleLocalLeave();
    }

    public toggleReady(): void {
        const client = this.getNetworkClient();
        if (client) client.send(ClientMessageType.READY, {});
    }

    public startGame(): void {
        const client = this.getNetworkClient();
        if (client && this.isHost()) {
            client.send(ClientMessageType.START_GAME, { roomId: this.getCurrentRoomId() || "" });
        }
    }

    public restartGame(): void {
        const client = this.getNetworkClient();
        if (client) {
            // 任何玩家都可以点击重启
            client.send(ClientMessageType.RESTART_GAME, { roomId: this.getCurrentRoomId() || "" });
        }
    }

    public isHost(): boolean {
        return this.localRoomStore.isMyPlayerHost();
    }

    public getCurrentRoomId(): string | null {
        return this.localRoomStore.getCurrentRoom()?.id || null;
    }
}
