import { v4 as uuidv4 } from 'uuid';
import { PlayerSession } from './PlayerSession';
import { ServerMessageType } from '../types/Messages';

/**
 * 房间状态
 */
export enum RoomState {
    WAITING = 'waiting',      // 等待玩家
    READY = 'ready',          // 准备开始
    PLAYING = 'playing',      // 游戏中
    FINISHED = 'finished'     // 已结束
}

/**
 * 游戏房间
 * 管理一局游戏的所有玩家和游戏状态
 */
export class GameRoom {
    public id: string;
    public gameMode: string;
    public maxPlayers: number;
    public state: RoomState = RoomState.WAITING;

    private players: Map<string, PlayerSession> = new Map();
    private hostId: string = '';
    private createdAt: number = Date.now();
    private lastActivityAt: number = Date.now();

    // 游戏相关（将来会被 TheDecreeGameMode 替代）
    private gameState: any = null;

    constructor(gameMode: string, maxPlayers: number) {
        this.id = uuidv4().substring(0, 8);
        this.gameMode = gameMode;
        this.maxPlayers = maxPlayers;
    }

    /**
     * 添加玩家到房间
     */
    public addPlayer(player: PlayerSession): boolean {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        player.roomId = this.id;
        player.seatIndex = this.players.size;

        // 第一个玩家是房主
        if (this.players.size === 0) {
            this.hostId = player.id;
            player.isHost = true;
        }

        this.players.set(player.id, player);
        this.updateActivity();

        console.log(`[Room ${this.id}] Player ${player.name} joined (${this.players.size}/${this.maxPlayers})`);

        return true;
    }

    /**
     * 移除玩家
     */
    public removePlayer(playerId: string): PlayerSession | null {
        const player = this.players.get(playerId);
        if (!player) return null;

        this.players.delete(playerId);
        player.roomId = null;

        console.log(`[Room ${this.id}] Player ${player.name} left (${this.players.size}/${this.maxPlayers})`);

        // 如果房主离开，转移房主权限
        if (this.hostId === playerId && this.players.size > 0) {
            const newHost = Array.from(this.players.values())[0];
            newHost.isHost = true;
            this.hostId = newHost.id;
            console.log(`[Room ${this.id}] Host transferred to ${newHost.name}`);
        }

        this.updateActivity();

        return player;
    }

    /**
     * 获取玩家
     */
    public getPlayer(playerId: string): PlayerSession | undefined {
        return this.players.get(playerId);
    }

    /**
     * 获取所有玩家
     */
    public getAllPlayers(): PlayerSession[] {
        return Array.from(this.players.values());
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this.players.size;
    }

    /**
     * 检查房间是否为空
     */
    public isEmpty(): boolean {
        return this.players.size === 0;
    }

    /**
     * 检查房间是否已满
     */
    public isFull(): boolean {
        return this.players.size >= this.maxPlayers;
    }

    /**
     * 设置玩家准备状态
     */
    public setPlayerReady(playerId: string, isReady: boolean): boolean {
        const player = this.players.get(playerId);
        if (!player) return false;

        player.isReady = isReady;
        this.updateActivity();

        return true;
    }

    /**
     * 检查所有玩家是否都准备好
     */
    public isAllPlayersReady(): boolean {
        if (this.players.size < 2) return false;

        for (const player of this.players.values()) {
            if (!player.isReady) return false;
        }

        return true;
    }

    /**
     * 广播消息给房间内所有玩家
     */
    public broadcast(event: string, data: any, excludePlayerId?: string): void {
        for (const player of this.players.values()) {
            if (excludePlayerId && player.id === excludePlayerId) {
                continue;
            }
            player.emit(event, data);
        }
    }

    /**
     * 发送消息给单个玩家
     */
    public sendToPlayer(playerId: string, event: string, data: any): void {
        const player = this.players.get(playerId);
        if (player) {
            player.emit(event, data);
        }
    }

    /**
     * 获取所有玩家信息（用于广播）
     */
    public getPlayersInfo() {
        return Array.from(this.players.values()).map(p => p.getInfo());
    }

    /**
     * 更新活动时间
     */
    private updateActivity(): void {
        this.lastActivityAt = Date.now();
    }

    /**
     * 检查房间是否超时
     */
    public isIdle(timeoutMs: number): boolean {
        return Date.now() - this.lastActivityAt > timeoutMs;
    }

    /**
     * 启动游戏
     */
    public startGame(): boolean {
        if (this.state !== RoomState.WAITING && this.state !== RoomState.READY) {
            return false;
        }

        if (!this.isAllPlayersReady()) {
            return false;
        }

        this.state = RoomState.PLAYING;
        console.log(`[Room ${this.id}] Game started with ${this.players.size} players`);

        // TODO: 初始化游戏逻辑（TheDecreeGameMode）

        return true;
    }

    /**
     * 结束游戏
     */
    public endGame(): void {
        this.state = RoomState.FINISHED;
        console.log(`[Room ${this.id}] Game ended`);

        // 重置玩家状态
        for (const player of this.players.values()) {
            player.isReady = false;
        }

        this.state = RoomState.WAITING;
    }
}
