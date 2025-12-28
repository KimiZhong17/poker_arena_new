import { IdGenerator } from '../Utils/IdGenerator';

/**
 * 本地用户数据结构
 */
export interface LocalUserData {
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
 * LocalUserStore - 本地用户状态存储
 *
 * 职责：
 * - 管理本地用户的账户信息（用户名、昵称、等级等）
 * - 处理本地认证状态（登录/游客登录/登出）
 * - 持久化用户数据到 localStorage
 * - 存储当前选择的游戏模式
 *
 * 注意：
 * - 不负责房间管理（由 LocalRoomStore 负责）
 * - 不负责网络通信（由 NetworkClient 负责）
 * - 房间内的玩家ID由 LocalRoomStore 管理
 */
export class LocalUserStore {
    private static instance: LocalUserStore;

    private userData: LocalUserData | null = null;
    private isLoggedIn: boolean = false;
    private selectedGameMode: string | null = null;

    private constructor() {
        this.loadFromStorage();
    }

    public static getInstance(): LocalUserStore {
        if (!LocalUserStore.instance) {
            LocalUserStore.instance = new LocalUserStore();
        }
        return LocalUserStore.instance;
    }

    // ==================== 认证相关 ====================

    /**
     * 用户名密码登录
     * TODO: 替换为真实的 API 调用
     */
    public async login(username: string, password: string): Promise<boolean> {
        // TODO: Call real authentication API
        await this.delay(500);

        this.userData = {
            username: username,
            nickname: username,
            level: 1,
            exp: 0,
            isGuest: false
        };

        this.isLoggedIn = true;
        this.saveToStorage();

        console.log(`[LocalUserStore] User logged in: ${username}`);
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

        this.userData = {
            username: guestId,          // 使用完整UUID作为username（唯一标识）
            nickname: displayName,       // 使用友好名称作为昵称（显示）
            level: 1,
            exp: 0,
            isGuest: true,
            guestId: guestId            // 保存完整的游客ID
        };

        this.isLoggedIn = true;
        // 游客不保存到 localStorage

        console.log(`[LocalUserStore] Guest logged in: ${guestId} (显示名: ${displayName})`);
        return true;
    }

    /**
     * 登出
     */
    public logout(): void {
        this.userData = null;
        this.isLoggedIn = false;
        this.selectedGameMode = null;
        this.clearStorage();

        console.log('[LocalUserStore] User logged out');
    }

    /**
     * 检查是否已登录
     */
    public isUserLoggedIn(): boolean {
        return this.isLoggedIn && this.userData !== null;
    }

    // ==================== 用户数据访问 ====================

    /**
     * 获取完整的用户数据
     */
    public getUserData(): LocalUserData | null {
        return this.userData;
    }

    /**
     * 获取用户名
     */
    public getUsername(): string {
        return this.userData?.username || 'Guest';
    }

    /**
     * 获取昵称
     */
    public getNickname(): string {
        return this.userData?.nickname || 'Guest';
    }

    /**
     * 获取当前房间内的玩家ID（服务器分配）
     * @deprecated 此方法将在下一个版本中移除，请使用 LocalRoomStore.getMyPlayerId()
     * 如果不在房间内，返回 null
     */
    public getCurrentRoomPlayerId(): string | null {
        return this.userData?.currentRoomPlayerId || null;
    }

    /**
     * 是否是游客
     */
    public isGuest(): boolean {
        return this.userData?.isGuest || false;
    }

    // ==================== 用户数据更新 ====================

    /**
     * 更新用户基本信息
     */
    public updateUserData(data: Partial<LocalUserData>): void {
        if (!this.userData) {
            console.warn('[LocalUserStore] Cannot update: no user data');
            return;
        }

        this.userData = {
            ...this.userData,
            ...data
        };

        // 只有非游客才保存到 localStorage
        if (!this.userData.isGuest) {
            this.saveToStorage();
        }

        console.log('[LocalUserStore] User data updated:', data);
    }

    /**
     * 设置当前房间内的玩家ID（服务器分配）
     * @deprecated 此方法将在下一个版本中移除，请使用 LocalRoomStore.setMyPlayerId()
     * 当加入/创建房间成功时调用
     */
    public setCurrentRoomPlayerId(playerId: string): void {
        if (!this.userData) {
            console.warn('[LocalUserStore] Cannot set room player ID: no user data');
            return;
        }

        this.userData.currentRoomPlayerId = playerId;
        console.log(`[LocalUserStore] Room player ID set: ${playerId}`);
    }

    /**
     * 清除当前房间玩家ID
     * @deprecated 此方法将在下一个版本中移除，请使用 LocalRoomStore.clearMyPlayerId()
     * 当离开房间时调用
     */
    public clearCurrentRoomPlayerId(): void {
        if (this.userData) {
            this.userData.currentRoomPlayerId = undefined;
            console.log('[LocalUserStore] Room player ID cleared');
        }
    }

    // ==================== 游戏模式选择 ====================

    /**
     * 设置选择的游戏模式
     */
    public setSelectedGameMode(gameModeId: string): void {
        this.selectedGameMode = gameModeId;
        console.log(`[LocalUserStore] Selected game mode: ${gameModeId}`);
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
        if (!this.userData) return;

        try {
            // 不保存 currentRoomPlayerId（临时数据）
            const dataToSave = { ...this.userData };
            delete dataToSave.currentRoomPlayerId;

            localStorage.setItem('poker_arena_user', JSON.stringify(dataToSave));
            localStorage.setItem('poker_arena_logged_in', 'true');
        } catch (error) {
            console.error('[LocalUserStore] Failed to save to storage:', error);
        }
    }

    /**
     * 从 localStorage 加载
     */
    private loadFromStorage(): void {
        try {
            const userData = localStorage.getItem('poker_arena_user');
            const loggedIn = localStorage.getItem('poker_arena_logged_in');

            if (userData && loggedIn === 'true') {
                this.userData = JSON.parse(userData);
                this.isLoggedIn = true;
                console.log('[LocalUserStore] Loaded from storage:', this.userData?.username);
            }
        } catch (error) {
            console.error('[LocalUserStore] Failed to load from storage:', error);
        }
    }

    /**
     * 清除 localStorage
     */
    private clearStorage(): void {
        try {
            localStorage.removeItem('poker_arena_user');
            localStorage.removeItem('poker_arena_logged_in');
        } catch (error) {
            console.error('[LocalUserStore] Failed to clear storage:', error);
        }
    }

    // ==================== 工具方法 ====================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
