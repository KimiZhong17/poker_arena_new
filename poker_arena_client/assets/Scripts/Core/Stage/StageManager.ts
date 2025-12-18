import { GameStage } from '../GameStage';
import { GameStageBase } from './GameStageBase';

/**
 * 阶段管理器
 * 负责管理游戏的所有阶段，控制阶段之间的切换
 *
 * 职责：
 * - 注册和存储所有游戏阶段
 * - 处理阶段之间的切换逻辑
 * - 确保阶段切换的正确性（调用onExit和onEnter）
 * - 提供当前阶段的查询接口
 *
 * 使用示例：
 * ```typescript
 * const stageManager = new StageManager();
 * stageManager.registerStage(GameStage.READY, new ReadyStage(game, node));
 * stageManager.registerStage(GameStage.PLAYING, new PlayingStage(game, node));
 * stageManager.switchToStage(GameStage.READY);
 * ```
 */
export class StageManager {
    private currentStage: GameStageBase | null = null;
    private currentStageType: GameStage | null = null;
    private stages: Map<GameStage, GameStageBase> = new Map();

    /**
     * 注册一个游戏阶段
     * @param stageType 阶段类型（READY、PLAYING、END）
     * @param stage 阶段实例
     */
    public registerStage(stageType: GameStage, stage: GameStageBase): void {
        if (this.stages.has(stageType)) {
            console.warn(`[StageManager] Stage ${stageType} is already registered. Overwriting...`);
        }

        this.stages.set(stageType, stage);
        console.log(`[StageManager] Registered stage: ${stageType}`);
    }

    /**
     * 注销一个游戏阶段
     * @param stageType 阶段类型
     */
    public unregisterStage(stageType: GameStage): void {
        const stage = this.stages.get(stageType);
        if (stage) {
            // 如果当前阶段是要注销的阶段，先退出
            if (this.currentStageType === stageType) {
                stage.onExit();
                this.currentStage = null;
                this.currentStageType = null;
            }

            stage.cleanup();
            this.stages.delete(stageType);
            console.log(`[StageManager] Unregistered stage: ${stageType}`);
        }
    }

    /**
     * 切换到指定阶段
     * @param stageType 目标阶段类型
     * @returns 切换是否成功
     */
    public switchToStage(stageType: GameStage): boolean {
        // 检查目标阶段是否已注册
        const targetStage = this.stages.get(stageType);
        if (!targetStage) {
            console.error(`[StageManager] Cannot switch to stage ${stageType}: stage not registered`);
            return false;
        }

        // 如果已经在目标阶段，不需要切换
        if (this.currentStageType === stageType) {
            console.warn(`[StageManager] Already in stage ${stageType}`);
            return true;
        }

        console.log(`[StageManager] Switching from ${this.currentStageType || 'null'} to ${stageType}`);

        // 退出当前阶段（onExit 会自动调用 hideUI）
        if (this.currentStage) {
            console.log(`[StageManager] Exiting stage: ${this.currentStageType}`);
            this.currentStage.onExit();
        }

        // 进入新阶段
        this.currentStage = targetStage;
        this.currentStageType = stageType;

        console.log(`[StageManager] Entering stage: ${stageType}`);
        this.currentStage.onEnter();

        return true;
    }

    /**
     * 获取当前阶段
     */
    public getCurrentStage(): GameStageBase | null {
        return this.currentStage;
    }

    /**
     * 获取当前阶段类型
     */
    public getCurrentStageType(): GameStage | null {
        return this.currentStageType;
    }

    /**
     * 获取指定类型的阶段实例
     * @param stageType 阶段类型
     */
    public getStage(stageType: GameStage): GameStageBase | null {
        return this.stages.get(stageType) || null;
    }

    /**
     * 检查指定阶段是否已注册
     * @param stageType 阶段类型
     */
    public hasStage(stageType: GameStage): boolean {
        return this.stages.has(stageType);
    }

    /**
     * 每帧更新（如果当前阶段需要更新）
     * @param deltaTime 距离上一帧的时间间隔
     */
    public update(deltaTime: number): void {
        if (this.currentStage && this.currentStage.update) {
            this.currentStage.update(deltaTime);
        }
    }

    /**
     * 清理所有阶段
     * 通常在游戏结束或场景切换时调用
     */
    public cleanup(): void {
        console.log('[StageManager] Cleaning up all stages...');

        // 退出当前阶段
        if (this.currentStage) {
            this.currentStage.onExit();
            this.currentStage = null;
            this.currentStageType = null;
        }

        // 清理所有阶段
        for (const [stageType, stage] of this.stages) {
            console.log(`[StageManager] Cleaning up stage: ${stageType}`);
            stage.cleanup();
        }

        this.stages.clear();
        console.log('[StageManager] All stages cleaned up');
    }

    /**
     * 获取所有已注册的阶段类型
     */
    public getRegisteredStages(): GameStage[] {
        return Array.from(this.stages.keys());
    }
}
