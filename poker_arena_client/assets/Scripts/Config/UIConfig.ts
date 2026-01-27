import { Color } from 'cc';

/**
 * UI 通用配置
 * 包含颜色、字体、动画等 UI 相关的全局配置
 */

// ==================== 颜色配置 ====================
export const UIColors = {
    // 玩家状态颜色
    playerState: {
        host: new Color(255, 215, 0, 255),      // 房主 - 金色
        ready: new Color(0, 255, 0, 255),       // 已准备 - 绿色
        notReady: new Color(150, 150, 150, 255), // 未准备 - 灰色
    },

    // 卡牌计数标签颜色
    cardCount: {
        text: new Color(255, 215, 0, 255),           // 文字 - 金色
        outline: new Color(45, 27, 16, 255),         // 描边 - 深棕色
    },

    // 通用文字颜色
    text: {
        default: new Color(255, 255, 255, 255),      // 默认 - 白色
        highlight: new Color(255, 215, 0, 255),      // 高亮 - 金色
    },
} as const;

// ==================== 字体配置 ====================
export const UIFonts = {
    // 消息提示
    messageTip: {
        fontSize: 28,
        lineHeight: 32,
    },

    // 卡牌计数
    cardCount: {
        fontSize: 24,
        lineHeight: 30,
        outlineWidth: 2,
    },

    // 按钮标签
    button: {
        fontSize: 24,
    },

    // 房间ID
    roomId: {
        fontSize: 28,
    },
} as const;

// ==================== 动画配置 ====================
export const UIAnimations = {
    // 庄家指示器
    dealerIndicator: {
        moveDuration: 0.5,      // 移动动画时长（秒）
        defaultOffsetX: -150,   // 默认X偏移
        defaultOffsetY: 50,     // 默认Y偏移
    },

    // 消息提示
    messageTip: {
        defaultDuration: 2.0,   // 默认显示时长（秒）
        fadeInDuration: 0.3,    // 淡入时长（秒）
        fadeOutDuration: 0.3,   // 淡出时长（秒）
    },

    // 开关组件
    switch: {
        duration: 0.2,          // 切换动画时长（秒）
    },
} as const;

// ==================== UI 尺寸配置 ====================
export const UISizes = {
    // 卡牌计数标签
    cardCountLabel: {
        width: 80,
        height: 50,
    },

    // 按钮
    button: {
        width: 120,
        height: 50,
    },

    // 开关组件
    switch: {
        padding: 5,             // 手柄边距
    },
} as const;

// ==================== 玩家名称显示配置 ====================
export const PlayerNameConfig = {
    guestPrefix: 'guest_',      // 访客名称前缀
    guestDisplayLength: 3,      // 访客名称显示长度（前缀后的字符数）
    maxNameLength: 9,           // 最大名称长度
    truncationSuffix: '...',    // 截断后缀
} as const;

// ==================== 庄家指示器位置偏移配置 ====================
export const DealerIndicatorOffsets = {
    // 2人游戏
    twoPlayer: [
        { x: -300, y: 50 },     // 底部玩家
        { x: -200, y: -50 },    // 顶部玩家
    ],

    // 3人游戏
    threePlayer: [
        { x: -300, y: 50 },     // 底部玩家
        { x: 80, y: -100 },     // 左上玩家
        { x: -80, y: -100 },    // 右上玩家
    ],

    // 4人游戏
    fourPlayer: [
        { x: -300, y: 50 },     // 底部玩家
        { x: 80, y: -100 },     // 左侧玩家
        { x: -200, y: -50 },    // 顶部玩家
        { x: -80, y: -100 },    // 右侧玩家
    ],

    // 默认偏移
    default: { x: -150, y: 50 },
} as const;

/**
 * 根据玩家数量和索引获取庄家指示器偏移
 */
export function getDealerIndicatorOffset(playerCount: number, playerIndex: number): { x: number, y: number } {
    let offsets: readonly { x: number, y: number }[];

    switch (playerCount) {
        case 2:
            offsets = DealerIndicatorOffsets.twoPlayer;
            break;
        case 3:
            offsets = DealerIndicatorOffsets.threePlayer;
            break;
        case 4:
            offsets = DealerIndicatorOffsets.fourPlayer;
            break;
        default:
            return DealerIndicatorOffsets.default;
    }

    return offsets[playerIndex] || DealerIndicatorOffsets.default;
}

// ==================== State Label 对齐偏移配置 ====================
export const StateLabelOffsets = {
    left: -200,     // 左侧偏移
    right: -200,    // 右侧偏移
    top: -80,       // 顶部偏移
    bottom: -80,    // 底部偏移
} as const;
