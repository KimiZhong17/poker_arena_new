import {
    ClientMessageType,
    ServerMessageType,
    CreateRoomRequest,
    JoinRoomRequest,
    RoomCreatedEvent,
    RoomJoinedEvent,
    PlayerJoinedEvent,
    PlayerLeftEvent,
    PlayerReadyEvent,
    GameStartEvent,
    DealCardsEvent,
    CommunityCardsEvent,
    DealerSelectedEvent,
    DealerCalledEvent,
    PlayerPlayedEvent,
    ShowdownEvent,
    RoundEndEvent,
    GameOverEvent,
    ErrorEvent
} from './Messages';

// 导入 Socket.IO 浏览器构建版本
import io from 'socket.io-client/dist/socket.io.js';

/**
 * 网络客户端
 * 管理与服务器的 Socket.IO 连接
 *
 * 职责：
 * - 管理 WebSocket 连接
 * - 发送/接收消息
 * - 事件分发
 *
 * 注意：
 * - 不存储业务数据（玩家信息、房间信息等）
 * - 数据由 LocalPlayerStore 和 LocalRoomStore 管理
 */
export class NetworkClient {
    private socket: any = null;
    private serverUrl: string;
    private isConnected: boolean = false;

    // 事件回调
    private eventHandlers: Map<string, Function[]> = new Map();

    constructor(serverUrl: string = 'http://localhost:3000') {
        this.serverUrl = serverUrl;
    }

    /**
     * 连接到服务器
     */
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(this.serverUrl, {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000
                });

                this.socket.on('connect', () => {
                    console.log('[NetworkClient] Connected to server');
                    this.isConnected = true;
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    console.log('[NetworkClient] Disconnected from server');
                    this.isConnected = false;
                });

                this.socket.on('connect_error', (error) => {
                    console.error('[NetworkClient] Connection error:', error);
                    reject(error);
                });

                // 注册服务器事件监听器
                this.setupServerEventListeners();

            } catch (error) {
                console.error('[NetworkClient] Failed to connect:', error);
                reject(error);
            }
        });
    }

    /**
     * 断开连接
     */
    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * 设置服务器事件监听器
     */
    private setupServerEventListeners(): void {
        if (!this.socket) return;

        // 房间相关
        this.socket.on(ServerMessageType.ROOM_CREATED, (data: RoomCreatedEvent) => {
            console.log('[NetworkClient] Room created:', data);
            this.emit('room_created', data);
        });

        this.socket.on(ServerMessageType.ROOM_JOINED, (data: RoomJoinedEvent) => {
            console.log('[NetworkClient] Room joined:', data);
            this.emit('room_joined', data);
        });

        this.socket.on(ServerMessageType.PLAYER_JOINED, (data: PlayerJoinedEvent) => {
            console.log('[NetworkClient] Player joined:', data);
            this.emit('player_joined', data);
        });

        this.socket.on(ServerMessageType.PLAYER_LEFT, (data: PlayerLeftEvent) => {
            console.log('[NetworkClient] Player left:', data);
            this.emit('player_left', data);
        });

        this.socket.on(ServerMessageType.PLAYER_READY, (data: PlayerReadyEvent) => {
            console.log('[NetworkClient] Player ready:', data);
            this.emit('player_ready', data);
        });

        // 游戏状态
        this.socket.on(ServerMessageType.GAME_START, (data: GameStartEvent) => {
            console.log('[NetworkClient] Game start:', data);
            this.emit('game_start', data);
        });

        this.socket.on(ServerMessageType.DEAL_CARDS, (data: DealCardsEvent) => {
            console.log('[NetworkClient] Deal cards:', data);
            this.emit('deal_cards', data);
        });

        this.socket.on(ServerMessageType.COMMUNITY_CARDS, (data: CommunityCardsEvent) => {
            console.log('[NetworkClient] Community cards:', data);
            this.emit('community_cards', data);
        });

        this.socket.on(ServerMessageType.DEALER_SELECTED, (data: DealerSelectedEvent) => {
            console.log('[NetworkClient] Dealer selected:', data);
            this.emit('dealer_selected', data);
        });

        this.socket.on(ServerMessageType.DEALER_CALLED, (data: DealerCalledEvent) => {
            console.log('[NetworkClient] Dealer called:', data);
            this.emit('dealer_called', data);
        });

        this.socket.on(ServerMessageType.PLAYER_PLAYED, (data: PlayerPlayedEvent) => {
            console.log('[NetworkClient] Player played:', data);
            this.emit('player_played', data);
        });

        this.socket.on(ServerMessageType.SHOWDOWN, (data: ShowdownEvent) => {
            console.log('[NetworkClient] Showdown:', data);
            this.emit('showdown', data);
        });

        this.socket.on(ServerMessageType.ROUND_END, (data: RoundEndEvent) => {
            console.log('[NetworkClient] Round end:', data);
            this.emit('round_end', data);
        });

        this.socket.on(ServerMessageType.GAME_OVER, (data: GameOverEvent) => {
            console.log('[NetworkClient] Game over:', data);
            this.emit('game_over', data);
        });

        this.socket.on(ServerMessageType.ERROR, (data: ErrorEvent) => {
            console.error('[NetworkClient] Server error:', {
                code: data.code,
                message: data.message,
                fullData: data
            });
            this.emit('error', data);
        });

        this.socket.on(ServerMessageType.PONG, () => {
            // Heartbeat response
        });
    }

    // ==================== 客户端请求方法 ====================

    /**
     * 创建房间
     */
    public createRoom(playerName: string, gameMode: 'the_decree' = 'the_decree', maxPlayers: number = 4): void {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return;
        }

        const request: CreateRoomRequest = {
            playerName,
            gameMode,
            maxPlayers
        };

        this.socket.emit(ClientMessageType.CREATE_ROOM, request);
    }

    /**
     * 加入房间
     */
    public joinRoom(roomId: string, playerName: string): void {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return;
        }

        const request: JoinRoomRequest = {
            roomId,
            playerName
        };

        this.socket.emit(ClientMessageType.JOIN_ROOM, request);
    }

    /**
     * 离开房间
     */
    public leaveRoom(): void {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return;
        }

        this.socket.emit(ClientMessageType.LEAVE_ROOM);
    }

    /**
     * 准备/取消准备
     */
    public toggleReady(): void {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return;
        }

        this.socket.emit(ClientMessageType.READY);
    }

    /**
     * 开始游戏（仅房主可调用）
     */
    public startGame(): void {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return;
        }

        console.log('[NetworkClient] Sending start game request');
        this.socket.emit(ClientMessageType.START_GAME);
    }

    /**
     * 通用发送方法 - 发送任意消息到服务器
     * @param messageType 消息类型
     * @param data 消息数据
     */
    public send(messageType: string, data: any): boolean {
        if (!this.socket || !this.isConnected) {
            console.error('[NetworkClient] Not connected to server');
            return false;
        }

        this.socket.emit(messageType, data);
        return true;
    }

    /**
     * 发送心跳
     */
    public ping(): void {
        if (!this.socket || !this.isConnected) {
            return;
        }

        this.socket.emit(ClientMessageType.PING);
    }

    // ==================== 事件系统 ====================

    /**
     * 注册事件监听器
     */
    public on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    /**
     * 移除事件监听器
     */
    public off(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) return;

        const handlers = this.eventHandlers.get(event)!;
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * 触发事件
     */
    private emit(event: string, data: any): void {
        if (!this.eventHandlers.has(event)) return;

        const handlers = this.eventHandlers.get(event)!;
        for (const handler of handlers) {
            try {
                handler(data);
            } catch (error) {
                console.error(`[NetworkClient] Error in event handler for ${event}:`, error);
            }
        }
    }

    /**
     * 检查是否已连接
     */
    public getIsConnected(): boolean {
        return this.isConnected;
    }
}
