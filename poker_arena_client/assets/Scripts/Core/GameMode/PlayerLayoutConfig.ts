/**
 * 玩家手牌位置配置
 */
export interface PlayerPosition {
    name: string;    // 节点名称（BottomHand, LeftHand等）
    x: number;       // X坐标
    y: number;       // Y坐标
    active: boolean; // 是否激活
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
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'TopLeftHand', x: 0, y: 280, active: true },      // Player 1 (Top)
            { name: 'LeftHand', x: -450, y: 0, active: false },
            { name: 'TopRightHand', x: 450, y: 0, active: false },
            { name: 'RightHand', x: 550, y: 50, active: false }
        ];
    }

    /**
     * 3人游戏：三角形布局（下、左上、右上）
     */
    public static getThreePlayerLayout(): PlayerPosition[] {
        return [
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'TopLeftHand', x: -350, y: 200, active: true },   // Player 1 (Top-Left)
            { name: 'TopRightHand', x: 350, y: 200, active: true },   // Player 2 (Top-Right)
            { name: 'LeftHand', x: -450, y: 0, active: false },
            { name: 'RightHand', x: 550, y: 50, active: false }
        ];
    }

    /**
     * 4人游戏：菱形布局（下、左、上、右）
     */
    public static getFourPlayerLayout(): PlayerPosition[] {
        return [
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'LeftHand', x: -450, y: 0, active: true },        // Player 1 (Left)
            { name: 'TopLeftHand', x: 0, y: 280, active: true },      // Player 2 (Top)
            { name: 'TopRightHand', x: 450, y: 0, active: true },     // Player 3 (Right)
            { name: 'RightHand', x: 550, y: 50, active: false }
        ];
    }

    /**
     * 5人游戏：五角形分布
     */
    public static getFivePlayerLayout(): PlayerPosition[] {
        return [
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'LeftHand', x: -400, y: -80, active: true },      // Player 1 (Bottom-Left)
            { name: 'TopLeftHand', x: -250, y: 220, active: true },   // Player 2 (Top-Left)
            { name: 'TopRightHand', x: 250, y: 220, active: true },   // Player 3 (Top-Right)
            { name: 'RightHand', x: 400, y: -80, active: true }       // Player 4 (Bottom-Right)
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
