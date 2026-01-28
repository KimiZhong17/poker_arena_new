import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameRoom } from './GameRoom';
import { PlayerSession } from './PlayerSession';
import { ServerConfig } from '../config/ServerConfig';
import { IdValidator } from '../utils/IdValidator';
import { RateLimiter, RateLimitPresets } from '../utils/RateLimiter';
import {
    ClientMessageType,
    ServerMessageType,
    CreateRoomRequest,
    JoinRoomRequest,
    ReconnectRequest,
    DealerCallRequest,
    PlayCardsRequest,
    SelectFirstDealerCardRequest,
    SetAutoRequest,
    RoomCreatedEvent,
    RoomJoinedEvent,
    PlayerJoinedEvent,
    PlayerLeftEvent,
    PlayerReadyEvent,
    HostChangedEvent,
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

    // 断线玩家映射：playerId -> PlayerSession
    // 用于保存断线玩家信息，允许重连
    private disconnectedPlayers: Map<string, PlayerSession> = new Map();

    // 心跳定时器
    private heartbeatTimer: NodeJS.Timeout | null = null;

    // 速率限制器
    private gameActionLimiter = new RateLimiter(RateLimitPresets.GAME_ACTION);
    private roomActionLimiter = new RateLimiter(RateLimitPresets.ROOM_ACTION);
    private connectionLimiter = new RateLimiter(RateLimitPresets.CONNECTION);

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
                if (!this.checkRateLimit(socket, 'room')) return;
                this.handleCreateRoom(socket, data);
            });

            // 加入房间
            socket.on(ClientMessageType.JOIN_ROOM, (data: JoinRoomRequest) => {
                if (!this.checkRateLimit(socket, 'room')) return;
                this.handleJoinRoom(socket, data);
            });

            // 重连房间
            socket.on(ClientMessageType.RECONNECT, (data: ReconnectRequest) => {
                if (!this.checkRateLimit(socket, 'connection')) return;
                this.handleReconnect(socket, data);
            });

            // 离开房间
            socket.on(ClientMessageType.LEAVE_ROOM, () => {
                if (!this.checkRateLimit(socket, 'room')) return;
                this.handleLeaveRoom(socket);
            });

            // 准备
            socket.on(ClientMessageType.READY, () => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleReady(socket);
            });

            // 开始游戏
            socket.on(ClientMessageType.START_GAME, () => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleStartGame(socket);
            });

            // 重启游戏
            socket.on(ClientMessageType.RESTART_GAME, () => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleRestartGame(socket);
            });

            // 庄家叫牌
            socket.on(ClientMessageType.DEALER_CALL, (data: DealerCallRequest) => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleDealerCall(socket, data);
            });

            // 选择首个庄家的牌
            socket.on(ClientMessageType.SELECT_FIRST_DEALER_CARD, (data: SelectFirstDealerCardRequest) => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleSelectFirstDealerCard(socket, data);
            });

            // 玩家出牌
            socket.on(ClientMessageType.PLAY_CARDS, (data: PlayCardsRequest) => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handlePlayCards(socket, data);
            });

            // 设置托管
            socket.on(ClientMessageType.SET_AUTO, (data: SetAutoRequest) => {
                if (!this.checkRateLimit(socket, 'game')) return;
                this.handleSetAuto(socket, data);
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

    /**
     * 检查速率限制
     * @returns true 如果允许，false 如果被限制
     */
    private checkRateLimit(socket: Socket, type: 'game' | 'room' | 'connection'): boolean {
        let limiter: RateLimiter;
        switch (type) {
            case 'game':
                limiter = this.gameActionLimiter;
                break;
            case 'room':
                limiter = this.roomActionLimiter;
                break;
            case 'connection':
                limiter = this.connectionLimiter;
                break;
        }

        if (!limiter.isAllowed(socket.id)) {
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Too many requests, please slow down');
            console.warn(`[GameServer] Rate limit exceeded for ${socket.id} (${type})`);
            return false;
        }
        return true;
    }

    /**
     * 验证并净化玩家名称
     * @returns 净化后的名称，如果验证失败返回 null
     */
    private validateAndSanitizePlayerName(socket: Socket, playerName: string): string | null {
        if (!IdValidator.isValidPlayerName(playerName)) {
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid player name');
            console.warn(`[GameServer] Invalid player name: ${playerName}`);
            return null;
        }

        // 如果是游客ID格式，验证其合法性
        if (playerName.startsWith('guest_')) {
            if (!IdValidator.isValidGuestId(playerName)) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid guest ID format');
                console.warn(`[GameServer] Invalid guest ID format: ${playerName}`);
                return null;
            }
            console.log(`[GameServer] Guest ID validated: ${playerName}`);
        }

        return IdValidator.sanitizePlayerName(playerName);
    }

    /**
     * 获取玩家和房间，用于游戏操作的通用验证
     * @returns 玩家和房间，如果验证失败返回 null
     */
    private getPlayerAndRoom(socket: Socket): { player: PlayerSession; room: GameRoom } | null {
        const player = this.players.get(socket.id);
        if (!player || !player.roomId) {
            this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
            return null;
        }

        const room = this.rooms.get(player.roomId);
        if (!room) {
            this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
            return null;
        }

        return { player, room };
    }

    // ==================== 房间管理 ====================

    /**
     * 处理创建房间
     */
    private handleCreateRoom(socket: Socket, data: CreateRoomRequest): void {
        try {
            // 验证并净化玩家名称
            const sanitizedName = this.validateAndSanitizePlayerName(socket, data.playerName);
            if (!sanitizedName) return;

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
                playerName: player.name,
                maxPlayers: room.maxPlayers
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
            // 验证并净化玩家名称
            const sanitizedName = this.validateAndSanitizePlayerName(socket, data.playerName);
            if (!sanitizedName) return;

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
                players: room.getPlayersInfo(),
                maxPlayers: room.maxPlayers
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
     * 处理重连房间
     */
    private handleReconnect(socket: Socket, data: ReconnectRequest): void {
        try {
            console.log(`[GameServer] Reconnect request: playerId=${data.playerId}, roomId=${data.roomId}`);

            // 验证玩家名称
            if (!this.validateAndSanitizePlayerName(socket, data.playerName)) return;

            const room = this.rooms.get(data.roomId);
            if (!room) {
                this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
                return;
            }

            // 检查房间是否在游戏中
            if (room.state !== 'playing') {
                this.sendError(socket, ErrorCode.INVALID_PLAY, 'Room is not in playing state');
                return;
            }

            // 查找断线的玩家
            const disconnectedPlayer = this.disconnectedPlayers.get(data.playerId);
            if (!disconnectedPlayer) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Player session not found');
                return;
            }

            // 检查玩家是否在房间中
            const playerInRoom = room.getPlayer(data.playerId);
            if (!playerInRoom) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Player not in room');
                return;
            }

            // 更新玩家的socket连接
            disconnectedPlayer.socket = socket;
            disconnectedPlayer.isConnected = true;
            disconnectedPlayer.updateHeartbeat();

            // 从断线列表移除，加入在线列表
            this.disconnectedPlayers.delete(data.playerId);
            this.players.set(socket.id, disconnectedPlayer);

            // Socket加入房间
            socket.join(room.id);

            // 发送重连成功响应
            const response: RoomJoinedEvent = {
                roomId: room.id,
                playerId: disconnectedPlayer.id,
                myPlayerIdInRoom: disconnectedPlayer.id,
                hostId: room.getHostId(),
                players: room.getPlayersInfo(),
                maxPlayers: room.maxPlayers
            };

            socket.emit(ServerMessageType.ROOM_JOINED, response);

            // 广播给其他玩家：玩家重连
            room.broadcast(ServerMessageType.PLAYER_JOINED, {
                player: disconnectedPlayer.getInfo()
            }, disconnectedPlayer.id);

            // 关闭该玩家的托管模式（如果之前自动开启了）
            room.handleSetAuto(disconnectedPlayer.id, false);

            console.log(`[GameServer] Player ${data.playerName} reconnected to room ${room.id}`);
        } catch (error) {
            console.error('[GameServer] Error reconnecting:', error);
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to reconnect');
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
        const { player: removedPlayer, newHostId } = room.removePlayer(player.id);

        // Socket 离开房间
        socket.leave(room.id);

        // 广播给其他玩家：玩家离开
        const leftEvent: PlayerLeftEvent = {
            playerId: player.id
        };
        room.broadcast(ServerMessageType.PLAYER_LEFT, leftEvent);

        // 如果房主变更，广播房主变更事件和新房主的准备状态
        if (newHostId) {
            const hostChangedEvent: HostChangedEvent = {
                newHostId
            };
            room.broadcast(ServerMessageType.HOST_CHANGED, hostChangedEvent);
            console.log(`[GameServer] Broadcasting HOST_CHANGED: ${newHostId}`);

            // 广播新房主的准备状态（新房主自动准备）
            const readyEvent: PlayerReadyEvent = {
                playerId: newHostId,
                isReady: true
            };
            room.broadcast(ServerMessageType.PLAYER_READY, readyEvent);
            console.log(`[GameServer] Broadcasting new host ready state: ${newHostId}`);
        }

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

    /**
     * 处理重启游戏
     */
    private handleRestartGame(socket: Socket): void {
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

        console.log(`[GameServer] Player ${player.name} clicked restart game`);

        // 立即设置该玩家为已准备
        room.setPlayerReady(player.id, true);

        // 立即广播该玩家已准备（类似READY消息）
        const readyEvent: PlayerReadyEvent = {
            playerId: player.id,
            isReady: true
        };
        room.broadcast(ServerMessageType.PLAYER_READY, readyEvent);
        console.log(`[GameServer] Player ${player.name} is ready for restart`);

        // 记录该玩家想要重启
        const allPlayersReady = room.playerWantsRestart(player.id);

        if (allPlayersReady) {
            // 所有人都点击了，执行游戏状态清理
            console.log(`[GameServer] All players ready, cleaning up game state...`);
            const success = room.restartGame();
            if (!success) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to restart game');
                return;
            }
            console.log(`[GameServer] Room ${room.id} game state cleaned up`);

            // 不自动启动游戏，等待房主点击"开始游戏"按钮
            console.log(`[GameServer] Waiting for host to start the game...`);
        } else {
            // 还有人没点击，等待其他玩家
            console.log(`[GameServer] Waiting for other players to click restart...`);
        }
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
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

        // Verify player ID matches
        if (data.playerId !== player.id) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        // 验证卡牌数据
        if (!this.validateCards(socket, data.cards)) return;

        // Handle play cards in room
        const success = room.handlePlayCards(player.id, data.cards);

        console.log(`[GameServer] Player ${player.name} played ${data.cards.length} cards (${success ? 'success' : 'failed'})`);
    }

    /**
     * 验证卡牌数组
     * @returns true 如果有效，false 如果无效
     */
    private validateCards(socket: Socket, cards: unknown): cards is number[] {
        // 检查是否为数组
        if (!Array.isArray(cards)) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Invalid cards format');
            return false;
        }

        // 检查是否为空
        if (cards.length === 0) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'No cards provided');
            return false;
        }

        // 检查数量限制（最多3张）
        if (cards.length > 3) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Too many cards');
            return false;
        }

        // 检查每张卡牌的有效性
        for (const card of cards) {
            if (typeof card !== 'number' || !this.isValidCardValue(card)) {
                this.sendError(socket, ErrorCode.INVALID_PLAY, 'Invalid card value');
                return false;
            }
        }

        // 检查是否有重复的卡牌
        const uniqueCards = new Set(cards);
        if (uniqueCards.size !== cards.length) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Duplicate cards');
            return false;
        }

        return true;
    }

    /**
     * 检查卡牌值是否有效
     * 卡牌格式: 高4位为花色(0x00-0x40)，低4位为点数(3-15 或 1-2 for jokers)
     */
    private isValidCardValue(card: number): boolean {
        if (!Number.isInteger(card) || card < 0 || card > 0xFF) {
            return false;
        }

        const suit = card & 0xF0;
        const point = card & 0x0F;

        // 大小王
        if (suit === 0x40) {
            return point === 0x01 || point === 0x02; // BLACK_JOKER or RED_JOKER
        }

        // 普通牌：花色 0x00-0x30，点数 3-15
        if (suit <= 0x30) {
            return point >= 3 && point <= 15;
        }

        return false;
    }

    /**
     * 处理设置托管
     */
    private handleSetAuto(socket: Socket, data: SetAutoRequest): void {
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

        // Handle set auto in room
        const success = room.handleSetAuto(player.id, data.isAuto);

        console.log(`[GameServer] Player ${player.name} ${data.isAuto ? 'enabled' : 'disabled'} auto mode (${success ? 'success' : 'failed'})`);
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
            const room = this.rooms.get(player.roomId);

            // 标记为断线
            player.isConnected = false;

            // 如果房间在游戏中，保存玩家信息允许重连，并自动开启托管
            if (room && room.state === 'playing') {
                console.log(`[GameServer] Player ${player.name} disconnected during game, enabling auto mode`);

                // 保存到断线列表（使用玩家ID作为key，而不是socket.id）
                this.disconnectedPlayers.set(player.id, player);

                // 从在线列表移除
                this.players.delete(socket.id);

                // 自动开启托管
                room.handleSetAuto(player.id, true);

                // 广播玩家断线（但不移除）
                room.broadcast(ServerMessageType.PLAYER_LEFT, {
                    playerId: player.id
                });

                console.log(`[GameServer] Player ${player.name} saved for reconnection (5 min timeout)`);
            } else {
                // 不在游戏中，直接离开房间
                this.handleLeaveRoom(socket);
            }
        }
    }

    /**
     * 启动心跳检测
     */
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            try {
                const now = Date.now();

                // 检查玩家超时
                for (const [id, player] of this.players) {
                    if (player.isTimeout(ServerConfig.PLAYER_DISCONNECT_TIMEOUT)) {
                        console.log(`[GameServer] Player ${player.name} timeout, removing...`);
                        this.handleLeaveRoom(player.socket);
                    }
                }

                // 检查断线玩家超时（5分钟）
                const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5分钟
                for (const [playerId, player] of this.disconnectedPlayers) {
                    if (now - player.lastHeartbeat > RECONNECT_TIMEOUT) {
                        console.log(`[GameServer] Disconnected player ${player.name} timeout, removing...`);

                        // 从房间移除
                        if (player.roomId) {
                            const room = this.rooms.get(player.roomId);
                            if (room) {
                                room.removePlayer(playerId);

                                // 广播玩家离开
                                room.broadcast(ServerMessageType.PLAYER_LEFT, {
                                    playerId: playerId
                                });

                                // 如果房间为空，删除房间
                                if (room.isEmpty()) {
                                    this.rooms.delete(room.id);
                                    console.log(`[GameServer] Room ${room.id} deleted (empty)`);
                                }
                            }
                        }

                        // 从断线列表移除
                        this.disconnectedPlayers.delete(playerId);
                    }
                }

                // 检查空闲房间
                for (const [id, room] of this.rooms) {
                    if (room.isEmpty() || room.isIdle(ServerConfig.ROOM_IDLE_TIMEOUT)) {
                        console.log(`[GameServer] Room ${id} idle, removing...`);
                        this.rooms.delete(id);
                    }
                }
            } catch (error) {
                console.error('[GameServer] Heartbeat error:', error);
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
