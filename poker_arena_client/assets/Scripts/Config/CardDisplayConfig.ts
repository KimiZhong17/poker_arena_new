/**
 * 卡牌显示配置
 * 包含卡牌尺寸、间距、缩放、位置偏移等配置
 */

// ==================== 卡牌基础尺寸 ====================
export const CardDimensions = {
    width: 140,                 // 卡牌宽度（像素）
    height: 190,                // 卡牌高度（像素）
    selectedOffsetY: 20,        // 选中时向上偏移（像素）
} as const;

// ==================== 卡牌间距配置 ====================
export const CardSpacing = {
    // TheDecree 模式（5张牌）
    theDecree: 100,

    // Guandan 模式（根据手牌数量动态调整）
    guandan: {
        fewCards: 100,          // <= 7 张牌
        mediumCards: 70,        // 8-15 张牌
        manyCards: 50,          // > 15 张牌
        thresholds: {
            few: 7,             // 少量牌阈值
            medium: 15,         // 中等牌阈值
        },
    },

    // 堆叠显示
    stack: {
        verticalOffset: 30,     // 同点数牌纵向堆叠偏移
        wildCardGap: 10,        // 红心级牌（百搭）与普通牌的间隔
    },

    // 已出牌显示
    playedCards: {
        spacing: 30,            // 已出牌之间的间距
    },
} as const;

// ==================== 卡牌缩放配置 ====================
export const CardScale = {
    // STACK 模式（其他玩家）
    stack: {
        handCards: 0.5,         // 手牌缩放比例
        playedCards: 0.8,       // 已出牌缩放比例
    },

    // 卡牌堆叠显示
    stackDisplay: {
        maxCards: 5,            // 最多显示几张牌背
        offset: 1,              // 每张牌的偏移（像素）
    },
} as const;

// ==================== 卡牌精灵名称 ====================
export const CardSpriteNames = {
    back: 'CardBack3_NoLogo',   // 牌背精灵名称（无Logo版本）
    backWithLogo: 'CardBack3',  // 牌背精灵名称（有Logo版本）
} as const;

// ==================== 卡牌透明度配置 ====================
export const CardOpacity = {
    normal: 255,                // 正常透明度
    dimmed: 100,                // 变暗透明度（锁定未选中的牌）
} as const;

// ==================== 辅助函数 ====================

/**
 * 根据手牌数量获取卡牌间距
 * @param cardCount 手牌数量
 * @param isTheDecreeMode 是否是 TheDecree 模式
 */
export function getCardSpacing(cardCount: number, isTheDecreeMode: boolean): number {
    if (isTheDecreeMode) {
        return CardSpacing.theDecree;
    }

    const { thresholds, fewCards, mediumCards, manyCards } = CardSpacing.guandan;

    if (cardCount <= thresholds.few) {
        return fewCards;
    } else if (cardCount <= thresholds.medium) {
        return mediumCards;
    } else {
        return manyCards;
    }
}
