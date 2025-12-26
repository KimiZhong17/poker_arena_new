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
 * Player - 客户端玩家数据容器（简化版）
 *
 * 设计原则：
 * - 纯数据容器，用于 UI 绑定
 * - 数据由服务器同步，客户端只读或简单更新
 * - 不包含游戏逻辑（逻辑在服务器）
 * - 不包含 UI 逻辑（UI 在 PlayerUINode 中）
 *
 * 架构说明：
 * - 服务器：完整的 Player 类 + 游戏逻辑
 * - 客户端：轻量级 Player 类，仅用于数据绑定和显示
 */
export class Player {
    // 基础信息（来自服务器）
    public readonly id: string;
    public name: string;
    public avatar?: string;
    public seatIndex: number;
    public isReady: boolean;
    public isHost: boolean;

    // 游戏状态（由服务器同步）
    public handCards: number[] = [];
    public score: number = 0;
    public state: PlayerState = PlayerState.WAITING;
    public isDealer: boolean = false;

    constructor(info: PlayerInfo) {
        this.id = info.id;
        this.name = info.name;
        this.avatar = info.avatar;
        this.seatIndex = info.seatIndex;
        this.isReady = info.isReady;
        this.isHost = info.isHost;
    }

    // ==================== 便捷访问器 ====================

    get cardCount(): number {
        return this.handCards.length;
    }

    get info(): PlayerInfo {
        return {
            id: this.id,
            name: this.name,
            avatar: this.avatar,
            seatIndex: this.seatIndex,
            isReady: this.isReady,
            isHost: this.isHost
        };
    }

    // ==================== 数据更新方法（服务器同步调用）====================

    /**
     * 设置手牌（服务器发牌后调用）
     */
    public setHandCards(cards: number[]): void {
        this.handCards = [...cards];
    }

    /**
     * 添加手牌（服务器补牌后调用）
     */
    public addCards(cards: number[]): void {
        this.handCards.push(...cards);
    }

    /**
     * 移除手牌（玩家出牌后调用）
     */
    public removeCards(cards: number[]): void {
        for (const card of cards) {
            const index = this.handCards.indexOf(card);
            if (index !== -1) {
                this.handCards.splice(index, 1);
            }
        }
    }

    /**
     * 更新分数（服务器回合结束后调用）
     */
    public updateScore(score: number): void {
        this.score = score;
    }

    /**
     * 重置游戏状态（新游戏开始时调用）
     */
    public reset(): void {
        this.handCards = [];
        this.score = 0;
        this.state = PlayerState.WAITING;
        this.isDealer = false;
    }

    // ==================== 辅助方法 ====================

    /**
     * 检查玩家是否有手牌
     */
    public hasCardsInHand(): boolean {
        return this.handCards.length > 0;
    }

    /**
     * 检查玩家是否已完成（无手牌）
     */
    public isFinished(): boolean {
        return this.handCards.length === 0;
    }

    /**
     * 检查玩家是否拥有指定的牌
     * （用于单机模式的验证逻辑）
     */
    public hasCards(cards: number[]): boolean {
        const handCopy = [...this.handCards];
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
     * 排序手牌（按点数和花色）
     * （用于单机模式的手牌显示）
     *
     * @param _levelRank 当前关卡等级（保留参数以兼容接口，暂未使用）
     */
    public sortCards(_levelRank: number = 0): void {
        this.handCards.sort((a, b) => {
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

    /**
     * 调试输出
     */
    public toString(): string {
        return `Player[${this.id}] ${this.name} - Seat: ${this.seatIndex}, Cards: ${this.handCards.length}, Score: ${this.score}`;
    }
}
