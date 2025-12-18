import { Player } from "../Player";

/**
 * TheDecree 游戏模式专用的玩家类
 * 继承自 Player 基类，添加 TheDecree 特有的字段和方法
 */
export class DecreePlayer extends Player {
    // TheDecree 特有字段
    private _score: number = 0;              // 总分数
    private _playedCards: number[] = [];     // 本轮打出的牌
    private _hasPlayed: boolean = false;     // 是否已出牌

    /**
     * 构造函数
     * @param id 玩家ID（数字索引）
     * @param name 玩家名称/标识（例如：'player_0'）
     * @param position 玩家位置（0-3）
     */
    constructor(id: number, name: string, position: number) {
        super(id, name, position);
    }

    // ==================== Getters & Setters ====================

    /**
     * 获取玩家分数
     */
    public get score(): number {
        return this._score;
    }

    /**
     * 设置玩家分数
     */
    public set score(value: number) {
        this._score = value;
    }

    /**
     * 增加分数
     * @param points 要增加的分数
     */
    public addScore(points: number): void {
        this._score += points;
        console.log(`[DecreePlayer] ${this.name} score: ${this._score - points} -> ${this._score} (+${points})`);
    }

    /**
     * 获取本轮打出的牌
     */
    public get playedCards(): number[] {
        return this._playedCards;
    }

    /**
     * 设置本轮打出的牌
     * @param cards 打出的牌数组
     */
    public set playedCards(cards: number[]) {
        this._playedCards = [...cards];
    }

    /**
     * 设置本轮打出的牌（方法形式）
     * @param cards 打出的牌数组
     */
    public setPlayedCards(cards: number[]): void {
        this._playedCards = [...cards];
    }

    /**
     * 获取是否已出牌
     */
    public get hasPlayed(): boolean {
        return this._hasPlayed;
    }

    /**
     * 设置是否已出牌
     */
    public set hasPlayed(value: boolean) {
        this._hasPlayed = value;
    }

    // ==================== 回合管理 ====================

    /**
     * 重置回合状态
     * 在每轮结束后调用，清空已打出的牌和出牌状态
     */
    public resetRoundState(): void {
        this._playedCards = [];
        this._hasPlayed = false;
        console.log(`[DecreePlayer] ${this.name} round state reset`);
    }

    /**
     * 标记玩家已出牌
     * @param cards 打出的牌
     */
    public markAsPlayed(cards: number[]): void {
        this._playedCards = [...cards];
        this._hasPlayed = true;
        console.log(`[DecreePlayer] ${this.name} played ${cards.length} cards`);
    }

    // ==================== 重置方法（覆盖基类）====================

    /**
     * 重置玩家状态（游戏结束或重新开始时）
     * 覆盖基类方法，同时重置 TheDecree 特有字段
     */
    public reset(): void {
        super.reset(); // 调用基类的 reset
        this._score = 0;
        this._playedCards = [];
        this._hasPlayed = false;
        console.log(`[DecreePlayer] ${this.name} fully reset`);
    }

    // ==================== 调试方法 ====================

    /**
     * 获取玩家信息字符串（用于调试）
     */
    public toString(): string {
        return `DecreePlayer[${this.id}] ${this.name} - Position: ${this.position}, ` +
               `Cards: ${this.handCards.length}, Score: ${this._score}, ` +
               `Played: ${this._hasPlayed} (${this._playedCards.length} cards)`;
    }
}
