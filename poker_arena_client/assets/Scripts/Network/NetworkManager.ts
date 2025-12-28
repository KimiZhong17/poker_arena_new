import { NetworkClient } from './NetworkClient';

/**
 * 网络管理器（单例）
 * 负责管理全局的 NetworkClient 实例
 * 确保在场景切换时连接不会断开
 */
export class NetworkManager {
    private static instance: NetworkManager | null = null;
    private client: NetworkClient | null = null;

    private constructor() {}

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    /**
     * 获取或创建 NetworkClient
     */
    public getClient(serverUrl: string = 'http://localhost:3000'): NetworkClient {
        if (!this.client) {
            console.log('[NetworkManager] Creating new NetworkClient');
            this.client = new NetworkClient(serverUrl);
        }
        return this.client;
    }

    /**
     * 断开连接并清理
     */
    public disconnect(): void {
        if (this.client) {
            console.log('[NetworkManager] Disconnecting');
            this.client.disconnect();
            this.client = null;
        }
    }

    /**
     * 检查是否已连接
     */
    public isConnected(): boolean {
        return this.client ? this.client.getIsConnected() : false;
    }
}
