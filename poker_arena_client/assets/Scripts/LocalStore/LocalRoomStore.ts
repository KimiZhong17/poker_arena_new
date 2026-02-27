import { PlayerInfo } from './LocalPlayerStore';
import { logger } from '../Utils/Logger';

const log = logger('LocalRoomStore');

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
    private myPlayerIdInRoom: string | null = null;  // 当前用户在房间内的玩家ID（服务器分配）

    private constructor() {
        // 启动时尝试从localStorage加载房间信息
        this.loadRoomFromStorage();
    }

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
        log.debug('[RoomStateStore] Current room set:', roomData);

        // 保存到localStorage以便断线重连
        this.saveRoomToStorage();
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
            log.warn('[RoomStateStore] No current room, cannot update player ready');
            return;
        }

        const player = this.currentRoom.players.find(p => p.id === playerId);
        if (player) {
            player.isReady = isReady;
            log.debug(`[RoomStateStore] Player ${playerId} ready: ${isReady}`);
        }
    }

    /**
     * 添加玩家到当前房间（从服务器同步）
     * @param playerInfo 玩家信息
     */
    public addPlayer(playerInfo: PlayerInfo): void {
        if (!this.currentRoom) {
            log.warn('[RoomStateStore] No current room, cannot add player');
            return;
        }

        // 检查玩家是否已存在
        const existingPlayer = this.currentRoom.players.find(p => p.id === playerInfo.id);
        if (existingPlayer) {
            log.warn(`[RoomStateStore] Player ${playerInfo.id} already in room`);
            return;
        }

        this.currentRoom.players.push(playerInfo);
        log.debug(`[RoomStateStore] Player ${playerInfo.name} joined room`);
    }

    /**
     * 移除玩家（从服务器同步）
     * @param playerId 玩家ID
     */
    public removePlayer(playerId: string): void {
        if (!this.currentRoom) {
            log.warn('[RoomStateStore] No current room, cannot remove player');
            return;
        }

        const index = this.currentRoom.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            const playerName = this.currentRoom.players[index].name;
            this.currentRoom.players.splice(index, 1);
            log.debug(`[RoomStateStore] Player ${playerName} left room`);
        }
    }

    /**
     * 更新房间状态（从服务器同步）
     * @param state 房间状态
     */
    public updateRoomState(state: RoomState): void {
        if (!this.currentRoom) {
            log.warn('[RoomStateStore] No current room, cannot update state');
            return;
        }

        this.currentRoom.state = state;
        log.debug(`[RoomStateStore] Room state updated: ${state}`);

        // 保存到localStorage以便断线重连
        this.saveRoomToStorage();
    }

    /**
     * 更新房主ID（从服务器同步）
     * @param newHostId 新房主ID
     */
    public updateHostId(newHostId: string): void {
        if (!this.currentRoom) {
            log.warn('[RoomStateStore] No current room, cannot update host');
            return;
        }

        // 更新旧房主的 isHost 状态
        const oldHost = this.currentRoom.players.find(p => p.id === this.currentRoom!.hostId);
        if (oldHost) {
            oldHost.isHost = false;
        }

        // 更新新房主的 isHost 状态和准备状态
        const newHost = this.currentRoom.players.find(p => p.id === newHostId);
        if (newHost) {
            newHost.isHost = true;
            newHost.isReady = true; // 新房主自动准备
        }

        this.currentRoom.hostId = newHostId;
        log.debug(`[RoomStateStore] Host updated to: ${newHostId}`);
    }

    /**
     * 清空当前房间（离开房间或游戏结束时调用）
     */
    public clearCurrentRoom(): void {
        this.currentRoom = null;
        this.myPlayerIdInRoom = null;  // 同时清空玩家ID
        log.debug('[RoomStateStore] Current room cleared');

        // 清除localStorage中的房间信息
        this.clearRoomFromStorage();
    }

    // ==================== 当前用户玩家ID管理 ====================

    /**
     * 设置当前用户在房间内的玩家ID（服务器分配）
     * 当加入/创建房间成功时调用
     */
    public setMyPlayerId(playerId: string): void {
        this.myPlayerIdInRoom = playerId;
        log.debug(`My player ID set: ${playerId}`);

        // 保存到localStorage以便断线重连
        this.saveRoomToStorage();
    }

    /**
     * 获取当前用户在房间内的玩家ID
     * 如果不在房间内，返回 null
     */
    public getMyPlayerId(): string | null {
        return this.myPlayerIdInRoom;
    }

    /**
     * 清除当前用户的房间玩家ID
     * 当离开房间时调用
     */
    public clearMyPlayerId(): void {
        this.myPlayerIdInRoom = null;
        log.debug('My player ID cleared');
    }

    /**
     * 获取当前用户在房间中的玩家信息
     * 如果不在房间内或找不到，返回 null
     */
    public getMyPlayerInfo(): PlayerInfo | null {
        if (!this.currentRoom || !this.myPlayerIdInRoom) {
            return null;
        }
        return this.currentRoom.players.find(p => p.id === this.myPlayerIdInRoom) || null;
    }

    /**
     * 检查当前用户是否是房主
     */
    public isMyPlayerHost(): boolean {
        return this.currentRoom?.hostId === this.myPlayerIdInRoom;
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

    // ==================== 本地存储（用于断线重连） ====================

    /**
     * 保存房间信息到localStorage
     * 只在游戏进行中（PLAYING状态）时保存，以便断线重连
     */
    private saveRoomToStorage(): void {
        if (!this.currentRoom) return;

        // 只在游戏进行中时保存房间信息
        if (this.currentRoom.state !== RoomState.PLAYING) {
            log.debug('Room not in PLAYING state, skip saving to storage');
            return;
        }

        try {
            const roomInfo = {
                roomId: this.currentRoom.id,
                myPlayerId: this.myPlayerIdInRoom,
                state: this.currentRoom.state,
                savedAt: Date.now()
            };

            localStorage.setItem('poker_arena_reconnect_room', JSON.stringify(roomInfo));
            log.debug('Room info saved to storage for reconnection:', roomInfo);
        } catch (error) {
            log.error('Failed to save room to storage:', error);
        }
    }

    /**
     * 从localStorage加载房间信息
     * 用于断线重连
     */
    private loadRoomFromStorage(): void {
        try {
            const roomInfoStr = localStorage.getItem('poker_arena_reconnect_room');
            if (!roomInfoStr) return;

            const roomInfo = JSON.parse(roomInfoStr);

            // 检查保存时间，超过5分钟的数据视为过期
            const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5分钟
            if (Date.now() - roomInfo.savedAt > RECONNECT_TIMEOUT) {
                log.debug('Reconnect data expired, clearing...');
                this.clearRoomFromStorage();
                return;
            }

            // 只恢复基本信息，完整信息需要从服务器获取
            log.debug('Found reconnect data:', roomInfo);
            // 注意：这里不直接设置currentRoom，而是在重连成功后由服务器返回完整数据
        } catch (error) {
            log.error('Failed to load room from storage:', error);
        }
    }

    /**
     * 清除localStorage中的房间信息
     */
    private clearRoomFromStorage(): void {
        try {
            localStorage.removeItem('poker_arena_reconnect_room');
            log.debug('Room info cleared from storage');
        } catch (error) {
            log.error('Failed to clear room from storage:', error);
        }
    }

    /**
     * 公开方法：清除重连信息
     * 用于自动重连失败时静默清理
     */
    public clearReconnectInfo(): void {
        this.clearRoomFromStorage();
    }

    /**
     * 获取保存的重连信息
     * 用于判断是否需要重连
     */
    public getReconnectInfo(): { roomId: string; myPlayerId: string; state: RoomState } | null {
        try {
            const roomInfoStr = localStorage.getItem('poker_arena_reconnect_room');
            if (!roomInfoStr) return null;

            const roomInfo = JSON.parse(roomInfoStr);

            // 检查保存时间
            const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5分钟
            if (Date.now() - roomInfo.savedAt > RECONNECT_TIMEOUT) {
                log.debug('Reconnect data expired');
                this.clearRoomFromStorage();
                return null;
            }

            return {
                roomId: roomInfo.roomId,
                myPlayerId: roomInfo.myPlayerId,
                state: roomInfo.state
            };
        } catch (error) {
            log.error('Failed to get reconnect info:', error);
            return null;
        }
    }

    // ==================== 注意 ====================
    //
    // ❌ 旧架构：LocalRoomStore 直接监听 NetworkClient
    // ✅ 新架构：RoomService 监听 NetworkClient，处理后存入 LocalRoomStore
    //
    // 数据流：
    // NetworkClient (生肉)
    //   → RoomService (煮肉)
    //   → LocalRoomStore (碗)
    //   → EventCenter.emit(GameEvents) (喊"开饭了")
    //   → UI (吃饭)
    //
    // 已移除 bindNetworkEvents / unbindNetworkEvents 方法
}
