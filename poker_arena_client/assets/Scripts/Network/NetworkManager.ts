import { NetworkClient } from './NetworkClient';
import { logger } from '../Utils/Logger';

const log = logger('Net');

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
    public getClient(serverUrl: string = 'ws://localhost:3000/ws'): NetworkClient {
        if (!this.client) {
            log.debug('[NetworkManager] Creating new NetworkClient');
            this.client = new NetworkClient(serverUrl);
        }
        return this.client;
    }

    /**
     * 断开连接并清理
     */
    public disconnect(): void {
        if (this.client) {
            log.debug('[NetworkManager] Disconnecting');
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
