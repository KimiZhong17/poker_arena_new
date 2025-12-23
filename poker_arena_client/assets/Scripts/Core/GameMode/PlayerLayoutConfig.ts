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

    // 垂直对齐
    alignTop?: boolean;
    alignBottom?: boolean;
    alignVerticalCenter?: boolean;
    top?: number;
    bottom?: number;
}

/**
 * 玩家手牌位置配置（基于 Widget 锚点）
 */
export interface PlayerPosition {
    name: string;              // 节点名称（BottomHand, LeftHand等）
    widget: WidgetAlignment;   // Widget 锚点配置
    active: boolean;           // 是否激活

    // 可选：备用的固定坐标（用于不支持 Widget 的场景）
    fallbackX?: number;
    fallbackY?: number;
}

/**
 * 玩家布局配置工具类
 * 提供不同玩家数量的标准布局配置
 */
export class PlayerLayoutConfig {
    /**
     * 获取指定玩家数量的标准布局配置
     * @param playerCount 玩家数量（2-5）
     * @returns 玩家位置配置数组
     */
    public static getStandardLayout(playerCount: number): PlayerPosition[] {
        switch (playerCount) {
            case 2:
                return this.getTwoPlayerLayout();
            case 3:
                return this.getThreePlayerLayout();
            case 4:
                return this.getFourPlayerLayout();
            case 5:
                return this.getFivePlayerLayout();
            default:
                console.warn(`[PlayerLayoutConfig] Unsupported player count: ${playerCount}, using 4-player layout`);
                return this.getFourPlayerLayout();
        }
    }

    /**
     * 2人对战：面对面（上下）
     */
    public static getTwoPlayerLayout(): PlayerPosition[] {
        return [
            {
                name: 'BottomHand',
                widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 120 },
                active: true,
                fallbackX: 0,
                fallbackY: -280
            },
            {
                name: 'TopLeftHand',
                widget: { alignTop: true, alignHorizontalCenter: true, top: 120 },
                active: true,
                fallbackX: 0,
                fallbackY: 280
            },
            {
                name: 'LeftHand',
                widget: { alignLeft: true, alignVerticalCenter: true, left: 50 },
                active: false,
                fallbackX: -450,
                fallbackY: 0
            },
            {
                name: 'TopRightHand',
                widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
                active: false,
                fallbackX: 450,
                fallbackY: 0
            },
            {
                name: 'RightHand',
                widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
                active: false,
                fallbackX: 550,
                fallbackY: 50
            }
        ];
    }

    /**
     * 3人游戏：三角形布局（下、左上、右上）
     */
    public static getThreePlayerLayout(): PlayerPosition[] {
        return [
            {
                name: 'BottomHand',
                widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 120 },
                active: true,
                fallbackX: 0,
                fallbackY: -280
            },
            {
                name: 'TopLeftHand',
                widget: { alignTop: true, alignLeft: true, top: 100, left: 150 },
                active: true,
                fallbackX: -350,
                fallbackY: 200
            },
            {
                name: 'TopRightHand',
                widget: { alignTop: true, alignRight: true, top: 100, right: 150 },
                active: true,
                fallbackX: 350,
                fallbackY: 200
            },
            {
                name: 'LeftHand',
                widget: { alignLeft: true, alignVerticalCenter: true, left: 50 },
                active: false,
                fallbackX: -450,
                fallbackY: 0
            },
            {
                name: 'RightHand',
                widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
                active: false,
                fallbackX: 550,
                fallbackY: 50
            }
        ];
    }

    /**
     * 4人游戏：菱形布局（下、左、上、右）
     */
    public static getFourPlayerLayout(): PlayerPosition[] {
        return [
            {
                name: 'BottomHand',
                widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 0 },
                active: true,
                fallbackX: 0,
                fallbackY: -280
            },
            {
                name: 'LeftHand',
                widget: { alignLeft: true, alignVerticalCenter: true, left: 0 },
                active: true,
                fallbackX: -550,
                fallbackY: 30
            },
            {
                name: 'TopLeftHand',
                widget: { alignTop: true, alignHorizontalCenter: true, top: 50 },
                active: true,
                fallbackX: 0,
                fallbackY: 280
            },
            {
                name: 'TopRightHand',
                widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
                active: true,
                fallbackX: 550,
                fallbackY: 30
            },
            {
                name: 'RightHand',
                widget: { alignRight: true, alignVerticalCenter: true, right: 50 },
                active: false,
                fallbackX: 550,
                fallbackY: 50
            }
        ];
    }

    /**
     * 5人游戏：五角形分布
     */
    public static getFivePlayerLayout(): PlayerPosition[] {
        return [
            {
                name: 'BottomHand',
                widget: { alignBottom: true, alignHorizontalCenter: true, bottom: 120 },
                active: true,
                fallbackX: 0,
                fallbackY: -280
            },
            {
                name: 'LeftHand',
                widget: { alignLeft: true, alignBottom: true, left: 80, bottom: 280 },
                active: true,
                fallbackX: -400,
                fallbackY: -80
            },
            {
                name: 'TopLeftHand',
                widget: { alignTop: true, alignLeft: true, top: 100, left: 180 },
                active: true,
                fallbackX: -250,
                fallbackY: 220
            },
            {
                name: 'TopRightHand',
                widget: { alignTop: true, alignRight: true, top: 100, right: 180 },
                active: true,
                fallbackX: 250,
                fallbackY: 220
            },
            {
                name: 'RightHand',
                widget: { alignRight: true, alignBottom: true, right: 80, bottom: 280 },
                active: true,
                fallbackX: 400,
                fallbackY: -80
            }
        ];
    }

    /**
     * 获取布局名称
     * @param playerCount 玩家数量
     * @returns 布局名称（如 "face-to-face", "triangle" 等）
     */
    public static getLayoutName(playerCount: number): string {
        const layoutNames: { [key: number]: string } = {
            2: 'face-to-face',
            3: 'triangle',
            4: 'diamond',
            5: 'pentagon'
        };
        return layoutNames[playerCount] || 'custom';
    }
}
