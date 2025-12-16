import { Node } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { GameStage } from '../GameStage';
import { GameModeBase } from '../GameMode/GameModeBase';

/**
 * 游玩阶段
 *
 * 职责：
 * - 根据配置创建并管理GameMode（TheDecree、Guandan等）
 * - 代理GameMode的UI显示和隐藏
 * - 监听游戏结束事件，切换到EndStage
 *
 * 工作流程：
 * onEnter() -> 创建GameMode -> 初始化GameMode -> 开始游戏
 * 游戏进行中...
 * 游戏结束 -> onGameFinished() -> 切换到EndStage
 *
 * 设计说明：
 * PlayingStage 只负责"游玩阶段"这个流程，具体的游戏规则和逻辑
 * 都委托给 GameMode 实现。这样可以轻松支持多种游戏模式。
 */
export class PlayingStage extends GameStageBase {
    // 当前游戏模式
    private currentGameMode: GameModeBase | null = null;

    // 游戏模式名称（从配置读取）
    private gameModeName: string;

    /**
     * 构造函数
     * @param game Game主类引用
     * @param rootNode 根节点（通常不需要，GameMode会自己管理UI）
     * @param gameModeName 游戏模式名称（'the_decree', 'guandan'等）
     */
    constructor(game: Game, rootNode: Node | null = null, gameModeName: string = 'the_decree') {
        super(game, rootNode);
        this.gameModeName = gameModeName;
    }

    /**
     * 进入游玩阶段
     */
    public onEnter(): void {
        console.log(`[PlayingStage] Entering playing stage (mode: ${this.gameModeName})`);
        this.isActive = true;

        // 1. 创建游戏模式
        this.createGameMode();

        if (!this.currentGameMode) {
            console.error('[PlayingStage] Failed to create game mode!');
            return;
        }

        // 2. 进入游戏模式（会调用showUI和adjustPlayerLayout）
        this.currentGameMode.onEnter();

        // 3. 显示Playing阶段的UI（如果有）
        this.showUI();

        console.log('[PlayingStage] Game started');
    }

    /**
     * 离开游玩阶段
     */
    public onExit(): void {
        console.log('[PlayingStage] Exiting playing stage');
        this.isActive = false;

        // 1. 退出游戏模式
        if (this.currentGameMode) {
            this.currentGameMode.onExit();
        }

        // 2. 隐藏UI
        this.hideUI();
    }

    /**
     * 每帧更新
     * 转发给GameMode处理
     */
    public update(deltaTime: number): void {
        if (this.currentGameMode && this.currentGameMode.update) {
            this.currentGameMode.update(deltaTime);
        }
    }

    /**
     * 显示游玩阶段UI
     * 主要是代理给GameMode
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
        }

        // 代理给GameMode显示UI
        if (this.currentGameMode) {
            this.currentGameMode.showUI();
        }

        console.log('[PlayingStage] UI shown');
    }

    /**
     * 隐藏游玩阶段UI
     */
    public hideUI(): void {
        // 代理给GameMode隐藏UI
        if (this.currentGameMode) {
            this.currentGameMode.hideUI();
        }

        if (this.rootNode) {
            this.rootNode.active = false;
        }

        console.log('[PlayingStage] UI hidden');
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[PlayingStage] Cleaning up');

        if (this.currentGameMode) {
            this.currentGameMode.cleanup();
            this.currentGameMode = null;
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 创建游戏模式
     * 根据gameModeName创建对应的GameMode实例
     */
    private createGameMode(): void {
        console.log(`[PlayingStage] Creating game mode: ${this.gameModeName}`);

        // 动态导入并创建游戏模式
        // 注意：这里需要根据实际的游戏模式类来实现
        if (this.gameModeName === 'the_decree') {
            this.currentGameMode = this.createTheDecreeMode();
        } else if (this.gameModeName === 'guandan') {
            this.currentGameMode = this.createGuandanMode();
        } else {
            console.error(`[PlayingStage] Unknown game mode: ${this.gameModeName}`);
            // 默认使用TheDecree
            this.currentGameMode = this.createTheDecreeMode();
        }

        if (this.currentGameMode) {
            console.log(`[PlayingStage] Game mode created: ${this.currentGameMode.getConfig().name}`);
        }
    }

    /**
     * 创建The Decree游戏模式
     * TODO: 需要在重构TheDecreeMode后更新
     */
    private createTheDecreeMode(): GameModeBase | null {
        try {
            // 导入TheDecreeMode
            const { TheDecreeMode } = require('../GameMode/TheDecreeMode');

            // 创建配置
            const config = {
                id: 'the_decree',
                name: 'TheDecree',
                displayName: '天命之战',
                minPlayers: 4,
                maxPlayers: 4,
                deckCount: 1,
                initialHandSize: 5,
                description: 'Texas Hold\'em inspired poker game'
            };

            // 创建实例（使用新的构造函数签名）
            const mode = new TheDecreeMode(this.game, config);
            return mode;
        } catch (error) {
            console.error('[PlayingStage] Failed to create TheDecreeMode:', error);
            return null;
        }
    }

    /**
     * 创建Guandan游戏模式
     * TODO: 需要实现GuandanMode类
     */
    private createGuandanMode(): GameModeBase | null {
        try {
            // 导入GuandanMode
            const { GuandanMode } = require('../GameMode/GuandanMode');

            // 创建配置
            const config = {
                id: 'guandan',
                name: 'Guandan',
                displayName: '掼蛋',
                minPlayers: 4,
                maxPlayers: 5,
                deckCount: 3,
                initialHandSize: 31,
                description: 'Popular Chinese card game'
            };

            // 创建实例
            const mode = new GuandanMode(this.game, config);
            return mode;
        } catch (error) {
            console.error('[PlayingStage] Failed to create GuandanMode:', error);
            console.warn('[PlayingStage] GuandanMode not implemented yet, using TheDecree as fallback');
            return this.createTheDecreeMode();
        }
    }

    // ==================== 公共接口 ====================

    /**
     * 游戏结束回调
     * 由GameMode在游戏结束时调用
     * @param gameResult 游戏结果数据（可选）
     */
    public onGameFinished(gameResult?: any): void {
        console.log('[PlayingStage] Game finished', gameResult);

        // 保存游戏结果（供EndStage使用）
        if (gameResult) {
            // TODO: 将结果传递给EndStage
            console.log('[PlayingStage] Game result:', gameResult);
        }

        // 切换到结束阶段
        const stageManager = this.game.stageManager;
        if (stageManager) {
            stageManager.switchToStage(GameStage.END);
        } else {
            console.error('[PlayingStage] StageManager not found on Game!');
        }
    }

    /**
     * 获取当前游戏模式
     */
    public getCurrentGameMode(): GameModeBase | null {
        return this.currentGameMode;
    }

    /**
     * 设置游戏模式名称
     * 注意：必须在onEnter之前调用
     */
    public setGameModeName(name: string): void {
        if (this.isActive) {
            console.warn('[PlayingStage] Cannot change game mode while stage is active');
            return;
        }

        this.gameModeName = name;
        console.log(`[PlayingStage] Game mode set to: ${name}`);
    }
}
