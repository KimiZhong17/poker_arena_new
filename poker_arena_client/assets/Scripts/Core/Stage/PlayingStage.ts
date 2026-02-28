import { Node } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Scenes/Game';
import { GameStage } from './StageManager';
import { GameModeClientBase } from '../GameMode/GameModeClientBase';
import { TheDecreeModeClient } from '../GameMode/TheDecreeModeClient';
import { EndStage } from './EndStage';
import { logger } from '../../Utils/Logger';

const log = logger('PlayingStage');

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
    private currentGameMode: GameModeClientBase | null = null;

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
        log.debug(`Entering playing stage (mode: ${this.gameModeName})`);
        this.isActive = true;

        // 1. 创建游戏模式
        this.createGameMode();

        if (!this.currentGameMode) {
            log.error('Failed to create game mode!');
            return;
        }

        // 2. 进入游戏模式（会调用showUI和adjustPlayerLayout）
        this.currentGameMode.onEnter();

        // 3. 显示Playing阶段的UI（如果有）
        this.showUI();

        log.debug('Game started');
    }

    /**
     * 离开游玩阶段
     */
    public onExit(): void {
        log.debug('Exiting playing stage');

        // 1. 退出游戏模式
        if (this.currentGameMode) {
            this.currentGameMode.onExit();
        }

        // 2. 调用基类的 onExit（会自动隐藏UI）
        super.onExit();
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

        log.debug('UI shown');
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

        log.debug('UI hidden');
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        log.debug('Cleaning up');

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
        log.debug(`Creating game mode: ${this.gameModeName}`);

        // 动态导入并创建游戏模式
        // 注意：这里需要根据实际的游戏模式类来实现
        if (this.gameModeName === 'the_decree') {
            this.currentGameMode = this.createTheDecreeMode();
        // } else if (this.gameModeName === 'guandan') {
        //     this.currentGameMode = this.createGuandanMode();
        } else {
            log.error(`Unknown game mode: ${this.gameModeName}`);
            // 默认使用TheDecree
            this.currentGameMode = this.createTheDecreeMode();
        }

        if (this.currentGameMode) {
            log.debug(`Game mode created: ${this.currentGameMode.getConfig().name}`);
        }
    }

    /**
     * 创建The Decree游戏模式（网络版）
     */
    private createTheDecreeMode(): GameModeClientBase | null {
        try {
            // 创建配置
            const config = {
                id: 'the_decree',
                name: 'TheDecree',
                displayName: '未定之数',
                minPlayers: 2,
                maxPlayers: 4,
                deckCount: 1,
                initialHandSize: 5,
                description: 'Texas Hold\'em inspired poker game'
            };

            // 创建实例（网络版）
            const mode = new TheDecreeModeClient(this.game, config);

            // 将模式引用传递给 Game（用于遗留方法）
            this.game.theDecreeModeRef = mode;

            return mode;
        } catch (error) {
            log.error('Failed to create TheDecreeModeClient:', error);
            return null;
        }
    }

    // /**
    //  * 创建Guandan游戏模式
    //  */
    // private createGuandanMode(): GameModeClientBase | null {
    //     try {
    //         // 创建配置
    //         const config = {
    //             id: 'guandan',
    //             name: 'Guandan',
    //             displayName: '掼蛋',
    //             minPlayers: 4,
    //             maxPlayers: 5,
    //             deckCount: 3,
    //             initialHandSize: 31,
    //             description: 'Popular Chinese card game'
    //         };

    //         // 创建实例
    //         const mode = new GuandanMode(this.game, config);
    //         return mode;
    //     } catch (error) {
    //         log.error('Failed to create GuandanMode:', error);
    //         log.warn('GuandanMode not implemented yet, using TheDecree as fallback');
    //         return this.createTheDecreeMode();
    //     }
    // }

    // ==================== 公共接口 ====================

    /**
     * 游戏结束回调
     * 由GameMode在游戏结束时调用
     * @param gameResult 游戏结果数据（可选）
     */
    public onGameFinished(gameResult?: any): void {
        log.debug('Game finished', gameResult);

        // 切换到结束阶段
        const stageManager = this.game.stageManager;
        if (stageManager) {
            // 先获取 EndStage 实例
            const endStage = stageManager.getStage(GameStage.END) as EndStage;

            // 如果有游戏结果，先设置给 EndStage
            if (gameResult && endStage) {
                log.debug('Setting game result to EndStage:', gameResult);
                endStage.setGameResult(gameResult);
            }

            // 切换到 EndStage
            stageManager.switchToStage(GameStage.END);
        } else {
            log.error('StageManager not found on Game!');
        }
    }

    /**
     * 获取当前游戏模式
     */
    public getCurrentGameMode(): GameModeClientBase | null {
        return this.currentGameMode;
    }

    /**
     * 设置游戏模式名称
     * 注意：必须在onEnter之前调用
     */
    public setGameModeName(name: string): void {
        if (this.isActive) {
            log.warn('Cannot change game mode while stage is active');
            return;
        }

        this.gameModeName = name;
        log.debug(`Game mode set to: ${name}`);
    }
}
