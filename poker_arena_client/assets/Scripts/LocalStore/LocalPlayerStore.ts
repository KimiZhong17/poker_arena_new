import { IdGenerator } from '../Utils/IdGenerator';

/**
 * 本地玩家数据结构
 */
export interface LocalPlayerData {
    // 本地用户基本信息
    username: string;
    nickname: string;
    avatar?: string;
    level: number;
    exp: number;

    // 认证相关
    isGuest: boolean;
    token?: string;

    // 游客专属：客户端生成的唯一ID
    // 格式: guest_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    guestId?: string;

    // 当前房间内的玩家ID（服务器分配）
    // 注意：这个ID只在当前房间内有效，离开房间后会清空
    currentRoomPlayerId?: string;
}

/**
 * LocalPlayerStore - 本地玩家状态存储
 *
 * 职责：
 * - 管理本地玩家的基本信息（用户名、昵称、等级等）
 * - 处理本地认证状态（登录/游客登录/登出）
 * - 持久化用户数据到 localStorage
 * - 存储当前选择的游戏模式
 * - 临时存储服务器分配的房间玩家ID
 *
 * 注意：
 * - 不负责房间管理（由 RoomStateStore 负责）
 * - 不负责网络通信（由 NetworkClient 负责）
 */
export class LocalPlayerStore {
    private static instance: LocalPlayerStore;

    private playerData: LocalPlayerData | null = null;
    private isLoggedIn: boolean = false;
    private selectedGameMode: string | null = null;

    private constructor() {
        this.loadFromStorage();
    }

    public static getInstance(): LocalPlayerStore {
        if (!LocalPlayerStore.instance) {
            LocalPlayerStore.instance = new LocalPlayerStore();
        }
        return LocalPlayerStore.instance;
    }

    // ==================== 认证相关 ====================

    /**
     * 用户名密码登录
     * TODO: 替换为真实的 API 调用
     */
    public async login(username: string, password: string): Promise<boolean> {
        // TODO: Call real authentication API
        await this.delay(500);

        this.playerData = {
            username: username,
            nickname: username,
            level: 1,
            exp: 0,
            isGuest: false
        };

        this.isLoggedIn = true;
        this.saveToStorage();

        console.log(`[LocalPlayerStore] User logged in: ${username}`);
        return true;
    }

    /**
     * 游客登录
     * 使用UUID生成全局唯一的游客ID，避免冲突
     */
    public async loginAsGuest(): Promise<boolean> {
        await this.delay(300);

        // 生成全局唯一的游客ID
        const guestId = IdGenerator.generateGuestId();
        // 生成友好的显示名称（从UUID提取短ID）
        const displayName = IdGenerator.generateGuestDisplayName(guestId);

        this.playerData = {
            username: guestId,          // 使用完整UUID作为username（唯一标识）
            nickname: displayName,       // 使用友好名称作为昵称（显示）
            level: 1,
            exp: 0,
            isGuest: true,
            guestId: guestId            // 保存完整的游客ID
        };

        this.isLoggedIn = true;
        // 游客不保存到 localStorage

        console.log(`[LocalPlayerStore] Guest logged in: ${guestId} (显示名: ${displayName})`);
        return true;
    }

    /**
     * 登出
     */
    public logout(): void {
        this.playerData = null;
        this.isLoggedIn = false;
        this.selectedGameMode = null;
        this.clearStorage();

        console.log('[LocalPlayerStore] User logged out');
    }

    /**
     * 检查是否已登录
     */
    public isUserLoggedIn(): boolean {
        return this.isLoggedIn && this.playerData !== null;
    }

    // ==================== 玩家数据访问 ====================

    /**
     * 获取完整的玩家数据
     */
    public getPlayerData(): LocalPlayerData | null {
        return this.playerData;
    }

    /**
     * 获取用户名
     */
    public getUsername(): string {
        return this.playerData?.username || 'Guest';
    }

    /**
     * 获取昵称
     */
    public getNickname(): string {
        return this.playerData?.nickname || 'Guest';
    }

    /**
     * 获取当前房间内的玩家ID（服务器分配）
     * 如果不在房间内，返回 null
     */
    public getCurrentRoomPlayerId(): string | null {
        return this.playerData?.currentRoomPlayerId || null;
    }

    /**
     * 是否是游客
     */
    public isGuest(): boolean {
        return this.playerData?.isGuest || false;
    }

    // ==================== 玩家数据更新 ====================

    /**
     * 更新玩家基本信息
     */
    public updatePlayerData(data: Partial<LocalPlayerData>): void {
        if (!this.playerData) {
            console.warn('[LocalPlayerStore] Cannot update: no player data');
            return;
        }

        this.playerData = {
            ...this.playerData,
            ...data
        };

        // 只有非游客才保存到 localStorage
        if (!this.playerData.isGuest) {
            this.saveToStorage();
        }

        console.log('[LocalPlayerStore] Player data updated:', data);
    }

    /**
     * 设置当前房间内的玩家ID（服务器分配）
     * 当加入/创建房间成功时调用
     */
    public setCurrentRoomPlayerId(playerId: string): void {
        if (!this.playerData) {
            console.warn('[LocalPlayerStore] Cannot set room player ID: no player data');
            return;
        }

        this.playerData.currentRoomPlayerId = playerId;
        console.log(`[LocalPlayerStore] Room player ID set: ${playerId}`);
    }

    /**
     * 清除当前房间玩家ID
     * 当离开房间时调用
     */
    public clearCurrentRoomPlayerId(): void {
        if (this.playerData) {
            this.playerData.currentRoomPlayerId = undefined;
            console.log('[LocalPlayerStore] Room player ID cleared');
        }
    }

    // ==================== 游戏模式选择 ====================

    /**
     * 设置选择的游戏模式
     */
    public setSelectedGameMode(gameModeId: string): void {
        this.selectedGameMode = gameModeId;
        console.log(`[LocalPlayerStore] Selected game mode: ${gameModeId}`);
    }

    /**
     * 获取选择的游戏模式
     */
    public getSelectedGameMode(): string | null {
        return this.selectedGameMode;
    }

    /**
     * 清除游戏模式选择
     */
    public clearSelectedGameMode(): void {
        this.selectedGameMode = null;
    }

    // ==================== 本地存储 ====================

    /**
     * 保存到 localStorage
     */
    private saveToStorage(): void {
        if (!this.playerData) return;

        try {
            // 不保存 currentRoomPlayerId（临时数据）
            const dataToSave = { ...this.playerData };
            delete dataToSave.currentRoomPlayerId;

            localStorage.setItem('poker_arena_player', JSON.stringify(dataToSave));
            localStorage.setItem('poker_arena_logged_in', 'true');
        } catch (error) {
            console.error('[LocalPlayerStore] Failed to save to storage:', error);
        }
    }

    /**
     * 从 localStorage 加载
     */
    private loadFromStorage(): void {
        try {
            const playerData = localStorage.getItem('poker_arena_player');
            const loggedIn = localStorage.getItem('poker_arena_logged_in');

            if (playerData && loggedIn === 'true') {
                this.playerData = JSON.parse(playerData);
                this.isLoggedIn = true;
                console.log('[LocalPlayerStore] Loaded from storage:', this.playerData?.username);
            }
        } catch (error) {
            console.error('[LocalPlayerStore] Failed to load from storage:', error);
        }
    }

    /**
     * 清除 localStorage
     */
    private clearStorage(): void {
        try {
            localStorage.removeItem('poker_arena_player');
            localStorage.removeItem('poker_arena_logged_in');
        } catch (error) {
            console.error('[LocalPlayerStore] Failed to clear storage:', error);
        }
    }

    // ==================== 工具方法 ====================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
