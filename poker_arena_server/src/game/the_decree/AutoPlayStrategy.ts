import { CardPoint } from './CardConst';

/**
 * 托管策略接口
 * 定义AI玩家的决策逻辑
 */
export interface AutoPlayStrategy {
    /**
     * 首个庄家选牌策略
     * @param handCards 手牌
     * @returns 选择的牌
     */
    selectFirstDealerCard(handCards: number[]): number;

    /**
     * 庄家叫牌策略
     * @param handCards 手牌
     * @param communityCards 公共牌
     * @returns 叫牌数量 (1-3)
     */
    dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3;

    /**
     * 玩家出牌策略
     * @param handCards 手牌
     * @param cardsToPlay 需要出的牌数
     * @returns 选择出的牌
     */
    playCards(handCards: number[], cardsToPlay: number): number[];
}

/**
 * 获取卡牌的 Texas Hold'em rank（用于策略比较）
 */
function getTexasRank(card: number): number {
    const point = card & 0x0F;
    switch (point) {
        case CardPoint.P_A: return 14;
        case CardPoint.P_2: return 2;
        default: return point;
    }
}

/**
 * 获取花色权重（用于同 rank 时的比较）
 */
function getSuitValue(card: number): number {
    const suit = card & 0xF0;
    switch (suit) {
        case 0x30: return 4; // Spade
        case 0x20: return 3; // Heart
        case 0x10: return 2; // Club
        case 0x00: return 1; // Diamond
        default: return 0;
    }
}

/**
 * 按 Texas rank 比较两张牌（升序：rank 小的在前）
 */
function compareByRankAsc(a: number, b: number): number {
    const diff = getTexasRank(a) - getTexasRank(b);
    if (diff !== 0) return diff;
    return getSuitValue(a) - getSuitValue(b);
}

/**
 * 保守策略实现
 * 特点：出最小的牌，避免风险，尽量保留大牌
 */
export class ConservativeStrategy implements AutoPlayStrategy {
    /**
     * 选择 rank 最小的牌（避免成为庄家）
     */
    public selectFirstDealerCard(handCards: number[]): number {
        if (handCards.length === 0) {
            throw new Error('No cards in hand');
        }
        return [...handCards].sort(compareByRankAsc)[0];
    }

    /**
     * 保守策略：总是叫1张（最小风险）
     */
    public dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3 {
        return 1;
    }

    /**
     * 出 rank 最小的牌
     */
    public playCards(handCards: number[], cardsToPlay: number): number[] {
        if (handCards.length < cardsToPlay) {
            throw new Error('Not enough cards in hand');
        }

        const sorted = [...handCards].sort(compareByRankAsc);
        return sorted.slice(0, cardsToPlay);
    }
}

/**
 * 激进策略实现
 * 特点：出最大的牌，争取胜利
 */
export class AggressiveStrategy implements AutoPlayStrategy {
    /**
     * 选择 rank 最大的牌（争取成为庄家）
     */
    public selectFirstDealerCard(handCards: number[]): number {
        if (handCards.length === 0) {
            throw new Error('No cards in hand');
        }
        return [...handCards].sort(compareByRankAsc)[handCards.length - 1];
    }

    /**
     * 激进策略：总是叫3张（最大收益）
     */
    public dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3 {
        return 3;
    }

    /**
     * 出 rank 最大的牌
     */
    public playCards(handCards: number[], cardsToPlay: number): number[] {
        if (handCards.length < cardsToPlay) {
            throw new Error('Not enough cards in hand');
        }

        // 降序排列，取前 N 张
        const sorted = [...handCards].sort((a, b) => compareByRankAsc(b, a));
        return sorted.slice(0, cardsToPlay);
    }
}

/**
 * 随机策略实现
 * 特点：随机选择，模拟真实玩家的不确定性
 */
export class RandomStrategy implements AutoPlayStrategy {
    /**
     * 随机选择一张牌
     */
    public selectFirstDealerCard(handCards: number[]): number {
        if (handCards.length === 0) {
            throw new Error('No cards in hand');
        }
        const randomIndex = Math.floor(Math.random() * handCards.length);
        return handCards[randomIndex];
    }

    /**
     * 随机叫牌 (1-3)
     */
    public dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3 {
        const options: (1 | 2 | 3)[] = [1, 2, 3];
        const randomIndex = Math.floor(Math.random() * options.length);
        return options[randomIndex];
    }

    /**
     * 随机出牌
     */
    public playCards(handCards: number[], cardsToPlay: number): number[] {
        if (handCards.length < cardsToPlay) {
            throw new Error('Not enough cards in hand');
        }

        // 随机打乱手牌
        const shuffled = [...handCards].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, cardsToPlay);
    }
}
