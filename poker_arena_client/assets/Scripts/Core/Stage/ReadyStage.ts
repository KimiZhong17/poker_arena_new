import { Button, Node } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { GameStage } from '../GameStage';

/**
 * 准备阶段
 *
 * 职责：
 * - 显示准备阶段UI（Node_ReadyStage）
 * - 管理准备按钮（btn_start）
 * - 跟踪玩家准备状态
 * - 所有玩家准备好后切换到Playing阶段
 *
 * 使用场景：
 * 1. 游戏刚开始时
 * 2. 从EndStage点击"再来一局"后
 *
 * 生命周期：
 * onEnter() -> 显示UI，注册按钮事件，重置状态
 * onExit() -> 隐藏UI，注销按钮事件
 */
export class ReadyStage extends GameStageBase {
    // UI元素
    private btnStart: Button | null = null;

    // 玩家准备状态
    // key: playerId (e.g., 'player_0', 'player_1')
    // value: 是否已准备
    private playerReadyStates: Map<string, boolean> = new Map();

    // 配置
    private totalPlayers: number = 1; // 默认1人（单机测试），后续可以改成多人

    constructor(game: Game, rootNode: Node | null = null) {
        super(game, rootNode);
    }

    /**
     * 进入准备阶段
     */
    public onEnter(): void {
        console.log('[ReadyStage] Entering ready stage');
        this.isActive = true;

        // 1. 重置状态
        this.resetReadyStates();

        // 2. 显示UI
        this.showUI();

        // 3. 设置按钮事件
        this.setupButtons();

        console.log('[ReadyStage] Waiting for players to ready up...');
    }

    /**
     * 离开准备阶段
     */
    public onExit(): void {
        console.log('[ReadyStage] Exiting ready stage');
        this.isActive = false;

        // 1. 清理按钮事件
        this.cleanupButtons();

        // 2. 隐藏UI
        this.hideUI();
    }

    /**
     * 显示准备阶段UI
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
            console.log('[ReadyStage] UI shown');
        } else {
            console.warn('[ReadyStage] Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏准备阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            console.log('[ReadyStage] UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[ReadyStage] Cleaning up');
        this.cleanupButtons();
        this.playerReadyStates.clear();
    }

    // ==================== 私有方法 ====================

    /**
     * 重置所有玩家的准备状态
     */
    private resetReadyStates(): void {
        this.playerReadyStates.clear();

        // 初始化所有玩家为未准备
        for (let i = 0; i < this.totalPlayers; i++) {
            const playerId = `player_${i}`;
            this.playerReadyStates.set(playerId, false);
        }

        console.log(`[ReadyStage] Reset ready states for ${this.totalPlayers} players`);
    }

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            console.warn('[ReadyStage] Cannot setup buttons: root node not set');
            return;
        }

        // 查找开始按钮
        this.btnStart = this.findStartButton();

        if (this.btnStart) {
            // 注册点击事件
            this.btnStart.node.on(Button.EventType.CLICK, this.onStartButtonClicked, this);
            console.log('[ReadyStage] Start button registered');
        } else {
            console.warn('[ReadyStage] Start button not found');
        }
    }

    /**
     * 清理按钮事件
     */
    private cleanupButtons(): void {
        if (this.btnStart) {
            this.btnStart.node.off(Button.EventType.CLICK, this.onStartButtonClicked, this);
            this.btnStart = null;
            console.log('[ReadyStage] Start button unregistered');
        }
    }

    /**
     * 查找开始按钮
     * 尝试多种方式查找：
     * 1. 直接通过名称查找 'btn_start'
     * 2. 查找子节点中的Button组件
     */
    private findStartButton(): Button | null {
        if (!this.rootNode) return null;

        // 方式1: 通过名称查找
        const btnNode = this.rootNode.getChildByName('btn_start');
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                console.log('[ReadyStage] Found start button by name: btn_start');
                return button;
            }
        }

        // 方式2: 遍历所有子节点查找第一个Button组件
        for (const child of this.rootNode.children) {
            const button = child.getComponent(Button);
            if (button) {
                console.log(`[ReadyStage] Found start button by component: ${child.name}`);
                return button;
            }
        }

        return null;
    }

    /**
     * 开始按钮点击回调
     */
    private onStartButtonClicked(): void {
        console.log('[ReadyStage] Start button clicked');

        // 标记player_0为已准备
        this.onPlayerReady('player_0');
    }

    /**
     * 玩家准备
     * @param playerId 玩家ID
     */
    private onPlayerReady(playerId: string): void {
        // 检查玩家是否存在
        if (!this.playerReadyStates.has(playerId)) {
            console.warn(`[ReadyStage] Unknown player: ${playerId}`);
            return;
        }

        // 标记为已准备
        this.playerReadyStates.set(playerId, true);
        console.log(`[ReadyStage] Player ${playerId} is ready`);

        // 检查是否所有玩家都准备好
        if (this.allPlayersReady()) {
            console.log('[ReadyStage] All players ready! Starting game...');
            this.startGame();
        } else {
            // 显示等待其他玩家的提示
            const readyCount = this.getReadyPlayerCount();
            console.log(`[ReadyStage] ${readyCount}/${this.totalPlayers} players ready`);
        }
    }

    /**
     * 检查是否所有玩家都准备好
     */
    private allPlayersReady(): boolean {
        for (const [playerId, isReady] of this.playerReadyStates) {
            if (!isReady) {
                return false;
            }
        }
        return true;
    }

    /**
     * 获取已准备的玩家数量
     */
    private getReadyPlayerCount(): number {
        let count = 0;
        for (const [playerId, isReady] of this.playerReadyStates) {
            if (isReady) {
                count++;
            }
        }
        return count;
    }

    /**
     * 开始游戏
     * 切换到Playing阶段
     */
    private startGame(): void {
        console.log('[ReadyStage] Switching to Playing stage...');

        // 通过StageManager切换到Playing阶段
        const stageManager = this.game.stageManager;
        if (stageManager) {
            stageManager.switchToStage(GameStage.PLAYING);
        } else {
            console.error('[ReadyStage] StageManager not found on Game!');
        }
    }

    // ==================== 公共接口（供外部调用）====================

    /**
     * 设置总玩家数
     * 通常在多人游戏中使用
     * @param count 玩家数量
     */
    public setTotalPlayers(count: number): void {
        if (count < 1) {
            console.warn('[ReadyStage] Total players must be at least 1');
            return;
        }

        this.totalPlayers = count;
        console.log(`[ReadyStage] Total players set to ${count}`);

        // 如果已经进入阶段，重置状态
        if (this.isActive) {
            this.resetReadyStates();
        }
    }

    /**
     * 手动标记玩家为准备状态
     * 用于网络同步或测试
     * @param playerId 玩家ID
     */
    public markPlayerReady(playerId: string): void {
        this.onPlayerReady(playerId);
    }

    /**
     * 获取玩家准备状态
     * @param playerId 玩家ID
     */
    public isPlayerReady(playerId: string): boolean {
        return this.playerReadyStates.get(playerId) || false;
    }

    /**
     * 获取所有玩家的准备状态
     */
    public getAllReadyStates(): Map<string, boolean> {
        return new Map(this.playerReadyStates);
    }
}
