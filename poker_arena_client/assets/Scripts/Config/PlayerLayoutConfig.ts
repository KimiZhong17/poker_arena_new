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
    LEFT = 'left',      // 在面板左侧
    RIGHT = 'right',    // 在面板右侧
    TOP = 'top',        // 在面板上方
    BOTTOM = 'bottom'   // 在面板下方
}

/**
 * 玩家手牌位置配置（基于 Widget 锚点）
 */
export interface PlayerPosition {
    name: string;              // 节点名称（BottomSeat, LeftSeat等）
    widget: WidgetAlignment;   // Widget 锚点配置
    active: boolean;           // 是否激活

    // 可选：备用的固定坐标（用于不支持 Widget 的场景）
    fallbackX?: number;
    fallbackY?: number;

    // 可选：InfoPanel 的偏移位置（相对于座位节点）
    infoPanelOffsetX?: number;
    infoPanelOffsetY?: number;

    // 可选：State Label 的对齐方式
    stateLabelAlignment?: StateLabelAlignment;

    // 可选：手牌堆偏移（用于调整手牌堆的整体位置）
    handPileOffset?: { x: number; y: number };

    // 可选：已出牌偏移（用于将已出的牌显示在合适的位置）
    playedCardOffset?: { x: number; y: number };
}

// ==================== 基础座位定义 ====================
/**
 * 基础座位位置
 * 这些是可复用的座位配置，通过组合来构建不同人数的布局
 */
const BaseSeatPositions = {
    // 底部座位（主玩家）
    bottom: {
        name: 'BottomSeat',
        widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 30 },
        active: true,
        fallbackX: 0,
        fallbackY: -280,
        infoPanelOffsetX: -500,
        infoPanelOffsetY: 0,
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 0, y: 0 },
    } as PlayerPosition,

    // 顶部座位
    top: {
        name: 'TopSeat',
        widget: { alignTop: true, alignHorizontalCenter: true, top: 20, horizontalCenter: -50 },
        active: true,
        fallbackX: 0,
        fallbackY: 280,
        infoPanelOffsetX: -100,
        infoPanelOffsetY: -20,
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 90, y: -16 },
    } as PlayerPosition,

    // 左侧座位
    left: {
        name: 'LeftSeat',
        widget: { alignLeft: true, alignVerticalCenter: true, left: 50 },
        active: true,
        fallbackX: -550,
        fallbackY: 30,
        infoPanelOffsetX: 0,
        infoPanelOffsetY: 0,
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 90, y: -16 },
    } as PlayerPosition,

    // 右侧座位
    right: {
        name: 'RightSeat',
        widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
        active: true,
        fallbackX: 550,
        fallbackY: 30,
        infoPanelOffsetX: 0,
        infoPanelOffsetY: 0,
        stateLabelAlignment: StateLabelAlignment.LEFT,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: -90, y: -16 },
    } as PlayerPosition,

    // 左上座位（用于5-6人布局）
    topLeft: {
        name: 'TopLeftSeat',
        widget: { alignTop: true, alignLeft: true, top: 100, left: 180 },
        active: true,
        fallbackX: -250,
        fallbackY: 220,
        infoPanelOffsetX: -200,
        infoPanelOffsetY: 0,
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 90, y: -16 },
    } as PlayerPosition,

    // 右上座位（用于5-6人布局）
    topRight: {
        name: 'TopRightSeat',
        widget: { alignTop: true, alignRight: true, top: 100, right: 180 },
        active: true,
        fallbackX: 250,
        fallbackY: 220,
        infoPanelOffsetX: -200,
        infoPanelOffsetY: 0,
        stateLabelAlignment: StateLabelAlignment.BOTTOM,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: -90, y: -16 },
    } as PlayerPosition,

    // 左下座位（用于6人布局）
    bottomLeft: {
        name: 'BottomLeftSeat',
        widget: { alignLeft: true, alignBottom: true, left: 80, bottom: 280 },
        active: true,
        fallbackX: -400,
        fallbackY: -80,
        infoPanelOffsetX: 0,
        infoPanelOffsetY: -100,
        stateLabelAlignment: StateLabelAlignment.RIGHT,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: 90, y: -16 },
    } as PlayerPosition,

    // 右下座位（用于6人布局）
    bottomRight: {
        name: 'BottomRightSeat',
        widget: { alignRight: true, alignBottom: true, right: 80, bottom: 280 },
        active: true,
        fallbackX: 400,
        fallbackY: -80,
        infoPanelOffsetX: 0,
        infoPanelOffsetY: -100,
        stateLabelAlignment: StateLabelAlignment.LEFT,
        handPileOffset: { x: 0, y: 0 },
        playedCardOffset: { x: -90, y: -16 },
    } as PlayerPosition,
} as const;

// ==================== TheDecree 布局定义 ====================
/**
 * TheDecree 模式座位顺序
 * 2人: 底、顶
 * 3人: 底、左、右
 * 4人: 底、左、顶、右
 */
const TheDecreeSeatOrder: Record<number, (keyof typeof BaseSeatPositions)[]> = {
    2: ['bottom', 'top'],
    3: ['bottom', 'left', 'right'],
    4: ['bottom', 'left', 'top', 'right'],
};

// ==================== Guandan 布局定义 ====================
/**
 * Guandan 模式座位顺序
 * 5人: 底、左下、左上、右上、右下
 * 6人: 底、左下、左上、右上、右下、顶（或其他配置）
 */
const GuandanSeatOrder: Record<number, (keyof typeof BaseSeatPositions)[]> = {
    5: ['bottom', 'bottomLeft', 'topLeft', 'topRight', 'bottomRight'],
    6: ['bottom', 'bottomLeft', 'topLeft', 'top', 'topRight', 'bottomRight'],
};

/**
 * 玩家布局配置工具类
 * 提供不同玩家数量的标准布局配置
 */
export class PlayerLayoutConfig {
    /**
     * 获取指定玩家数量的标准布局配置
     * 自动根据人数选择 TheDecree 或 Guandan 布局
     * @param playerCount 玩家数量（2-6）
     * @returns 玩家位置配置数组
     */
    public static getStandardLayout(playerCount: number): PlayerPosition[] {
        if (playerCount >= 2 && playerCount <= 4) {
            return this.getTheDecreeLayout(playerCount);
        } else if (playerCount >= 5 && playerCount <= 6) {
            return this.getGuandanLayout(playerCount);
        } else {
            console.warn(`[PlayerLayoutConfig] Unsupported player count: ${playerCount}, using 4-player layout`);
            return this.getTheDecreeLayout(4);
        }
    }

    /**
     * 获取 TheDecree 模式布局（2-4人）
     * @param playerCount 玩家数量（2-4）
     */
    public static getTheDecreeLayout(playerCount: number): PlayerPosition[] {
        const seatOrder = TheDecreeSeatOrder[playerCount];
        if (!seatOrder) {
            console.warn(`[PlayerLayoutConfig] Invalid TheDecree player count: ${playerCount}`);
            return this.buildLayout(TheDecreeSeatOrder[4]);
        }
        return this.buildLayout(seatOrder);
    }

    /**
     * 获取 Guandan 模式布局（5-6人）
     * @param playerCount 玩家数量（5-6）
     */
    public static getGuandanLayout(playerCount: number): PlayerPosition[] {
        const seatOrder = GuandanSeatOrder[playerCount];
        if (!seatOrder) {
            console.warn(`[PlayerLayoutConfig] Invalid Guandan player count: ${playerCount}`);
            return this.buildLayout(GuandanSeatOrder[5]);
        }
        return this.buildLayout(seatOrder);
    }

    /**
     * 根据座位顺序构建布局
     * @param seatOrder 座位键名数组
     */
    private static buildLayout(seatOrder: (keyof typeof BaseSeatPositions)[]): PlayerPosition[] {
        return seatOrder.map(seatKey => ({ ...BaseSeatPositions[seatKey] }));
    }

    /**
     * 获取布局名称
     * @param playerCount 玩家数量
     * @returns 布局名称
     */
    public static getLayoutName(playerCount: number): string {
        const layoutNames: { [key: number]: string } = {
            2: 'face-to-face',
            3: 'triangle',
            4: 'diamond',
            5: 'pentagon',
            6: 'hexagon'
        };
        return layoutNames[playerCount] || 'custom';
    }
}
