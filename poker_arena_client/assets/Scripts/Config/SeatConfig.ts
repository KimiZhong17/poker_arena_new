/**
 * 座位配置
 * 定义游戏中各个座位的位置、偏移、对齐方式等配置
 */
import { logger } from '../Utils/Logger';
const log = logger('SeatConfig');

// ==================== 类型定义 ====================

/**
 * 二维坐标/偏移
 */
export interface Vec2 {
    x: number;
    y: number;
}

/**
 * Widget 对齐配置
 */
export interface WidgetAlignment {
    // 水平对齐
    alignLeft?: boolean;
    alignRight?: boolean;
    alignHorizontalCenter?: boolean;
    left?: number;
    right?: number;
    horizontalCenter?: number;

    // 垂直对齐
    alignTop?: boolean;
    alignBottom?: boolean;
    alignVerticalCenter?: boolean;
    top?: number;
    bottom?: number;
    verticalCenter?: number;
}

/**
 * State Label 对齐方式
 */
export enum StateLabelAlignment {
    LEFT = 'left',
    RIGHT = 'right',
    TOP = 'top',
    BOTTOM = 'bottom'
}

/**
 * 已出牌排列方式
 */
export enum PlayedCardLayout {
    HORIZONTAL = 'horizontal',  // 横向排列
    VERTICAL = 'vertical'       // 竖向堆叠
}

/**
 * 座位位置配置
 */
export interface SeatPosition {
    name: string;                       // 节点名称
    widget: WidgetAlignment;            // Widget 锚点配置
    active: boolean;                    // 是否激活

    fallbackPosition: Vec2;             // 备用固定坐标（无 Widget 时使用）
    infoPanelOffset: Vec2;              // InfoPanel 偏移（相对于座位节点）
    handPileOffset: Vec2;               // 手牌堆偏移
    playedCardOffset: Vec2;             // 已出牌偏移
    dealerIndicatorOffset: Vec2;        // 庄家指示器偏移
    handTypeOffset: Vec2;               // 牌型展示偏移（相对于座位节点）

    stateLabelAlignment: StateLabelAlignment;  // State Label 对齐方式
    playedCardLayout: PlayedCardLayout;        // 已出牌排列方式
}

// ==================== 座位定义 ====================

/**
 * 基础座位定义
 * 设计原则：非主角玩家以 InfoPanel 为原点（infoPanelOffset = 0）
 */
const SeatDefinitions = {
    // 底部座位（主玩家）- 唯一需要 infoPanelOffset 的座位
    bottom: {
        name: 'BottomSeat',
        widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 30 },
        active: true,
        fallbackPosition: { x: 0, y: -280 },
        infoPanelOffset: { x: -500, y: 0 },     // 主玩家 InfoPanel 在左侧
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 0, y: 0 },
        dealerIndicatorOffset: { x: -300, y: 50 },
        handTypeOffset: { x: 0, y: 120 },       // 牌型显示在手牌上方
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,

    // 顶部座位
    top: {
        name: 'TopSeat',
        widget: { alignTop: true, alignHorizontalCenter: true, top: 20, horizontalCenter: -50 },
        active: true,
        fallbackPosition: { x: 0, y: 280 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: 100, y: 20 },      // 手牌在 InfoPanel 右侧
        playedCardOffset: { x: 200, y: 4 },
        dealerIndicatorOffset: { x: -200, y: -50 },
        handTypeOffset: { x: 50, y: -80 },      // 牌型显示在下方
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,

    // 左侧座位
    left: {
        name: 'LeftSeat',
        widget: { alignLeft: true, alignVerticalCenter: true, left: 50 },
        active: true,
        fallbackPosition: { x: -550, y: 30 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: 100, y: 0 },       // 手牌在 InfoPanel 右侧
        playedCardOffset: { x: 200, y: 4 },
        dealerIndicatorOffset: { x: 80, y: -100 },
        handTypeOffset: { x: 100, y: -80 },     // 牌型显示在右下方
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        playedCardLayout: PlayedCardLayout.VERTICAL,   // 左侧玩家竖向堆叠
    } as SeatPosition,

    // 右侧座位
    right: {
        name: 'RightSeat',
        widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
        active: true,
        fallbackPosition: { x: 550, y: 30 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: -100, y: 0 },      // 手牌在 InfoPanel 左侧
        playedCardOffset: { x: -200, y: 4 },
        dealerIndicatorOffset: { x: -80, y: -100 },
        handTypeOffset: { x: -100, y: -80 },    // 牌型显示在左下方
        stateLabelAlignment: StateLabelAlignment.LEFT,
        playedCardLayout: PlayedCardLayout.VERTICAL,   // 右侧玩家竖向堆叠
    } as SeatPosition,

    // 左上座位（5-6人布局）
    topLeft: {
        name: 'TopLeftSeat',
        widget: { alignTop: true, alignLeft: true, top: 100, left: 180 },
        active: true,
        fallbackPosition: { x: -250, y: 220 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: 100, y: 0 },
        playedCardOffset: { x: 200, y: 4 },
        dealerIndicatorOffset: { x: 80, y: -80 },
        handTypeOffset: { x: 100, y: -80 },
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,

    // 右上座位（5-6人布局）
    topRight: {
        name: 'TopRightSeat',
        widget: { alignTop: true, alignRight: true, top: 100, right: 180 },
        active: true,
        fallbackPosition: { x: 250, y: 220 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: -100, y: 0 },
        playedCardOffset: { x: -200, y: 4 },
        dealerIndicatorOffset: { x: -80, y: -80 },
        handTypeOffset: { x: -100, y: -80 },
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,

    // 左下座位（6人布局）
    bottomLeft: {
        name: 'BottomLeftSeat',
        widget: { alignLeft: true, alignBottom: true, left: 80, bottom: 280 },
        active: true,
        fallbackPosition: { x: -400, y: -80 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: 100, y: 0 },
        playedCardOffset: { x: 200, y: 4 },
        dealerIndicatorOffset: { x: 80, y: -80 },
        handTypeOffset: { x: 100, y: 80 },
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,

    // 右下座位（6人布局）
    bottomRight: {
        name: 'BottomRightSeat',
        widget: { alignRight: true, alignBottom: true, right: 80, bottom: 280 },
        active: true,
        fallbackPosition: { x: 400, y: -80 },
        infoPanelOffset: { x: 0, y: 0 },
        handPileOffset: { x: -100, y: 0 },
        playedCardOffset: { x: -200, y: 4 },
        dealerIndicatorOffset: { x: -80, y: -80 },
        handTypeOffset: { x: -100, y: 80 },
        stateLabelAlignment: StateLabelAlignment.LEFT,
        playedCardLayout: PlayedCardLayout.HORIZONTAL,
    } as SeatPosition,
} as const;

// ==================== 布局定义 ====================

type SeatKey = keyof typeof SeatDefinitions;

/**
 * TheDecree 模式座位顺序（2-4人）
 * 2人: 底、顶
 * 3人: 底、左、右
 * 4人: 底、左、顶、右
 */
const TheDecreeSeatOrder: Record<number, SeatKey[]> = {
    2: ['bottom', 'top'],
    3: ['bottom', 'left', 'right'],
    4: ['bottom', 'left', 'top', 'right'],
};

/**
 * Guandan 模式座位顺序（5-6人）
 * 5人: 底、左下、左上、右上、右下
 * 6人: 底、左下、左上、顶、右上、右下
 */
const GuandanSeatOrder: Record<number, SeatKey[]> = {
    5: ['bottom', 'bottomLeft', 'topLeft', 'topRight', 'bottomRight'],
    6: ['bottom', 'bottomLeft', 'topLeft', 'top', 'topRight', 'bottomRight'],
};

// ==================== 布局配置类 ====================

/**
 * 座位布局配置工具类
 */
export class SeatLayoutConfig {
    /**
     * 获取标准布局（自动根据人数选择模式）
     */
    public static getLayout(playerCount: number): SeatPosition[] {
        if (playerCount >= 2 && playerCount <= 4) {
            return this.getTheDecreeLayout(playerCount);
        } else if (playerCount >= 5 && playerCount <= 6) {
            return this.getGuandanLayout(playerCount);
        } else {
            log.warn(`Unsupported player count: ${playerCount}, using 4-player layout`);
            return this.getTheDecreeLayout(4);
        }
    }

    /**
     * 获取 TheDecree 模式布局（2-4人）
     */
    public static getTheDecreeLayout(playerCount: number): SeatPosition[] {
        const seatOrder = TheDecreeSeatOrder[playerCount];
        if (!seatOrder) {
            log.warn(`Invalid TheDecree player count: ${playerCount}`);
            return this.buildLayout(TheDecreeSeatOrder[4]);
        }
        return this.buildLayout(seatOrder);
    }

    /**
     * 获取 Guandan 模式布局（5-6人）
     */
    public static getGuandanLayout(playerCount: number): SeatPosition[] {
        const seatOrder = GuandanSeatOrder[playerCount];
        if (!seatOrder) {
            log.warn(`Invalid Guandan player count: ${playerCount}`);
            return this.buildLayout(GuandanSeatOrder[5]);
        }
        return this.buildLayout(seatOrder);
    }

    /**
     * 根据座位顺序构建布局
     */
    private static buildLayout(seatOrder: SeatKey[]): SeatPosition[] {
        return seatOrder.map(seatKey => ({ ...SeatDefinitions[seatKey] }));
    }

    /**
     * 获取布局名称
     */
    public static getLayoutName(playerCount: number): string {
        const layoutNames: Record<number, string> = {
            2: 'face-to-face',
            3: 'triangle',
            4: 'diamond',
            5: 'pentagon',
            6: 'hexagon'
        };
        return layoutNames[playerCount] || 'custom';
    }
}

// ==================== 兼容性导出（旧 API）====================
// 为了向后兼容，保留旧的类名和接口名

/** @deprecated 使用 SeatPosition 代替 */
export type PlayerPosition = SeatPosition;

/** @deprecated 使用 SeatLayoutConfig 代替 */
export const PlayerLayoutConfig = SeatLayoutConfig;
