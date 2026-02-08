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
    START_GAME = 'start_game',
    RESTART_GAME = 'restart_game',
    RECONNECT = 'reconnect',  // 重连到房间

    // 游戏操作
    DEALER_CALL = 'dealer_call',
    PLAY_CARDS = 'play_cards',
    SELECT_FIRST_DEALER_CARD = 'select_first_dealer_card',

    // 托管
    SET_AUTO = 'set_auto',

    // 心跳
    PING = 'ping'
}

/**
 * 创建房间请求
 */
export interface CreateRoomRequest {
    playerName: string;
    guestId?: string;  // 客户端持久化的游客ID，用于识别同一用户
    gameMode: 'the_decree';
    maxPlayers: number;
}

/**
 * 加入房间请求
 */
export interface JoinRoomRequest {
    roomId: string;
    playerName: string;
    guestId?: string;  // 客户端持久化的游客ID，用于识别同一用户
}

/**
 * 重连房间请求
 */
export interface ReconnectRequest {
    roomId: string;
    playerId?: string;  // 原来的玩家ID（已废弃，保留兼容）
    guestId?: string;   // 客户端持久化的游客ID，优先使用
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

/**
 * 选择首个庄家的牌请求
 */
export interface SelectFirstDealerCardRequest {
    roomId: string;
    playerId: string;
    card: number;
}

/**
 * 设置托管请求
 */
export interface SetAutoRequest {
    isAuto: boolean;
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
    HOST_CHANGED = 'host_changed',

    // 游戏状态
    GAME_START = 'game_start',
    GAME_RESTART = 'game_restart',
    GAME_STATE_UPDATE = 'game_state_update',
    REQUEST_FIRST_DEALER_SELECTION = 'request_first_dealer_selection',
    PLAYER_SELECTED_CARD = 'player_selected_card',
    FIRST_DEALER_REVEAL = 'first_dealer_reveal',
    DEALER_SELECTED = 'dealer_selected',
    DEALER_CALLED = 'dealer_called',

    // 发牌
    DEAL_CARDS = 'deal_cards',
    COMMUNITY_CARDS = 'community_cards',

    // 玩家操作
    PLAYER_PLAYED = 'player_played',

    // 托管
    PLAYER_AUTO_CHANGED = 'player_auto_changed',

    // 回合结果
    SHOWDOWN = 'showdown',
    ROUND_END = 'round_end',

    // 游戏结束
    GAME_OVER = 'game_over',

    // 重连
    RECONNECT_SUCCESS = 'reconnect_success',

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
    maxPlayers: number;
}

/**
 * 加入房间成功响应
 */
export interface RoomJoinedEvent {
    roomId: string;
    playerId: string;
    myPlayerIdInRoom: string;  // 当前玩家在房间内的ID
    hostId: string;            // 房主ID
    players: PlayerInfo[];
    maxPlayers: number;
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
 * 房主变更事件
 */
export interface HostChangedEvent {
    newHostId: string;
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
    allHandCounts?: { [playerId: string]: number };  // 所有玩家的手牌数量（补牌后发送）
    deckSize?: number;  // 牌堆剩余数量
}

/**
 * 公共牌事件（广播）
 */
export interface CommunityCardsEvent {
    cards: number[];
    gameState: string;  // TheDecreeGameState
}

/**
 * 请求玩家选择首个庄家的牌
 */
export interface RequestFirstDealerSelectionEvent {
    gameState: string;  // TheDecreeGameState
}

/**
 * 玩家已选择牌事件（广播）
 */
export interface PlayerSelectedCardEvent {
    playerId: string;
}

/**
 * 首个庄家揭晓事件
 */
export interface FirstDealerRevealEvent {
    selections: {
        playerId: string;
        card: number;
    }[];
    dealerId: string;
    gameState: string;  // TheDecreeGameState
}

/**
 * 庄家选择事件
 */
export interface DealerSelectedEvent {
    dealerId: string;
    roundNumber: number;
    gameState: string;  // TheDecreeGameState
}

/**
 * 庄家叫牌事件
 */
export interface DealerCalledEvent {
    dealerId: string;
    cardsToPlay: number;
    gameState: string;  // TheDecreeGameState
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
    gameState: string;  // TheDecreeGameState
}

/**
 * 回合结束事件
 */
export interface RoundEndEvent {
    winnerId: string;
    loserId: string;
    scores: { [playerId: string]: number };
    gameState: string;  // TheDecreeGameState
}

/**
 * 游戏结束事件
 */
export interface GameOverEvent {
    winnerId: string;
    scores: { [playerId: string]: number };
    totalRounds: number;
    gameState: string;  // TheDecreeGameState
}

/**
 * 游戏状态更新事件（快照同步）
 * 当玩家重连、进入房间或发现本地张数不对时，由服务器下发全量数据
 */
export interface GameStateUpdateEvent {
    state: string;           // 对应 StageManager 的状态
    roundNumber: number;
    dealerId?: string;
    cardsToPlay?: number;
    deckSize: number;
    
    // --- 新增：确保所有玩家的基础信息同步 ---
    players: {
        id: string;
        cardCount: number;   // 核心：同步每个人剩几张牌
        isReady: boolean;
        isTurn: boolean;
        seatIndex: number;
    }[];
    
    lastPlayedCards?: number[]; // 桌面上当前没人管的最大牌
    lastPlayerId?: string;      // 谁出的最后一把牌
}

/**
 * 错误事件
 */
export interface ErrorEvent {
    code: string;
    message: string;
}

/**
 * 玩家托管状态变化事件
 */
export interface PlayerAutoChangedEvent {
    playerId: string;
    isAuto: boolean;
    reason?: 'manual' | 'timeout' | 'disconnect';
}

/**
 * 重连成功事件 - 包含完整游戏状态
 */
export interface ReconnectSuccessEvent {
    // 房间基本信息
    roomId: string;
    playerId: string;
    myPlayerIdInRoom: string;
    hostId: string;
    players: PlayerInfo[];
    maxPlayers: number;

    // 游戏状态
    gameState: string;  // TheDecreeGameState
    roundNumber: number;
    dealerId?: string;
    cardsToPlay?: number;
    deckSize: number;

    // 玩家自己的手牌
    handCards: number[];

    // 公共牌
    communityCards: number[];

    // 各玩家分数
    scores: { [playerId: string]: number };

    // 各玩家游戏状态
    playerGameStates: {
        playerId: string;
        handCardCount: number;
        hasPlayed: boolean;
        playedCardCount: number;
        isAuto: boolean;
    }[];
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
