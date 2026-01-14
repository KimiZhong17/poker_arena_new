import { NetworkClient } from '../Network/NetworkClient';
import { LocalUserStore } from '../LocalStore/LocalUserStore';

/**
 * AuthService - 认证服务
 *
 * 职责：
 * - 处理所有认证相关的网络请求
 * - 管理用户登录/登出流程
 * - 成功后更新 LocalUserStore
 *
 * 注意：
 * - 不负责本地状态存储（由 LocalUserStore 负责）
 * - 不负责底层网络连接（由 NetworkClient 负责）
 */
export class AuthService {
    private static instance: AuthService;
    private networkClient: NetworkClient | null = null;
    private localUserStore: LocalUserStore;

    private constructor() {
        this.localUserStore = LocalUserStore.getInstance();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // ==================== 认证接口 ====================

    /**
     * 用户名密码登录
     * TODO: 实现真实的服务器认证
     */
    public async login(username: string, password: string): Promise<boolean> {
        console.log('[AuthService] Login:', username);

        try {
            // TODO: 替换为真实的服务器 API 调用
            // if (this.networkClient) {
            //     await this.networkClient.emit('login', { username, password });
            //     // 等待服务器响应...
            // }

            // 临时：模拟登录
            await this.delay(500);

            // 登录成功后更新本地状态
            this.localUserStore.updateUserData({
                username: username,
                nickname: username,
                isGuest: false
            });

            console.log('[AuthService] Login successful');
            return true;
        } catch (error) {
            console.error('[AuthService] Login failed:', error);
            return false;
        }
    }

    /**
     * 游客登录
     * 客户端生成UUID作为唯一标识，连接服务器后由服务器验证/分配正式ID
     * @param customNickname 可选的自定义昵称
     */
    public async loginAsGuest(customNickname?: string): Promise<boolean> {
        console.log('[AuthService] Guest login', customNickname ? `with nickname: ${customNickname}` : '');

        try {
            // LocalUserStore 会生成UUID，确保唯一性
            const success = await this.localUserStore.loginAsGuest(customNickname);

            if (success) {
                const guestId = this.localUserStore.getUsername();
                const displayName = this.localUserStore.getNickname();
                console.log(`[AuthService] Guest login successful: ${guestId} (显示: ${displayName})`);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('[AuthService] Guest login failed:', error);
            return false;
        }
    }

    /**
     * 登出
     * - 通知服务器（如果已连接）
     * - 清理本地状态
     */
    public logout(): void {
        console.log('[AuthService] Logout');

        // 如果连接到服务器，通知服务器登出
        if (this.networkClient && this.networkClient.getIsConnected()) {
            // TODO: 添加 logout 消息类型
            // this.networkClient.emit('logout');
        }

        // 清理本地玩家数据
        this.localUserStore.logout();

        console.log('[AuthService] Logout complete');
    }

    /**
     * 检查是否已登录
     */
    public isLoggedIn(): boolean {
        return this.localUserStore.isUserLoggedIn();
    }

    /**
     * 获取当前用户名
     */
    public getUsername(): string {
        return this.localUserStore.getUsername();
    }

    // ==================== 工具方法 ====================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
