import { _decorator, Component } from 'cc';
import {
    ClientMessageType
} from './Messages';

const { ccclass } = _decorator;

/**
 * 消息回调函数类型
 */
type MessageHandler = (data: any) => void;

/**
 * JSON envelope 格式（与 Go 服务器协议一致）
 */
interface Envelope {
    type: string;
    data?: any;
}

@ccclass('NetworkClient')
export class NetworkClient extends Component {
    private ws: WebSocket | null = null;
    private serverUrl: string;
    private isConnected: boolean = false;

    // 内部事件中心，用于解耦 NetworkClient 和业务 Service
    private handlers: Map<string, MessageHandler[]> = new Map();

    // 心跳定时器
    private heartbeatTimer: number | null = null;
    private readonly HEARTBEAT_INTERVAL = 30000; // 30秒发送一次心跳

    // 重连相关
    private onReconnectCallback: (() => void) | null = null;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_BASE_DELAY = 1000; // 基础重连延迟 1s
    private reconnectTimer: number | null = null;
    private manualDisconnect: boolean = false;

    constructor(serverUrl: string = 'ws://localhost:3000/ws') {
        super();
        this.serverUrl = serverUrl;
    }

    /**
     * 设置重连回调（socket重连成功后调用）
     */
    public setOnReconnect(callback: () => void): void {
        this.onReconnectCallback = callback;
    }

    /**
     * 连接服务器
     */
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws && this.isConnected) return resolve();

            // 清理旧连接
            this.cleanupWebSocket();

            this.manualDisconnect = false;

            try {
                this.ws = new WebSocket(this.serverUrl);
            } catch (err) {
                reject(new Error(`Failed to create WebSocket: ${err}`));
                return;
            }

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('[Net] Connected');

                // 启动心跳
                this.startHeartbeat();

                resolve();
            };

            this.ws.onerror = (event: Event) => {
                console.error('[Net] WebSocket error:', event);
                if (!this.isConnected) {
                    reject(new Error('WebSocket connection failed'));
                }
            };

            this.ws.onclose = (event: CloseEvent) => {
                const wasConnected = this.isConnected;
                this.isConnected = false;
                console.log('[Net] Disconnected, code:', event.code, 'reason:', event.reason);

                // 停止心跳
                this.stopHeartbeat();

                // 派发断线事件
                this.dispatch('_disconnected', { reason: event.reason || `code:${event.code}` });

                // 自动重连（非主动断开时）
                if (!this.manualDisconnect && wasConnected) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onmessage = (event: MessageEvent) => {
                this.handleMessage(event.data);
            };
        });
    }

    /**
     * 处理收到的 WebSocket 消息
     * 解析 JSON envelope 并派发到对应的 handler
     */
    private handleMessage(raw: string): void {
        let envelope: Envelope;
        try {
            envelope = JSON.parse(raw);
        } catch (err) {
            console.warn('[Net] Invalid JSON message:', raw);
            return;
        }

        if (!envelope.type) {
            console.warn('[Net] Message missing type:', raw);
            return;
        }

        // pong 消息不需要打日志
        if (envelope.type !== 'pong') {
            console.log(`[Net Recv] ${envelope.type}`, envelope.data);
        }

        this.dispatch(envelope.type, envelope.data);
    }

    /**
     * 内部消息派发
     */
    private dispatch(event: string, data: any): void {
        const eventHandlers = this.handlers.get(event);
        if (eventHandlers) {
            eventHandlers.forEach(handler => handler(data));
        }
    }

    /**
     * 暴露给 Service 层使用的监听接口
     */
    public on(event: string, handler: MessageHandler): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event)!.push(handler);
    }

    /**
     * 暴露给 Service 层使用的移除监听接口
     */
    public off(event: string, handler: MessageHandler): void {
        const eventHandlers = this.handlers.get(event);
        if (eventHandlers) {
            const index = eventHandlers.indexOf(handler);
            if (index !== -1) eventHandlers.splice(index, 1);
        }
    }

    /**
     * 发送请求给服务器（带类型约束）
     * 使用 JSON envelope 格式: {"type":"...", "data":{...}}
     */
    public send<T>(type: ClientMessageType, data?: T): boolean {
        if (!this.isConnected || !this.ws) {
            console.error(`[Net] Cannot send ${type}: Not connected`);
            return false;
        }

        const envelope: Envelope = { type };
        if (data !== undefined) {
            envelope.data = data;
        }

        console.log(`[Net Send] ${type}`, data);
        this.ws.send(JSON.stringify(envelope));
        return true;
    }

    public disconnect(): void {
        this.manualDisconnect = true;
        this.stopHeartbeat();
        this.cancelReconnect();
        this.cleanupWebSocket();
    }

    public getIsConnected(): boolean {
        return this.isConnected;
    }

    // ==================== 重连逻辑 ====================

    /**
     * 调度自动重连（指数退避）
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.log('[Net] Reconnect failed after all attempts');
            this.dispatch('_reconnect_failed', {});
            return;
        }

        this.reconnectAttempts++;
        const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[Net] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.doReconnect();
        }, delay);
    }

    private doReconnect(): void {
        if (this.manualDisconnect) return;

        console.log(`[Net] Reconnecting... (attempt ${this.reconnectAttempts})`);

        this.cleanupWebSocket();

        try {
            this.ws = new WebSocket(this.serverUrl);
        } catch (err) {
            console.error('[Net] Reconnect WebSocket creation failed:', err);
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            this.isConnected = true;
            const attempt = this.reconnectAttempts;
            this.reconnectAttempts = 0;
            console.log('[Net] Reconnected after', attempt, 'attempts');

            this.startHeartbeat();

            // 触发重连回调
            if (this.onReconnectCallback) {
                this.onReconnectCallback();
            }
        };

        this.ws.onerror = () => {
            // onclose 会处理重连调度
        };

        this.ws.onclose = (event: CloseEvent) => {
            this.isConnected = false;
            console.log('[Net] Reconnect socket closed, code:', event.code);

            if (!this.manualDisconnect) {
                this.scheduleReconnect();
            }
        };

        this.ws.onmessage = (event: MessageEvent) => {
            this.handleMessage(event.data);
        };
    }

    private cancelReconnect(): void {
        if (this.reconnectTimer !== null) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
    }

    private cleanupWebSocket(): void {
        if (this.ws) {
            // 清除事件处理器防止触发 onclose 回调
            this.ws.onopen = null;
            this.ws.onerror = null;
            this.ws.onclose = null;
            this.ws.onmessage = null;

            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
        this.isConnected = false;
    }

    // ==================== 心跳 ====================

    /**
     * 启动心跳
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        console.log('[Net] Starting heartbeat');

        // 立即发送一次心跳
        this.sendHeartbeat();

        // 设置定时发送心跳
        this.heartbeatTimer = window.setInterval(() => {
            this.sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL);
    }

    /**
     * 停止心跳
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer !== null) {
            console.log('[Net] Stopping heartbeat');
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * 发送心跳
     */
    private sendHeartbeat(): void {
        if (this.isConnected && this.ws) {
            const envelope: Envelope = { type: ClientMessageType.PING };
            this.ws.send(JSON.stringify(envelope));
        }
    }
}
