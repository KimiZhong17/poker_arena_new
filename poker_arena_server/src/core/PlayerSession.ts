import { Socket } from 'socket.io';

/**
 * 玩家会话
 * 管理单个玩家的连接和基本信息
 */
export class PlayerSession {
    public id: string;
    public guestId: string | null = null;  // 客户端持久化的游客ID
    public name: string;
    public socket: Socket;
    public roomId: string | null = null;
    public seatIndex: number = -1;
    public isReady: boolean = false;
    public isHost: boolean = false;

    // 连接状态
    public isConnected: boolean = true;
    public lastHeartbeat: number = Date.now();

    constructor(socket: Socket, name: string, guestId?: string) {
        this.id = socket.id;
        this.guestId = guestId || null;
        this.name = name;
        this.socket = socket;
    }

    /**
     * 发送消息给该玩家
     */
    public emit(event: string, data: any): void {
        this.socket.emit(event, data);
    }

    /**
     * 更新心跳时间
     */
    public updateHeartbeat(): void {
        this.lastHeartbeat = Date.now();
    }

    /**
     * 检查是否超时
     */
    public isTimeout(timeoutMs: number): boolean {
        return Date.now() - this.lastHeartbeat > timeoutMs;
    }

    /**
     * 获取玩家基本信息（用于广播）
     */
    public getInfo() {
        return {
            id: this.id,
            name: this.name,
            seatIndex: this.seatIndex,
            isReady: this.isReady,
            isHost: this.isHost
        };
    }
}
