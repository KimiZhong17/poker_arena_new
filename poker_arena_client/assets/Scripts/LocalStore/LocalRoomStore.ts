import { PlayerInfo } from '../Core/Player';
import { NetworkClient } from '../Network/NetworkClient';
import { PlayerJoinedEvent, PlayerLeftEvent, PlayerReadyEvent } from '../Network/Messages';

/**
 * Room state enumeration
 */
export enum RoomState {
    WAITING = "waiting",     // Waiting for players
    READY = "ready",         // All players ready
    PLAYING = "playing",     // Game in progress
    FINISHED = "finished"    // Game finished
}

/**
 * Room data structure
 */
export interface RoomData {
    id: string;
    name: string;
    gameModeId: string;
    state: RoomState;
    hostId: string;
    players: PlayerInfo[];
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
    createdAt: number;
}

/**
 * RoomStateStore - 在线模式房间状态存储
 *
 * 职责：
 * - 保存当前房间信息（从服务器接收）
 * - 更新玩家准备状态（从服务器同步）
 * - 提供房间查询接口（给 ReadyStage 等使用）
 *
 * 注意：
 * - 房间的创建、加入、离开等操作都在服务器端处理
 * - 客户端只负责保存服务器返回的房间状态
 * - 不要在这里实现房间逻辑，所有逻辑都在服务器端
 */
export class LocalRoomStore {
    private static instance: LocalRoomStore;
    private currentRoom: RoomData | null = null;

    private constructor() {}

    public static getInstance(): LocalRoomStore {
        if (!LocalRoomStore.instance) {
            LocalRoomStore.instance = new LocalRoomStore();
        }
        return LocalRoomStore.instance;
    }

    /**
     * 设置当前房间（从服务器接收的房间数据）
     */
    public setCurrentRoom(roomData: RoomData): void {
        this.currentRoom = roomData;
        console.log('[RoomStateStore] Current room set:', roomData);
    }

    /**
     * 获取当前房间
     */
    public getCurrentRoom(): RoomData | null {
        return this.currentRoom;
    }

    /**
     * 更新玩家准备状态（从服务器同步）
     * @param playerId 玩家ID
     * @param isReady 是否准备
     */
    public updatePlayerReady(playerId: string, isReady: boolean): void {
        if (!this.currentRoom) {
            console.warn('[RoomStateStore] No current room, cannot update player ready');
            return;
        }

        const player = this.currentRoom.players.find(p => p.id === playerId);
        if (player) {
            player.isReady = isReady;
            console.log(`[RoomStateStore] Player ${playerId} ready: ${isReady}`);
        }
    }

    /**
     * 添加玩家到当前房间（从服务器同步）
     * @param playerInfo 玩家信息
     */
    public addPlayer(playerInfo: PlayerInfo): void {
        if (!this.currentRoom) {
            console.warn('[RoomStateStore] No current room, cannot add player');
            return;
        }

        // 检查玩家是否已存在
        const existingPlayer = this.currentRoom.players.find(p => p.id === playerInfo.id);
        if (existingPlayer) {
            console.warn(`[RoomStateStore] Player ${playerInfo.id} already in room`);
            return;
        }

        this.currentRoom.players.push(playerInfo);
        console.log(`[RoomStateStore] Player ${playerInfo.name} joined room`);
    }

    /**
     * 移除玩家（从服务器同步）
     * @param playerId 玩家ID
     */
    public removePlayer(playerId: string): void {
        if (!this.currentRoom) {
            console.warn('[RoomStateStore] No current room, cannot remove player');
            return;
        }

        const index = this.currentRoom.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            const playerName = this.currentRoom.players[index].name;
            this.currentRoom.players.splice(index, 1);
            console.log(`[RoomStateStore] Player ${playerName} left room`);
        }
    }

    /**
     * 更新房间状态（从服务器同步）
     * @param state 房间状态
     */
    public updateRoomState(state: RoomState): void {
        if (!this.currentRoom) {
            console.warn('[RoomStateStore] No current room, cannot update state');
            return;
        }

        this.currentRoom.state = state;
        console.log(`[RoomStateStore] Room state updated: ${state}`);
    }

    /**
     * 清空当前房间（离开房间或游戏结束时调用）
     */
    public clearCurrentRoom(): void {
        this.currentRoom = null;
        console.log('[RoomStateStore] Current room cleared');
    }

    /**
     * 检查玩家是否在房间中
     * @param playerId 玩家ID
     */
    public isPlayerInRoom(playerId: string): boolean {
        if (!this.currentRoom) return false;
        return this.currentRoom.players.some(p => p.id === playerId);
    }

    /**
     * 获取房间内玩家数量
     */
    public getPlayerCount(): number {
        if (!this.currentRoom) return 0;
        return this.currentRoom.players.length;
    }

    // ==================== 辅助方法：绑定网络事件 ====================

    /**
     * 绑定 NetworkClient 的房间相关事件
     * 自动同步服务器的房间状态变化
     *
     * 使用方法：
     * ```typescript
     * const roomStore = RoomStateStore.getInstance();
     * const networkClient = NetworkManager.getInstance().getClient();
     * roomStore.bindNetworkEvents(networkClient);
     * ```
     *
     * @param networkClient NetworkClient 实例
     */
    public bindNetworkEvents(networkClient: NetworkClient): void {
        // 玩家加入房间
        networkClient.on('player_joined', (data: PlayerJoinedEvent) => {
            console.log('[RoomStateStore] Auto-sync: Player joined', data.player);
            this.addPlayer(data.player);
        });

        // 玩家离开房间
        networkClient.on('player_left', (data: PlayerLeftEvent) => {
            console.log('[RoomStateStore] Auto-sync: Player left', data.playerId);
            this.removePlayer(data.playerId);
        });

        // 玩家准备状态变化
        networkClient.on('player_ready', (data: PlayerReadyEvent) => {
            console.log('[RoomStateStore] Auto-sync: Player ready', data);
            this.updatePlayerReady(data.playerId, data.isReady);
        });

        console.log('[RoomStateStore] Network events bound for auto-sync');
    }

    /**
     * 解绑网络事件
     * @param networkClient NetworkClient 实例
     */
    public unbindNetworkEvents(networkClient: NetworkClient): void {
        // 移除所有监听器
        networkClient.off('player_joined', this.addPlayer);
        networkClient.off('player_left', this.removePlayer);
        networkClient.off('player_ready', this.updatePlayerReady);

        console.log('[RoomStateStore] Network events unbound');
    }
}
