import { HandEvaluator, HandResult } from "../Card/HandEvaluator";
import { Game } from "../../Game";
import { PlayerLayoutConfig } from "./PlayerLayoutConfig";

/**
 * Game mode configuration
 */
export interface GameModeConfig {
    id: string;
    name: string;
    displayName: string;
    minPlayers: number;
    maxPlayers: number;
    deckCount: number;        // Number of decks
    initialHandSize: number;  // Initial cards per player
    description: string;
}

/**
 * Base class for all game modes
 *
 * 所有游戏模式（TheDecree、Guandan等）都必须继承此类
 *
 * 职责：
 * - 实现游戏规则逻辑
 * - 管理游戏状态
 * - 控制游戏模式相关的UI
 * - 处理玩家操作
 *
 * 生命周期：
 * 1. constructor - 创建时
 * 2. onEnter - 进入此模式时（初始化游戏、显示UI）
 * 3. update - 每帧更新（可选）
 * 4. onExit - 离开此模式时（清理状态、隐藏UI）
 * 5. cleanup - 销毁时（释放资源）
 */
export abstract class GameModeBase {
    protected game: Game;
    protected config: GameModeConfig;
    protected isActive: boolean = false;

    constructor(game: Game, config: GameModeConfig) {
        this.game = game;
        this.config = config;
    }

    public getConfig(): GameModeConfig {
        return { ...this.config };
    }

    // ==================== 生命周期方法 ====================

    /**
     * 进入此游戏模式时调用
     * 实现此方法时应该：
     * 1. 初始化游戏状态
     * 2. 显示UI
     * 3. 设置玩家布局
     * 4. 开始游戏流程（如发牌）
     */
    public onEnter(): void {
        console.log(`[${this.config.name}] Entering game mode`);
        this.isActive = true;
        this.showUI();
    }

    /**
     * 离开此游戏模式时调用
     * 实现此方法时应该：
     * 1. 清理游戏状态
     * 2. 隐藏UI
     * 3. 停止游戏流程
     */
    public onExit(): void {
        console.log(`[${this.config.name}] Exiting game mode`);
        this.isActive = false;
        this.hideUI();
    }

    /**
     * 每帧更新（可选实现）
     * 如果游戏模式需要逐帧更新逻辑，可以覆盖此方法
     * @param deltaTime 距离上一帧的时间间隔（秒）
     */
    public update?(deltaTime: number): void;

    /**
     * 清理资源
     * 在游戏模式不再使用时调用
     */
    public cleanup(): void {
        console.log(`[${this.config.name}] Cleaning up`);
        this.isActive = false;
    }

    // ==================== UI 控制接口 ====================

    /**
     * 显示游戏模式相关UI
     * 子类必须实现此方法来显示特定游戏模式的UI元素
     * 例如：显示特定的按钮、面板、公共牌区域等
     */
    public abstract showUI(): void;

    /**
     * 隐藏游戏模式相关UI
     * 子类必须实现此方法来隐藏特定游戏模式的UI元素
     */
    public abstract hideUI(): void;

    /**
     * 调整玩家位置布局
     * 不同游戏模式可能有不同的玩家数量和布局
     *
     * 默认实现：使用 PlayerLayoutConfig 提供的标准布局
     * 子类可以：
     * 1. 直接使用此默认实现
     * 2. 调用 applyPlayerLayout() 但传入自定义配置
     * 3. 完全覆盖以实现自定义逻辑
     */
    public adjustPlayerLayout(): void {
        const playerCount = this.config.maxPlayers;
        console.log(`[${this.config.name}] Adjusting player layout for ${playerCount} players`);

        const positions = PlayerLayoutConfig.getStandardLayout(playerCount);
        this.applyPlayerLayout(positions);

        const layoutName = PlayerLayoutConfig.getLayoutName(playerCount);
        console.log(`[${this.config.name}] Player layout adjusted: ${playerCount} players in ${layoutName} formation`);
    }

    /**
     * 应用玩家布局配置
     * 将位置配置应用到实际的节点上
     *
     * @param positions 位置配置数组
     * @protected 子类可以调用此方法来应用自定义配置
     */
    protected applyPlayerLayout(positions: Array<{ name: string; x: number; y: number; active: boolean }>): void {
        const handsManager = this.game.handsManager;
        if (!handsManager) {
            console.warn(`[${this.config.name}] HandsManager not found`);
            return;
        }

        const handsManagerNode = this.game.playerUIManagerNode;
        if (!handsManagerNode) {
            console.warn(`[${this.config.name}] HandsManagerNode not found`);
            return;
        }

        // 应用布局配置
        for (const config of positions) {
            const handNode = handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                if (config.active) {
                    handNode.setPosition(config.x, config.y, 0);
                }
            }
        }
    }

    // ==================== 游戏逻辑接口 ====================

    /**
     * Initialize game state
     */
    public abstract initGame(playerIds: string[]): void;

    /**
     * Deal cards to players
     */
    public abstract dealCards(): void;

    /**
     * Validate if a play is legal
     */
    public abstract isValidPlay(cards: number[], playerId: string): boolean;

    /**
     * Process a player's play
     */
    public abstract playCards(cards: number[], playerId: string): boolean;

    /**
     * Check if game is over
     */
    public abstract isGameOver(): boolean;

    /**
     * Get current level rank (for games like Guandan)
     * 如果游戏模式不需要level rank，可以返回0
     */
    public abstract getCurrentLevelRank(): number;

    // ==================== 状态查询 ====================

    /**
     * 检查游戏模式是否活跃
     */
    public isGameModeActive(): boolean {
        return this.isActive;
    }
}
