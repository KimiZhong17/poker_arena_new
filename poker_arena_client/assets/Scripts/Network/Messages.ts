/**
 * 消息类型定义
 * 客户端 ↔ 服务器通信协议
 */

// ==================== 客户端 → 服务器 ====================

/**
 * 客户端请求类型
 */
export enum ClientMessageType {
    // 房间相关
    CREATE_ROOM = 'create_room',
    JOIN_ROOM = 'join_room',
    LEAVE_ROOM = 'leave_room',
    READY = 'ready',

    // 游戏操作
    DEALER_CALL = 'dealer_call',
    PLAY_CARDS = 'play_cards',

    // 心跳
    PING = 'ping'
}

/**
 * 创建房间请求
 */
export interface CreateRoomRequest {
    playerName: string;
    gameMode: 'the_decree';
    maxPlayers: number;
}

/**
 * 加入房间请求
 */
export interface JoinRoomRequest {
    roomId: string;
    playerName: string;
}

/**
 * 庄家叫牌请求
 */
export interface DealerCallRequest {
    roomId: string;
    playerId: string;
    cardsToPlay: 1 | 2 | 3;
}

/**
 * 玩家出牌请求
 */
export interface PlayCardsRequest {
    roomId: string;
    playerId: string;
    cards: number[];
}

// ==================== 服务器 → 客户端 ====================

/**
 * 服务器事件类型
 */
export enum ServerMessageType {
    // 房间相关
    ROOM_CREATED = 'room_created',
    ROOM_JOINED = 'room_joined',
    PLAYER_JOINED = 'player_joined',
    PLAYER_LEFT = 'player_left',
    PLAYER_READY = 'player_ready',

    // 游戏状态
    GAME_START = 'game_start',
    GAME_STATE_UPDATE = 'game_state_update',
    DEALER_SELECTED = 'dealer_selected',
    DEALER_CALLED = 'dealer_called',

    // 发牌
    DEAL_CARDS = 'deal_cards',
    COMMUNITY_CARDS = 'community_cards',

    // 玩家操作
    PLAYER_PLAYED = 'player_played',

    // 回合结果
    SHOWDOWN = 'showdown',
    ROUND_END = 'round_end',

    // 游戏结束
    GAME_OVER = 'game_over',

    // 错误
    ERROR = 'error',

    // 心跳
    PONG = 'pong'
}

/**
 * 房间创建成功响应
 */
export interface RoomCreatedEvent {
    roomId: string;
    playerId: string;
    playerName: string;
}

/**
 * 加入房间成功响应
 */
export interface RoomJoinedEvent {
    roomId: string;
    playerId: string;
    players: PlayerInfo[];
}

/**
 * 玩家信息
 */
export interface PlayerInfo {
    id: string;
    name: string;
    seatIndex: number;
    isReady: boolean;
    isHost: boolean;
}

/**
 * 玩家加入房间事件
 */
export interface PlayerJoinedEvent {
    player: PlayerInfo;
}

/**
 * 玩家离开房间事件
 */
export interface PlayerLeftEvent {
    playerId: string;
}

/**
 * 玩家准备事件
 */
export interface PlayerReadyEvent {
    playerId: string;
    isReady: boolean;
}

/**
 * 游戏开始事件
 */
export interface GameStartEvent {
    players: PlayerInfo[];
}

/**
 * 发牌事件（只发给对应玩家）
 */
export interface DealCardsEvent {
    playerId: string;
    handCards: number[];
}

/**
 * 公共牌事件（广播）
 */
export interface CommunityCardsEvent {
    cards: number[];
}

/**
 * 庄家选择事件
 */
export interface DealerSelectedEvent {
    dealerId: string;
    roundNumber: number;
}

/**
 * 庄家叫牌事件
 */
export interface DealerCalledEvent {
    dealerId: string;
    cardsToPlay: number;
}

/**
 * 玩家出牌事件（广播）
 */
export interface PlayerPlayedEvent {
    playerId: string;
    cardCount: number;
}

/**
 * 摊牌结果
 */
export interface ShowdownResult {
    playerId: string;
    cards: number[];
    handType: number;
    handTypeName: string;
    score: number;
    isWinner: boolean;
}

/**
 * 摊牌事件
 */
export interface ShowdownEvent {
    results: ShowdownResult[];
}

/**
 * 回合结束事件
 */
export interface RoundEndEvent {
    winnerId: string;
    loserId: string;
    scores: { [playerId: string]: number };
}

/**
 * 游戏结束事件
 */
export interface GameOverEvent {
    winnerId: string;
    scores: { [playerId: string]: number };
    totalRounds: number;
}

/**
 * 游戏状态更新事件
 */
export interface GameStateUpdateEvent {
    state: string;
    roundNumber: number;
    dealerId?: string;
    cardsToPlay?: number;
    deckSize: number;
}

/**
 * 错误事件
 */
export interface ErrorEvent {
    code: string;
    message: string;
}

// ==================== 错误码 ====================

export enum ErrorCode {
    ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
    ROOM_FULL = 'ROOM_FULL',
    INVALID_PLAY = 'INVALID_PLAY',
    NOT_YOUR_TURN = 'NOT_YOUR_TURN',
    GAME_NOT_STARTED = 'GAME_NOT_STARTED',
    ALREADY_PLAYED = 'ALREADY_PLAYED',
    INVALID_CARDS = 'INVALID_CARDS',
    NOT_DEALER = 'NOT_DEALER',
    INTERNAL_ERROR = 'INTERNAL_ERROR'
}
