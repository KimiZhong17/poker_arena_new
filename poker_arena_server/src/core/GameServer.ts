import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameRoom } from './GameRoom';
import { PlayerSession } from './PlayerSession';
import { ServerConfig } from '../config/ServerConfig';
import { IdValidator } from '../utils/IdValidator';
import {
    ClientMessageType,
    ServerMessageType,
    CreateRoomRequest,
    JoinRoomRequest,
    DealerCallRequest,
    PlayCardsRequest,
    SelectFirstDealerCardRequest,
    RoomCreatedEvent,
    RoomJoinedEvent,
    PlayerJoinedEvent,
    PlayerLeftEvent,
    PlayerReadyEvent,
    GameStartEvent,
    ErrorEvent,
    ErrorCode
} from '../types/Messages';

/**
 * 游戏服务器
 * 管理所有房间和玩家连接
 */
export class GameServer {
    private io: SocketIOServer;
    private rooms: Map<string, GameRoom> = new Map();
    private players: Map<string, PlayerSession> = new Map();

    // 心跳定时器
    private heartbeatTimer: NodeJS.Timeout | null = null;

    constructor(httpServer: HTTPServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: '*',  // 开发环境允许所有来源（包括 file:// 协议）
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        this.setupEventHandlers();
        this.startHeartbeat();

        console.log('[GameServer] Initialized');
    }

    /**
     * 设置 Socket.IO 事件处理器
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`[GameServer] Client connected: ${socket.id}`);

            // 创建房间
            socket.on(ClientMessageType.CREATE_ROOM, (data: CreateRoomRequest) => {
                this.handleCreateRoom(socket, data);
            });

            // 加入房间
            socket.on(ClientMessageType.JOIN_ROOM, (data: JoinRoomRequest) => {
                this.handleJoinRoom(socket, data);
            });

            // 离开房间
            socket.on(ClientMessageType.LEAVE_ROOM, () => {
                this.handleLeaveRoom(socket);
            });

            // 准备
            socket.on(ClientMessageType.READY, () => {
                this.handleReady(socket);
            });

            // 开始游戏
            socket.on(ClientMessageType.START_GAME, () => {
                this.handleStartGame(socket);
            });

            // 庄家叫牌
            socket.on(ClientMessageType.DEALER_CALL, (data: DealerCallRequest) => {
                this.handleDealerCall(socket, data);
            });

            // 选择首个庄家的牌
            socket.on(ClientMessageType.SELECT_FIRST_DEALER_CARD, (data: SelectFirstDealerCardRequest) => {
                this.handleSelectFirstDealerCard(socket, data);
            });

            // 玩家出牌
            socket.on(ClientMessageType.PLAY_CARDS, (data: PlayCardsRequest) => {
                this.handlePlayCards(socket, data);
            });

            // 心跳
            socket.on(ClientMessageType.PING, () => {
                this.handlePing(socket);
            });

            // 断开连接
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    // ==================== 房间管理 ====================

    /**
     * 处理创建房间
     */
    private handleCreateRoom(socket: Socket, data: CreateRoomRequest): void {
        try {
            // 验证玩家名称
            if (!IdValidator.isValidPlayerName(data.playerName)) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid player name');
                console.warn(`[GameServer] Invalid player name: ${data.playerName}`);
                return;
            }

            // 净化玩家名称
            const sanitizedName = IdValidator.sanitizePlayerName(data.playerName);

            // 如果是游客ID格式，验证其合法性
            if (data.playerName.startsWith('guest_')) {
                if (!IdValidator.isValidGuestId(data.playerName)) {
                    this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid guest ID format');
                    console.warn(`[GameServer] Invalid guest ID format: ${data.playerName}`);
                    return;
                }
                console.log(`[GameServer] Guest ID validated: ${data.playerName}`);
            }

            // 检查房间数量限制
            if (this.rooms.size >= ServerConfig.MAX_ROOMS) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Server is full');
                return;
            }

            // 创建房间
            const room = new GameRoom(data.gameMode, data.maxPlayers);
            this.rooms.set(room.id, room);

            // 创建玩家会话（使用净化后的名称）
            const player = new PlayerSession(socket, sanitizedName);
            this.players.set(socket.id, player);

            // 玩家加入房间
            room.addPlayer(player);

            // Socket 加入房间（用于广播）
            socket.join(room.id);

            // 发送响应
            const response: RoomCreatedEvent = {
                roomId: room.id,
                playerId: player.id,
                playerName: player.name
            };

            socket.emit(ServerMessageType.ROOM_CREATED, response);

            console.log(`[GameServer] Room created: ${room.id} by ${sanitizedName}`);
        } catch (error) {
            console.error('[GameServer] Error creating room:', error);
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to create room');
        }
    }

    /**
     * 处理加入房间
     */
    private handleJoinRoom(socket: Socket, data: JoinRoomRequest): void {
        try {
            // 验证玩家名称
            if (!IdValidator.isValidPlayerName(data.playerName)) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid player name');
                console.warn(`[GameServer] Invalid player name: ${data.playerName}`);
                return;
            }

            // 净化玩家名称
            const sanitizedName = IdValidator.sanitizePlayerName(data.playerName);

            // 如果是游客ID格式，验证其合法性
            if (data.playerName.startsWith('guest_')) {
                if (!IdValidator.isValidGuestId(data.playerName)) {
                    this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid guest ID format');
                    console.warn(`[GameServer] Invalid guest ID format: ${data.playerName}`);
                    return;
                }
                console.log(`[GameServer] Guest ID validated: ${data.playerName}`);
            }

            const room = this.rooms.get(data.roomId);

            if (!room) {
                this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
                return;
            }

            if (room.isFull()) {
                this.sendError(socket, ErrorCode.ROOM_FULL, 'Room is full');
                return;
            }

            // 创建玩家会话（使用净化后的名称）
            const player = new PlayerSession(socket, sanitizedName);
            this.players.set(socket.id, player);

            // 玩家加入房间
            room.addPlayer(player);

            // Socket 加入房间
            socket.join(room.id);

            // 发送响应给加入的玩家
            const response: RoomJoinedEvent = {
                roomId: room.id,
                playerId: player.id,
                myPlayerIdInRoom: player.id,
                hostId: room.getHostId(),
                players: room.getPlayersInfo()
            };

            socket.emit(ServerMessageType.ROOM_JOINED, response);

            // 广播给其他玩家
            const joinEvent: PlayerJoinedEvent = {
                player: player.getInfo()
            };

            room.broadcast(ServerMessageType.PLAYER_JOINED, joinEvent, player.id);

            console.log(`[GameServer] Player ${sanitizedName} joined room ${room.id}`);
        } catch (error) {
            console.error('[GameServer] Error joining room:', error);
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to join room');
        }
    }

    /**
     * 处理离开房间
     */
    private handleLeaveRoom(socket: Socket): void {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = this.rooms.get(player.roomId);
        if (!room) return;

        // 从房间移除玩家
        room.removePlayer(player.id);

        // Socket 离开房间
        socket.leave(room.id);

        // 广播给其他玩家
        const event: PlayerLeftEvent = {
            playerId: player.id
        };

        room.broadcast(ServerMessageType.PLAYER_LEFT, event);

        // 如果房间为空，删除房间
        if (room.isEmpty()) {
            this.rooms.delete(room.id);
            console.log(`[GameServer] Room ${room.id} deleted (empty)`);
        }

        // 删除玩家会话
        this.players.delete(socket.id);

        console.log(`[GameServer] Player ${player.name} left room ${room.id}`);
    }

    /**
     * 处理玩家准备
     */
    private handleReady(socket: Socket): void {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) return;

        const room = this.rooms.get(player.roomId);
        if (!room) return;

        // 切换准备状态
        const isReady = !player.isReady;
        room.setPlayerReady(player.id, isReady);

        // 广播准备状态
        const event: PlayerReadyEvent = {
            playerId: player.id,
            isReady
        };

        room.broadcast(ServerMessageType.PLAYER_READY, event);

        console.log(`[GameServer] Player ${player.name} ready: ${isReady}`);
    }

    /**
     * 处理开始游戏请求（房主触发）
     */
    private handleStartGame(socket: Socket): void {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) {
            this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a room');
            return;
        }

        const room = this.rooms.get(player.roomId);
        if (!room) {
            this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
            return;
        }

        // 检查是否是房主
        if (!player.isHost) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Only host can start the game');
            return;
        }

        // 检查是否所有玩家都准备好
        if (!room.isAllPlayersReady()) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Not all players are ready');
            return;
        }

        // 开始游戏
        this.startGame(room);
    }

    // ==================== 游戏逻辑 ====================

    /**
     * 开始游戏
     */
    private startGame(room: GameRoom): void {
        if (!room.startGame()) {
            return;
        }

        console.log(`[GameServer] Game started in room ${room.id}`);
    }

    /**
     * 处理选择首个庄家的牌
     */
    private handleSelectFirstDealerCard(socket: Socket, data: SelectFirstDealerCardRequest): void {
        console.log(`[GameServer] ========== handleSelectFirstDealerCard ==========`);
        console.log(`[GameServer] Received data:`, data);
        console.log(`[GameServer] Card: 0x${data.card.toString(16)}`);

        const player = this.players.get(socket.id);
        if (!player || !player.roomId) {
            console.error(`[GameServer] ✗ Player not found or not in room`);
            this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
            return;
        }

        console.log(`[GameServer] Player: ${player.name} (${player.id})`);
        console.log(`[GameServer] Room ID: ${player.roomId}`);

        const room = this.rooms.get(player.roomId);
        if (!room) {
            console.error(`[GameServer] ✗ Room not found: ${player.roomId}`);
            this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
            return;
        }

        // Verify player ID matches
        if (data.playerId !== player.id) {
            console.error(`[GameServer] ✗ Player ID mismatch: ${data.playerId} !== ${player.id}`);
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        console.log(`[GameServer] Calling room.handleSelectFirstDealerCard...`);

        // Handle select card in room
        const success = room.handleSelectFirstDealerCard(player.id, data.card);

        console.log(`[GameServer] Player ${player.name} selected card for first dealer (${success ? 'success' : 'failed'})`);
    }

    /**
     * 处理庄家叫牌
     */
    private handleDealerCall(socket: Socket, data: DealerCallRequest): void {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) {
            this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
            return;
        }

        const room = this.rooms.get(player.roomId);
        if (!room) {
            this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
            return;
        }

        // Verify player ID matches
        if (data.playerId !== player.id) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        // Handle dealer call in room
        const success = room.handleDealerCall(player.id, data.cardsToPlay);

        console.log(`[GameServer] Player ${player.name} dealer call: ${data.cardsToPlay} cards (${success ? 'success' : 'failed'})`);
    }

    /**
     * 处理玩家出牌
     */
    private handlePlayCards(socket: Socket, data: PlayCardsRequest): void {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) {
            this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
            return;
        }

        const room = this.rooms.get(player.roomId);
        if (!room) {
            this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
            return;
        }

        // Verify player ID matches
        if (data.playerId !== player.id) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        // Handle play cards in room
        const success = room.handlePlayCards(player.id, data.cards);

        console.log(`[GameServer] Player ${player.name} played ${data.cards.length} cards (${success ? 'success' : 'failed'})`);
    }

    // ==================== 连接管理 ====================

    /**
     * 处理心跳
     */
    private handlePing(socket: Socket): void {
        const player = this.players.get(socket.id);
        if (player) {
            player.updateHeartbeat();
        }
        socket.emit(ServerMessageType.PONG);
    }

    /**
     * 处理断开连接
     */
    private handleDisconnect(socket: Socket): void {
        console.log(`[GameServer] Client disconnected: ${socket.id}`);

        const player = this.players.get(socket.id);
        if (player && player.roomId) {
            // 标记为断线
            player.isConnected = false;

            // TODO: 延迟删除玩家，允许重连
            // 目前直接离开房间
            this.handleLeaveRoom(socket);
        }
    }

    /**
     * 启动心跳检测
     */
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();

            // 检查玩家超时
            for (const [id, player] of this.players) {
                if (player.isTimeout(ServerConfig.PLAYER_DISCONNECT_TIMEOUT)) {
                    console.log(`[GameServer] Player ${player.name} timeout, removing...`);
                    this.handleLeaveRoom(player.socket);
                }
            }

            // 检查空闲房间
            for (const [id, room] of this.rooms) {
                if (room.isEmpty() || room.isIdle(ServerConfig.ROOM_IDLE_TIMEOUT)) {
                    console.log(`[GameServer] Room ${id} idle, removing...`);
                    this.rooms.delete(id);
                }
            }
        }, ServerConfig.HEARTBEAT_INTERVAL);
    }

    /**
     * 发送错误消息
     */
    private sendError(socket: Socket, code: ErrorCode, message: string): void {
        const error: ErrorEvent = { code, message };
        socket.emit(ServerMessageType.ERROR, error);
    }

    /**
     * 关闭服务器
     */
    public shutdown(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.io.close();
        console.log('[GameServer] Shutdown complete');
    }

    /**
     * 获取统计信息
     */
    public getStats() {
        return {
            rooms: this.rooms.size,
            players: this.players.size,
            roomDetails: Array.from(this.rooms.values()).map(room => ({
                id: room.id,
                playerCount: room.getPlayerCount(),
                state: room.state
            }))
        };
    }
}
