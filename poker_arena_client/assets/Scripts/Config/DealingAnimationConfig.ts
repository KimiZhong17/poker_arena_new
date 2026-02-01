/**
 * 发牌动画配置
 * 定义发牌动画的各种参数
 */

/**
 * 牌堆位置配置
 */
export const DeckPileConfig = {
    // Widget 对齐配置（右上角）
    widget: {
        alignTop: true,
        alignRight: true,
        top: 100,
        right: 150
    },
    // 备用固定坐标（无 Widget 时使用）
    fallbackPosition: { x: 500, y: 300 },
    // 牌堆显示配置
    display: {
        stackCount: 5,      // 显示几张牌的堆叠效果
        stackOffset: 2      // 每张牌的偏移像素
    }
};

/**
 * 动画时长配置（秒）
 */
export const DealingDuration = {
    dealToPlayer: 0.25,         // 发牌到玩家
    dealToCommunity: 0.3,       // 发牌到公牌区
    cardInterval: 0.08,         // 每张牌之间的间隔
    playerInterval: 0.05,       // 每个玩家之间的间隔
    flipDuration: 0.15,         // 翻牌动画时长
    flipDelay: 0.05,            // 翻牌延迟
    spreadDuration: 0.2,        // 展开动画时长
    spreadInterval: 0.05,       // 展开时每张牌的间隔
    sortDuration: 0.3,          // 排序动画时长
    stackOffset: 3              // 堆叠时每张牌的偏移（像素）
};

/**
 * 缓动函数配置
 */
export const DealingEasing = {
    dealToPlayer: 'sineOut',
    dealToCommunity: 'quadOut',
    flip: 'linear'
};

/**
 * 飞行卡牌配置
 */
export const FlyingCardConfig = {
    startScale: 0.5,            // 起始缩放
    endScale: 1.0,              // 结束缩放（会根据目标调整）
    playerCardScale: 1.0,       // 玩家手牌缩放
    communityCardScale: 1.0,    // 公牌缩放
    otherPlayerCardScale: 0.5   // 其他玩家手牌缩放
};

/**
 * 公牌区配置
 */
export const CommunityCardsConfig = {
    cardSpacing: 120,           // 牌之间的间距
    cardCount: 4                // 公牌数量
};

/**
 * 发牌顺序配置
 */
export const DealingOrderConfig = {
    startFromDealerLeft: true,  // 从庄家左边第一个玩家开始
    clockwise: true,            // 顺时针发牌
    cardsPerRound: 1,           // 每轮每人发几张
    totalCardsPerPlayer: 5      // 每个玩家总共发几张（TheDecree）
};
