import { NetworkClient } from '../Network/NetworkClient';
import { LocalUserStore } from '../LocalStore/LocalUserStore';
import { LocalRoomStore, RoomState } from '../LocalStore/LocalRoomStore';
import { 
    ClientMessageType, 
    RoomJoinedEvent, 
    ServerMessageType, 
    PlayerReadyEvent, 
    PlayerLeftEvent,
    PlayerJoinedEvent 
} from '../Network/Messages';
import { NetworkManager } from '../Network/NetworkManager';
import { EventCenter, GameEvents } from '../Utils/EventCenter';

export class RoomService {
    private static instance: RoomService;
    private localUserStore: LocalUserStore;
    private localRoomStore: LocalRoomStore;
    private serverUrl: string = 'http://localhost:3000'; 

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
     * 初始化网络监听
     * 使用具名函数进行绑定，以便符合双参数 off(event, handler) 的要求
     */
    private initNetworkListeners(): void {
        const net = NetworkManager.getInstance().getClient(this.serverUrl);

        // --- 先解绑，防止重复 ---
        net.off(ServerMessageType.ROOM_JOINED, this.onRoomJoined);
        net.off(ServerMessageType.PLAYER_JOINED, this.onPlayerJoined);
        net.off(ServerMessageType.PLAYER_READY, this.onPlayerReady);
        net.off(ServerMessageType.PLAYER_LEFT, this.onPlayerLeft);
        net.off(ServerMessageType.ERROR, this.onError);

        // --- 再绑定 ---
        // 注意：这里使用 .bind(this) 确保函数内部的 this 指向 RoomService 实例
        // 或者将成员函数定义为箭头函数（推荐，如下面定义所示）
        net.on(ServerMessageType.ROOM_JOINED, this.onRoomJoined);
        net.on(ServerMessageType.PLAYER_JOINED, this.onPlayerJoined);
        net.on(ServerMessageType.PLAYER_READY, this.onPlayerReady);
        net.on(ServerMessageType.PLAYER_LEFT, this.onPlayerLeft);
        net.on(ServerMessageType.ERROR, this.onError);
    }

    // ==================== 具名处理器 (解决 off 参数匹配问题) ====================

    private onRoomJoined = (data: RoomJoinedEvent) => {
        console.log('[RoomService] Self joined room:', data.roomId);

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

    private onError = (data: any) => {
        console.error('[RoomService] Error from server:', data);
        alert(`服务器错误: ${data.message || data.code || '未知错误'}`);
    };

    // ==================== 基础逻辑与业务接口 ====================

    private handleLocalLeave(): void {
        // 1. 清空 Store（clearCurrentRoom 会同时清空 myPlayerIdInRoom）
        this.localRoomStore.clearCurrentRoom();

        // 2. 发出事件通知 UI (可能需要导航回大厅)
        EventCenter.emit(GameEvents.UI_REFRESH_ROOM);
    }

    private getNetworkClient(): NetworkClient | null {
        const client = NetworkManager.getInstance().getClient(this.serverUrl);
        if (!client || !client.getIsConnected()) return null;
        return client;
    }

    public createRoom(gameMode: string, maxPlayers: number): void {
        const client = this.getNetworkClient();
        if (client) client.send(ClientMessageType.CREATE_ROOM, { 
            playerName: this.localUserStore.getUsername(), 
            gameMode: gameMode as 'the_decree', 
            maxPlayers 
        });
    }

    public joinRoom(roomId: string): void {
        const client = this.getNetworkClient();
        if (client) client.send(ClientMessageType.JOIN_ROOM, { 
            roomId, 
            playerName: this.localUserStore.getUsername() 
        });
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

    public isHost(): boolean {
        return this.localRoomStore.isMyPlayerHost();
    }

    public getCurrentRoomId(): string | null {
        return this.localRoomStore.getCurrentRoom()?.id || null;
    }
}