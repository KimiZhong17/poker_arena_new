import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameRoom } from './GameRoom';
import { PlayerSession } from './PlayerSession';
import { ServerConfig } from '../config/ServerConfig';
import { IdValidator } from '../utils/IdValidator';
import { RateLimiter, RateLimitPresets } from '../utils/RateLimiter';
import { Logger } from '../utils/Logger';
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
    ReconnectSuccessEvent,
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

        Logger.info('GameServer', 'Initialized');
    }

    /**
     * 设置 Socket.IO 事件处理器
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            Logger.info('GameServer', `Client connected: ${socket.id}`);

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
            Logger.warn('GameServer', `Rate limit exceeded for ${socket.id} (${type})`);
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
            Logger.warn('GameServer', `Invalid player name: ${playerName}`);
            return null;
        }

        // 如果是游客ID格式，验证其合法性
        if (playerName.startsWith('guest_')) {
            if (!IdValidator.isValidGuestId(playerName)) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Invalid guest ID format');
                Logger.warn('GameServer', `Invalid guest ID format: ${playerName}`);
                return null;
            }
            Logger.debug('GameServer', `Guest ID validated: ${playerName}`);
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

            // 创建玩家会话（使用净化后的名称和guestId）
            const player = new PlayerSession(socket, sanitizedName, data.guestId);
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

            Logger.info('GameServer', `Room created: ${room.id} by ${sanitizedName}`);
        } catch (error) {
            Logger.error('GameServer', 'Error creating room:', error);
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to create room');
        }
    }

    /**
     * 处理加入房间
     * 如果玩家（通过guestId）已经在对局中断线，自动处理为重连
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

            // 检查是否是重连场景（通过guestId查找）
            if (data.guestId && room.state === 'playing') {
                // 先检查断线玩家列表
                const reconnectResult = this.tryReconnectByGuestId(socket, data.guestId, room, sanitizedName);
                if (reconnectResult) {
                    return; // 重连成功，直接返回
                }

                // 再检查在线玩家列表（处理刷新页面时新socket先于旧socket断开的情况）
                const onlineReconnectResult = this.tryReconnectOnlinePlayer(socket, data.guestId, room, sanitizedName);
                if (onlineReconnectResult) {
                    return; // 重连成功，直接返回
                }
            }

            // 正常加入逻辑
            if (room.isFull()) {
                this.sendError(socket, ErrorCode.ROOM_FULL, 'Room is full');
                return;
            }

            // 创建玩家会话（使用净化后的名称和guestId）
            const player = new PlayerSession(socket, sanitizedName, data.guestId);
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

            Logger.info('GameServer', `Player ${sanitizedName} joined room ${room.id}`);
        } catch (error) {
            Logger.error('GameServer', 'Error joining room:', error);
            this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to join room');
        }
    }

    /**
     * 尝试通过guestId重连到房间
     * @returns true 如果重连成功，false 如果不是重连场景
     */
    private tryReconnectByGuestId(socket: Socket, guestId: string, room: GameRoom, playerName: string): boolean {
        // 通过 guestId 查找断线的玩家
        let disconnectedPlayer: PlayerSession | undefined;
        let originalPlayerId: string | undefined;

        for (const [playerId, player] of this.disconnectedPlayers) {
            if (player.guestId === guestId && player.roomId === room.id) {
                disconnectedPlayer = player;
                originalPlayerId = playerId;
                Logger.info('GameServer', `Found disconnected player by guestId: ${guestId}`);
                break;
            }
        }

        if (!disconnectedPlayer || !originalPlayerId) {
            return false; // 不是重连场景
        }

        // 检查玩家是否在房间中
        const playerInRoom = room.getPlayer(originalPlayerId);
        if (!playerInRoom) {
            return false;
        }

        // 更新玩家的socket连接
        disconnectedPlayer.socket = socket;
        disconnectedPlayer.isConnected = true;
        disconnectedPlayer.updateHeartbeat();

        // 从断线列表移除，加入在线列表
        this.disconnectedPlayers.delete(originalPlayerId);
        this.players.set(socket.id, disconnectedPlayer);

        // Socket加入房间
        socket.join(room.id);

        // 获取完整游戏状态
        const reconnectState = room.getReconnectState(disconnectedPlayer.id);

        // 发送重连成功响应（包含完整游戏状态）
        const response: ReconnectSuccessEvent = {
            roomId: room.id,
            playerId: disconnectedPlayer.id,
            myPlayerIdInRoom: disconnectedPlayer.id,
            hostId: room.getHostId(),
            players: room.getPlayersInfo(),
            maxPlayers: room.maxPlayers,
            // 游戏状态
            gameState: reconnectState.gameState,
            roundNumber: reconnectState.roundNumber,
            dealerId: reconnectState.dealerId,
            cardsToPlay: reconnectState.cardsToPlay,
            deckSize: reconnectState.deckSize,
            handCards: reconnectState.handCards,
            communityCards: reconnectState.communityCards,
            scores: reconnectState.scores,
            playerGameStates: reconnectState.playerGameStates
        };

        socket.emit(ServerMessageType.RECONNECT_SUCCESS, response);

        // 广播给其他玩家：玩家重连
        room.broadcast(ServerMessageType.PLAYER_JOINED, {
            player: disconnectedPlayer.getInfo()
        }, disconnectedPlayer.id);

        // 关闭该玩家的托管模式
        room.handleSetAuto(disconnectedPlayer.id, false);

        Logger.info('GameServer', `Player ${playerName} auto-reconnected to room ${room.id} via JOIN_ROOM`);
        return true;
    }

    /**
     * 尝试重连在线玩家（处理刷新页面时新socket先于旧socket断开的情况）
     * @returns true 如果重连成功，false 如果不是重连场景
     */
    private tryReconnectOnlinePlayer(socket: Socket, guestId: string, room: GameRoom, playerName: string): boolean {
        // 通过 guestId 查找在线玩家
        let existingPlayer: PlayerSession | undefined;
        let oldSocketId: string | undefined;

        for (const [socketId, player] of this.players) {
            if (player.guestId === guestId && player.roomId === room.id) {
                existingPlayer = player;
                oldSocketId = socketId;
                Logger.info('GameServer', `Found online player by guestId: ${guestId}, replacing socket`);
                break;
            }
        }

        if (!existingPlayer || !oldSocketId) {
            return false; // 不是重连场景
        }

        // 检查玩家是否在房间中
        const playerInRoom = room.getPlayer(existingPlayer.id);
        if (!playerInRoom) {
            return false;
        }

        // 关闭旧的 socket 连接
        const oldSocket = existingPlayer.socket;
        if (oldSocket && oldSocket.id !== socket.id) {
            oldSocket.leave(room.id);
            oldSocket.disconnect(true);
            Logger.info('GameServer', `Disconnected old socket: ${oldSocketId}`);
        }

        // 更新玩家的 socket 连接
        existingPlayer.socket = socket;
        existingPlayer.isConnected = true;
        existingPlayer.updateHeartbeat();

        // 更新房间中的玩家 ID 映射
        const oldPlayerId = existingPlayer.id;
        room.updatePlayerSocketId(oldPlayerId, socket.id);

        // 从旧的 socketId 移除，用新的 socketId 重新注册
        this.players.delete(oldSocketId);
        this.players.set(socket.id, existingPlayer);

        // Socket 加入房间
        socket.join(room.id);

        // 获取完整游戏状态（使用新的 playerId）
        const reconnectState = room.getReconnectState(socket.id);

        // 发送重连成功响应（包含完整游戏状态）
        const response: ReconnectSuccessEvent = {
            roomId: room.id,
            playerId: existingPlayer.id,
            myPlayerIdInRoom: existingPlayer.id,
            hostId: room.getHostId(),
            players: room.getPlayersInfo(),
            maxPlayers: room.maxPlayers,
            // 游戏状态
            gameState: reconnectState.gameState,
            roundNumber: reconnectState.roundNumber,
            dealerId: reconnectState.dealerId,
            cardsToPlay: reconnectState.cardsToPlay,
            deckSize: reconnectState.deckSize,
            handCards: reconnectState.handCards,
            communityCards: reconnectState.communityCards,
            scores: reconnectState.scores,
            playerGameStates: reconnectState.playerGameStates
        };

        socket.emit(ServerMessageType.RECONNECT_SUCCESS, response);

        Logger.info('GameServer', `Player ${playerName} reconnected (socket replaced) to room ${room.id} via JOIN_ROOM`);
        return true;
    }

    /**
     * 处理重连房间
     */
    private handleReconnect(socket: Socket, data: ReconnectRequest): void {
        try {
            Logger.info('GameServer', `Reconnect request: guestId=${data.guestId}, playerId=${data.playerId}, roomId=${data.roomId}`);

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

            // 优先使用 guestId 查找断线的玩家，其次使用 playerId
            let disconnectedPlayer: PlayerSession | undefined;
            let originalPlayerId: string | undefined;

            if (data.guestId) {
                // 通过 guestId 查找
                for (const [playerId, player] of this.disconnectedPlayers) {
                    if (player.guestId === data.guestId) {
                        disconnectedPlayer = player;
                        originalPlayerId = playerId;
                        Logger.info('GameServer', `Found disconnected player by guestId: ${data.guestId}`);
                        break;
                    }
                }
            }

            // 如果 guestId 没找到，尝试用 playerId（向后兼容）
            if (!disconnectedPlayer && data.playerId) {
                disconnectedPlayer = this.disconnectedPlayers.get(data.playerId);
                originalPlayerId = data.playerId;
            }

            if (!disconnectedPlayer || !originalPlayerId) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Player session not found');
                return;
            }

            // 检查玩家是否在房间中
            const playerInRoom = room.getPlayer(originalPlayerId);
            if (!playerInRoom) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Player not in room');
                return;
            }

            // 更新玩家的socket连接
            disconnectedPlayer.socket = socket;
            disconnectedPlayer.isConnected = true;
            disconnectedPlayer.updateHeartbeat();

            // 从断线列表移除，加入在线列表
            this.disconnectedPlayers.delete(originalPlayerId);
            this.players.set(socket.id, disconnectedPlayer);

            // Socket加入房间
            socket.join(room.id);

            // 获取完整游戏状态
            const reconnectState = room.getReconnectState(disconnectedPlayer.id);

            // 发送重连成功响应（包含完整游戏状态）
            const response: ReconnectSuccessEvent = {
                roomId: room.id,
                playerId: disconnectedPlayer.id,
                myPlayerIdInRoom: disconnectedPlayer.id,
                hostId: room.getHostId(),
                players: room.getPlayersInfo(),
                maxPlayers: room.maxPlayers,
                // 游戏状态
                gameState: reconnectState.gameState,
                roundNumber: reconnectState.roundNumber,
                dealerId: reconnectState.dealerId,
                cardsToPlay: reconnectState.cardsToPlay,
                deckSize: reconnectState.deckSize,
                handCards: reconnectState.handCards,
                communityCards: reconnectState.communityCards,
                scores: reconnectState.scores,
                playerGameStates: reconnectState.playerGameStates
            };

            socket.emit(ServerMessageType.RECONNECT_SUCCESS, response);

            // 广播给其他玩家：玩家重连
            room.broadcast(ServerMessageType.PLAYER_JOINED, {
                player: disconnectedPlayer.getInfo()
            }, disconnectedPlayer.id);

            // 关闭该玩家的托管模式（如果之前自动开启了）
            room.handleSetAuto(disconnectedPlayer.id, false);

            Logger.info('GameServer', `Player ${data.playerName} reconnected to room ${room.id}`);
        } catch (error) {
            Logger.error('GameServer', 'Error reconnecting:', error);
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

        // 游戏中离开：按断线处理，保留座位并进入托管
        if (room.state === 'playing') {
            Logger.info('GameServer', `Player ${player.name} left during game, switching to auto mode`);

            player.isConnected = false;

            // 保存断线信息，允许重连
            this.disconnectedPlayers.set(player.id, player);

            // 从在线列表移除
            this.players.delete(socket.id);

            // Socket 离开房间
            socket.leave(room.id);

            // 自动开启托管（会广播 PLAYER_AUTO_CHANGED）
            room.handleSetAuto(player.id, true);

            // 如果所有玩家都断线，销毁房间
            this.checkAndDestroyEmptyRoom(room);
            return;
        }

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
            Logger.info('GameServer', `Broadcasting HOST_CHANGED: ${newHostId}`);

            // 广播新房主的准备状态（新房主自动准备）
            const readyEvent: PlayerReadyEvent = {
                playerId: newHostId,
                isReady: true
            };
            room.broadcast(ServerMessageType.PLAYER_READY, readyEvent);
            Logger.debug('GameServer', `Broadcasting new host ready state: ${newHostId}`);
        }

        // 如果房间为空，删除房间
        if (room.isEmpty()) {
            this.rooms.delete(room.id);
            Logger.info('GameServer', `Room ${room.id} deleted (empty)`);
        }

        // 删除玩家会话
        this.players.delete(socket.id);

        Logger.info('GameServer', `Player ${player.name} left room ${room.id}`);
    }

    /**
     * 处理玩家准备
     */
    private handleReady(socket: Socket): void {
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

        // 切换准备状态
        const isReady = !player.isReady;
        room.setPlayerReady(player.id, isReady);

        // 广播准备状态
        const event: PlayerReadyEvent = {
            playerId: player.id,
            isReady
        };

        room.broadcast(ServerMessageType.PLAYER_READY, event);

        Logger.info('GameServer', `Player ${player.name} ready: ${isReady}`);
    }

    /**
     * 处理开始游戏请求（房主触发）
     */
    private handleStartGame(socket: Socket): void {
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

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
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

        Logger.debug('GameServer', `Player ${player.name} clicked restart game`);

        // 立即设置该玩家为已准备
        room.setPlayerReady(player.id, true);

        // 立即广播该玩家已准备（类似READY消息）
        const readyEvent: PlayerReadyEvent = {
            playerId: player.id,
            isReady: true
        };
        room.broadcast(ServerMessageType.PLAYER_READY, readyEvent);
        Logger.debug('GameServer', `Player ${player.name} is ready for restart`);

        // 记录该玩家想要重启
        const allPlayersReady = room.playerWantsRestart(player.id);

        if (allPlayersReady) {
            // 所有人都点击了，执行游戏状态清理
            Logger.info('GameServer', `All players ready, cleaning up game state...`);
            const success = room.restartGame();
            if (!success) {
                this.sendError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to restart game');
                return;
            }
            Logger.info('GameServer', `Room ${room.id} game state cleaned up`);

            // 不自动启动游戏，等待房主点击"开始游戏"按钮
            Logger.debug('GameServer', `Waiting for host to start the game...`);
        } else {
            // 还有人没点击，等待其他玩家
            Logger.debug('GameServer', `Waiting for other players to click restart...`);
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

        Logger.info('GameServer', `Game started in room ${room.id}`);
    }

    /**
     * 处理选择首个庄家的牌
     */
    private handleSelectFirstDealerCard(socket: Socket, data: SelectFirstDealerCardRequest): void {
        Logger.debug('GameServer', `========== handleSelectFirstDealerCard ==========`);
        Logger.debug('GameServer', `Received data:`, data);
        Logger.debug('GameServer', `Card: 0x${data.card.toString(16)}`);

        const result = this.getPlayerAndRoom(socket);
        if (!result) {
            Logger.error('GameServer', `✗ Player not found or not in room`);
            return;
        }
        const { player, room } = result;

        Logger.debug('GameServer', `Player: ${player.name} (${player.id})`);
        Logger.debug('GameServer', `Room ID: ${player.roomId}`);

        // Verify player ID matches
        if (data.playerId !== player.id) {
            Logger.error('GameServer', `✗ Player ID mismatch: ${data.playerId} !== ${player.id}`);
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        Logger.debug('GameServer', `Calling room.handleSelectFirstDealerCard...`);

        // Handle select card in room
        const success = room.handleSelectFirstDealerCard(player.id, data.card);

        Logger.info('GameServer', `Player ${player.name} selected card for first dealer (${success ? 'success' : 'failed'})`);
    }

    /**
     * 处理庄家叫牌
     */
    private handleDealerCall(socket: Socket, data: DealerCallRequest): void {
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

        // Verify player ID matches
        if (data.playerId !== player.id) {
            this.sendError(socket, ErrorCode.INVALID_PLAY, 'Player ID mismatch');
            return;
        }

        // Handle dealer call in room
        const success = room.handleDealerCall(player.id, data.cardsToPlay);

        Logger.info('GameServer', `Player ${player.name} dealer call: ${data.cardsToPlay} cards (${success ? 'success' : 'failed'})`);
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

        Logger.info('GameServer', `Player ${player.name} played ${data.cards.length} cards (${success ? 'success' : 'failed'})`);
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
        const result = this.getPlayerAndRoom(socket);
        if (!result) return;
        const { player, room } = result;

        // Handle set auto in room
        const success = room.handleSetAuto(player.id, data.isAuto);

        Logger.info('GameServer', `Player ${player.name} ${data.isAuto ? 'enabled' : 'disabled'} auto mode (${success ? 'success' : 'failed'})`);
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
        Logger.info('GameServer', `Client disconnected: ${socket.id}`);

        const player = this.players.get(socket.id);
        if (player && player.roomId) {
            const room = this.rooms.get(player.roomId);

            // 标记为断线
            player.isConnected = false;

            // 如果房间在游戏中，保存玩家信息允许重连，并自动开启托管
            if (room && room.state === 'playing') {
                Logger.info('GameServer', `Player ${player.name} disconnected during game, enabling auto mode`);

                // 保存到断线列表（使用玩家ID作为key，而不是socket.id）
                this.disconnectedPlayers.set(player.id, player);

                // 从在线列表移除
                this.players.delete(socket.id);

                // 自动开启托管
                room.handleSetAuto(player.id, true);

                Logger.info('GameServer', `Player ${player.name} saved for reconnection (5 min timeout)`);

                // 检查是否所有玩家都断线了，如果是则销毁房间
                this.checkAndDestroyEmptyRoom(room);
            } else {
                // 不在游戏中，直接离开房间
                this.handleLeaveRoom(socket);
            }
        }
    }

    /**
     * 检查房间是否所有玩家都断线了，如果是则销毁房间
     */
    private checkAndDestroyEmptyRoom(room: GameRoom): void {
        // 检查房间中是否还有在线玩家
        const allPlayers = room.getAllPlayers();
        const hasOnlinePlayer = allPlayers.some(p => p.isConnected);

        if (!hasOnlinePlayer) {
            Logger.info('GameServer', `All players disconnected from room ${room.id}, destroying room...`);

            // 从断线列表中移除该房间的所有玩家
            for (const player of allPlayers) {
                this.disconnectedPlayers.delete(player.id);
                Logger.debug('GameServer', `Removed disconnected player ${player.name} from list`);
            }

            // 销毁房间
            this.rooms.delete(room.id);
            Logger.info('GameServer', `Room ${room.id} destroyed (all players disconnected)`);
        }
    }

    /**
     * 启动心跳检测
     */
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            try {
                const now = Date.now();

                // 检查玩家超时 - 先收集要移除的玩家，避免在迭代时修改 Map
                const playersToRemove: string[] = [];
                for (const [id, player] of this.players) {
                    if (player.isTimeout(ServerConfig.PLAYER_DISCONNECT_TIMEOUT)) {
                        Logger.info('GameServer', `Player ${player.name} timeout, removing...`);
                        playersToRemove.push(id);
                    }
                }
                for (const socketId of playersToRemove) {
                    const player = this.players.get(socketId);
                    if (player) {
                        this.handleLeaveRoom(player.socket);
                        Logger.info('GameServer', `Player removed successfully`);
                    }
                }

                // 检查断线玩家超时（5分钟）- 先收集要移除的玩家
                const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5分钟
                const disconnectedToRemove: string[] = [];
                for (const [playerId, player] of this.disconnectedPlayers) {
                    if (now - player.lastHeartbeat > RECONNECT_TIMEOUT) {
                        Logger.info('GameServer', `Disconnected player ${player.name} timeout, removing...`);
                        disconnectedToRemove.push(playerId);
                    }
                }
                for (const playerId of disconnectedToRemove) {
                    const player = this.disconnectedPlayers.get(playerId);
                    if (player) {
                        // 从房间移除
                        if (player.roomId) {
                            const room = this.rooms.get(player.roomId);
                            if (room) {
                                room.removePlayer(playerId);

                                // 广播玩家离开
                                room.broadcast(ServerMessageType.PLAYER_LEFT, {
                                    playerId: playerId
                                });
                            }
                        }

                        // 从断线列表移除
                        this.disconnectedPlayers.delete(playerId);
                        Logger.info('GameServer', `Disconnected player ${player.name} removed successfully`);
                    }
                }

                // 检查空闲房间 - 先收集要删除的房间
                const roomsToRemove: string[] = [];
                for (const [id, room] of this.rooms) {
                    if (room.isEmpty() || room.isIdle(ServerConfig.ROOM_IDLE_TIMEOUT)) {
                        Logger.info('GameServer', `Room ${id} idle, removing...`);
                        roomsToRemove.push(id);
                    }
                }
                for (const roomId of roomsToRemove) {
                    this.rooms.delete(roomId);
                    Logger.info('GameServer', `Room ${roomId} removed successfully`);
                }
            } catch (error) {
                Logger.error('GameServer', 'Heartbeat error:', error);
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
        Logger.info('GameServer', 'Shutdown complete');
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
