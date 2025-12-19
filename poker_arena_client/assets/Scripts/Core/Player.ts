/**
 * Player state enumeration
 */
export enum PlayerState {
    WAITING = 0,        // Waiting for game to start
    PLAYING = 1,        // In game
    IDLE = 2,           // Idle (not current turn)
    THINKING = 3,       // Thinking (current turn)
    PASSED = 4,         // Passed this round
    FINISHED = 5        // Finished (no cards left)
}

/**
 * Player info in room
 * 玩家的"身份信息"（登录/房间相关）
 */
export interface PlayerInfo {
    id: string;           // 唯一标识（可以是网络ID）
    name: string;         // 用户名
    avatar?: string;      // 头像URL
    isReady: boolean;     // 是否准备（房间中）
    isHost: boolean;      // 是否房主
    seatIndex: number;    // 座位索引
}

/**
 * Player - 玩家游戏状态基类
 * 玩家的"游戏数据"
 *
 * 设计原则：
 * - 只包含数据和数据操作
 * - 不包含游戏规则逻辑（规则在 GameMode 中）
 * - 不包含 UI 逻辑（UI 在 PlayerUINode 中）
 * - 可以被子类扩展（如 TheDecreePlayer）
 */
export class Player {
    // 基础信息（来自 PlayerInfo）
    protected _info: PlayerInfo;

    // 游戏状态（所有玩法通用）
    protected _handCards: number[] = [];      // 手牌
    protected _score: number = 0;             // 分数
    protected _state: PlayerState = PlayerState.WAITING;
    protected _isDealer: boolean = false;     // 是否是庄家

    constructor(info: PlayerInfo) {
        this._info = info;
    }

    // ==================== 基础信息访问器 ====================

    get id(): string {
        return this._info.id;
    }

    get name(): string {
        return this._info.name;
    }

    get avatar(): string | undefined {
        return this._info.avatar;
    }

    get seatIndex(): number {
        return this._info.seatIndex;
    }

    get isReady(): boolean {
        return this._info.isReady;
    }

    get isHost(): boolean {
        return this._info.isHost;
    }

    /**
     * 获取 PlayerInfo（只读）
     */
    get info(): Readonly<PlayerInfo> {
        return this._info;
    }

    // ==================== 游戏状态访问器 ====================

    get handCards(): number[] {
        return this._handCards;
    }

    get score(): number {
        return this._score;
    }

    set score(value: number) {
        this._score = value;
    }

    get state(): PlayerState {
        return this._state;
    }

    set state(value: PlayerState) {
        this._state = value;
    }

    get isDealer(): boolean {
        return this._isDealer;
    }

    set isDealer(value: boolean) {
        this._isDealer = value;
    }

    get cardCount(): number {
        return this._handCards.length;
    }

    // ==================== 手牌数据操作（纯数据，无逻辑）====================

    /**
     * Set hand cards (usually after dealing)
     */
    public setHandCards(cards: number[]): void {
        this._handCards = [...cards];
    }

    /**
     * Add cards to hand
     */
    public addCards(cards: number[]): void {
        this._handCards.push(...cards);
    }

    /**
     * Remove cards from hand (after playing)
     */
    public removeCards(cards: number[]): void {
        cards.forEach(card => {
            const index = this._handCards.indexOf(card);
            if (index !== -1) {
                this._handCards.splice(index, 1);
            }
        });
    }

    /**
     * Check if player has specific cards
     */
    public hasCards(cards: number[]): boolean {
        const handCopy = [...this._handCards];
        for (const card of cards) {
            const index = handCopy.indexOf(card);
            if (index === -1) {
                return false;
            }
            handCopy.splice(index, 1);
        }
        return true;
    }

    /**
     * Clear all cards
     */
    public clearCards(): void {
        this._handCards = [];
    }

    /**
     * Sort hand cards by point value first, then by suit
     * Jokers are sorted to the end (rightmost)
     */
    public sortCards(levelRank: number = 0): void {
        this._handCards.sort((a, b) => {
            const suitA = a & 0xF0;
            const suitB = b & 0xF0;
            const pointA = a & 0x0F;
            const pointB = b & 0x0F;

            // Jokers (suit 0x40) always go to the end
            const isJokerA = suitA === 0x40;
            const isJokerB = suitB === 0x40;

            if (isJokerA && !isJokerB) return 1;
            if (!isJokerA && isJokerB) return -1;

            // Both are jokers: sort by point (Black Joker 0x01 < Red Joker 0x02)
            if (isJokerA && isJokerB) {
                return pointA - pointB;
            }

            // Neither are jokers: sort by point first, then by suit
            if (pointA !== pointB) {
                return pointA - pointB;
            }

            return suitA - suitB;
        });
    }

    // ==================== 分数操作 ====================

    /**
     * 更新分数（增加或减少）
     */
    public updateScore(delta: number): void {
        this._score += delta;
    }

    /**
     * 重置分数
     */
    public resetScore(): void {
        this._score = 0;
    }

    // ==================== 状态查询 ====================

    /**
     * Check if player has finished (no cards left)
     */
    public isFinished(): boolean {
        return this._handCards.length === 0;
    }

    /**
     * Check if player has cards
     */
    public hasCardsInHand(): boolean {
        return this._handCards.length > 0;
    }

    // ==================== 重置方法 ====================

    /**
     * Reset player state for new game
     * 重置游戏状态，但保留 PlayerInfo
     */
    public reset(): void {
        this._handCards = [];
        this._score = 0;
        this._state = PlayerState.WAITING;
        this._isDealer = false;
    }

    // ==================== 调试方法 ====================

    /**
     * Get player info as string for debugging
     */
    public toString(): string {
        return `Player[${this._info.id}] ${this._info.name} - Seat: ${this._info.seatIndex}, Cards: ${this._handCards.length}, Score: ${this._score}, State: ${PlayerState[this._state]}`;
    }
}

/**
 * TheDecreePlayer - TheDecree 模式的玩家
 * 扩展基类，添加特定玩法的数据
 */
export class TheDecreePlayer extends Player {
    // TheDecree 特有数据
    private _playedCards: number[] = [];      // 本轮出的牌
    private _hasPlayed: boolean = false;       // 是否已出牌

    get playedCards(): number[] {
        return this._playedCards;
    }

    get hasPlayed(): boolean {
        return this._hasPlayed;
    }

    /**
     * 标记玩家已出牌
     */
    public playCards(cards: number[]): void {
        this._playedCards = [...cards];
        this._hasPlayed = true;
    }

    /**
     * 重置本轮状态
     */
    public resetRound(): void {
        this._playedCards = [];
        this._hasPlayed = false;
    }

    /**
     * 重置游戏（覆盖基类，同时重置 TheDecree 特有状态）
     */
    public override reset(): void {
        super.reset();
        this.resetRound();
    }
}
