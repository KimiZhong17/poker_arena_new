import { _decorator, Component } from 'cc';
import {
    ClientMessageType,
    ServerMessageType
} from './Messages';

const { ccclass } = _decorator;

// 声明全局 io 变量（从 socket.io.js 加载）
declare const io: any;

/**
 * 消息回调函数类型
 */
type MessageHandler = (data: any) => void;

@ccclass('NetworkClient')
export class NetworkClient extends Component {
    private socket: any = null;
    private serverUrl: string;
    private isConnected: boolean = false;

    // 内部事件中心，用于解耦 NetworkClient 和业务 Service
    private handlers: Map<string, MessageHandler[]> = new Map();

    constructor(serverUrl: string = 'http://localhost:3000') {
        super();
        this.serverUrl = serverUrl;
    }

    /**
     * 连接服务器
     */
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket) return resolve();

            // 检查 io 是否已加载
            if (typeof io === 'undefined') {
                reject(new Error('Socket.IO library not loaded. Make sure socket.io.js is included.'));
                return;
            }

            this.socket = io(this.serverUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                console.log('[Net] Connected');
                resolve();
            });

            this.socket.on('connect_error', (err: any) => reject(err));

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                console.log('[Net] Disconnected');
            });

            // --- 核心重构：自动注册所有服务端消息监听 ---
            this.registerAllServerEvents();
        });
    }

    /**
     * 自动注册 ServerMessageType 中定义的所有事件
     */
    private registerAllServerEvents(): void {
        Object.values(ServerMessageType).forEach((eventType) => {
            this.socket.on(eventType, (data: any) => {
                console.log(`[Net Recv] ${eventType}`, data);
                this.dispatch(eventType, data);
            });
        });
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
    public on(event: ServerMessageType, handler: MessageHandler): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event)!.push(handler);
    }

    /**
     * 暴露给 Service 层使用的移除监听接口
     */
    public off(event: ServerMessageType, handler: MessageHandler): void {
        const eventHandlers = this.handlers.get(event);
        if (eventHandlers) {
            const index = eventHandlers.indexOf(handler);
            if (index !== -1) eventHandlers.splice(index, 1);
        }
    }

    /**
     * 发送请求给服务器（带类型约束）
     * @param type 客户端消息类型
     * @param data 对应协议定义的数据结构
     */
    public send<T>(type: ClientMessageType, data?: T): void {
        if (!this.isConnected) {
            console.error(`[Net] Cannot send ${type}: Not connected`);
            return;
        }
        console.log(`[Net Send] ${type}`, data);
        this.socket.emit(type, data);
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    public getIsConnected(): boolean {
        return this.isConnected;
    }
}