/**
 * Player information (for initialization)
 */
export interface PlayerInfo {
    id: string;
    name: string;
    avatar?: string;      // 添加 avatar 字段以与客户端统一
    seatIndex: number;
    isReady: boolean;
    isHost: boolean;
}

/**
 * Base Player class (Server-side)
 * 玩家基类 - 纯数据，无UI
 */
export class Player {
    public id: string;
    public name: string;
    public avatar?: string;       // 添加 avatar 字段
    public seatIndex: number;
    public isReady: boolean;
    public isHost: boolean;
    public handCards: number[] = [];
    public score: number = 0;

    constructor(info: PlayerInfo) {
        this.id = info.id;
        this.name = info.name;
        this.avatar = info.avatar;    // 初始化 avatar
        this.seatIndex = info.seatIndex;
        this.isReady = info.isReady;
        this.isHost = info.isHost;
    }

    /**
     * 设置手牌
     */
    public setHandCards(cards: number[]): void {
        this.handCards = [...cards];
    }

    /**
     * 添加牌到手牌
     */
    public addCards(cards: number[]): void {
        this.handCards.push(...cards);
    }

    /**
     * 移除手牌中的指定牌
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
     * 检查是否拥有指定的牌
     */
    public hasCards(cards: number[]): boolean {
        return cards.every(card => this.handCards.includes(card));
    }

    /**
     * 获取玩家信息（用于网络传输）
     */
    public getInfo(): PlayerInfo {
        return {
            id: this.id,
            name: this.name,
            avatar: this.avatar,      // 包含 avatar 字段
            seatIndex: this.seatIndex,
            isReady: this.isReady,
            isHost: this.isHost
        };
    }
}

/**
 * The Decree game mode specific player
 */
export class TheDecreePlayer extends Player {
    public playedCards: number[] = [];
    public hasPlayed: boolean = false;

    // 托管相关字段
    public isAuto: boolean = false;           // 是否托管中
    public autoStartTime: number = 0;         // 托管开始时间
    public lastActionTime: number = Date.now(); // 最后操作时间

    /**
     * 出牌
     */
    public playCards(cards: number[]): void {
        this.playedCards = [...cards];
        this.hasPlayed = true;
    }

    /**
     * 重置回合状态
     */
    public resetRound(): void {
        this.playedCards = [];
        this.hasPlayed = false;
    }
}
