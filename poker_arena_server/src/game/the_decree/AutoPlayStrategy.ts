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
 * 保守策略实现
 * 特点：出最小的牌，避免风险，尽量保留大牌
 */
export class ConservativeStrategy implements AutoPlayStrategy {
    /**
     * 选择最小的牌（避免成为庄家）
     */
    public selectFirstDealerCard(handCards: number[]): number {
        if (handCards.length === 0) {
            throw new Error('No cards in hand');
        }
        return Math.min(...handCards);
    }

    /**
     * 保守策略：总是叫1张（最小风险）
     */
    public dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3 {
        return 1;
    }

    /**
     * 出最小的牌
     */
    public playCards(handCards: number[], cardsToPlay: number): number[] {
        if (handCards.length < cardsToPlay) {
            throw new Error('Not enough cards in hand');
        }

        // 排序后取最小的牌
        const sorted = [...handCards].sort((a, b) => a - b);
        return sorted.slice(0, cardsToPlay);
    }
}

/**
 * 激进策略实现
 * 特点：出最大的牌，争取胜利
 */
export class AggressiveStrategy implements AutoPlayStrategy {
    /**
     * 选择最大的牌（争取成为庄家）
     */
    public selectFirstDealerCard(handCards: number[]): number {
        if (handCards.length === 0) {
            throw new Error('No cards in hand');
        }
        return Math.max(...handCards);
    }

    /**
     * 激进策略：总是叫3张（最大收益）
     */
    public dealerCall(handCards: number[], communityCards: number[]): 1 | 2 | 3 {
        return 3;
    }

    /**
     * 出最大的牌
     */
    public playCards(handCards: number[], cardsToPlay: number): number[] {
        if (handCards.length < cardsToPlay) {
            throw new Error('Not enough cards in hand');
        }

        // 排序后取最大的牌
        const sorted = [...handCards].sort((a, b) => b - a);
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
