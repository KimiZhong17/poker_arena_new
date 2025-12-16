import { Button, Label, Node } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { GameStage } from '../GameStage';

/**
 * 结束阶段
 *
 * 职责：
 * - 显示游戏结算UI
 * - 展示分数、排名、胜负等信息
 * - 提供"返回大厅"和"再来一局"选项
 *
 * 工作流程：
 * onEnter() -> 显示结算UI -> 展示游戏结果
 * 等待玩家选择...
 * 点击"再来一局" -> 切换回ReadyStage
 * 点击"返回大厅" -> 返回大厅场景
 *
 * 设计说明：
 * EndStage 是一个通用的结算阶段，接收游戏结果数据并展示。
 * 不同的游戏模式可能有不同的结果数据格式，但UI展示逻辑可以统一。
 */
export class EndStage extends GameStageBase {
    // UI元素
    private btnPlayAgain: Button | null = null;
    private btnReturnLobby: Button | null = null;
    private labelResult: Label | null = null;

    // 游戏结果数据
    private gameResult: any = null;

    constructor(game: Game, rootNode: Node | null = null) {
        super(game, rootNode);
    }

    /**
     * 进入结束阶段
     */
    public onEnter(): void {
        console.log('[EndStage] Entering end stage');
        this.isActive = true;

        // 1. 显示UI
        this.showUI();

        // 2. 设置按钮事件
        this.setupButtons();

        // 3. 显示游戏结果
        this.displayResults();

        console.log('[EndStage] Game ended, showing results');
    }

    /**
     * 离开结束阶段
     */
    public onExit(): void {
        console.log('[EndStage] Exiting end stage');
        this.isActive = false;

        // 1. 清理按钮事件
        this.cleanupButtons();

        // 2. 隐藏UI
        this.hideUI();

        // 3. 清理结果数据
        this.gameResult = null;
    }

    /**
     * 显示结束阶段UI
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
            console.log('[EndStage] UI shown');
        } else {
            console.warn('[EndStage] Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏结束阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            console.log('[EndStage] UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[EndStage] Cleaning up');
        this.cleanupButtons();
        this.gameResult = null;
    }

    // ==================== 私有方法 ====================

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            console.warn('[EndStage] Cannot setup buttons: root node not set');
            return;
        }

        // 查找按钮
        this.btnPlayAgain = this.findButton('btn_play_again', 'PlayAgainButton');
        this.btnReturnLobby = this.findButton('btn_return_lobby', 'ReturnLobbyButton');

        // 注册事件
        if (this.btnPlayAgain) {
            this.btnPlayAgain.node.on(Button.EventType.CLICK, this.onPlayAgainClicked, this);
            console.log('[EndStage] Play again button registered');
        }

        if (this.btnReturnLobby) {
            this.btnReturnLobby.node.on(Button.EventType.CLICK, this.onReturnLobbyClicked, this);
            console.log('[EndStage] Return lobby button registered');
        }

        // 查找结果Label
        this.labelResult = this.findLabel('label_result', 'ResultLabel');
    }

    /**
     * 清理按钮事件
     */
    private cleanupButtons(): void {
        if (this.btnPlayAgain) {
            this.btnPlayAgain.node.off(Button.EventType.CLICK, this.onPlayAgainClicked, this);
            this.btnPlayAgain = null;
        }

        if (this.btnReturnLobby) {
            this.btnReturnLobby.node.off(Button.EventType.CLICK, this.onReturnLobbyClicked, this);
            this.btnReturnLobby = null;
        }

        this.labelResult = null;

        console.log('[EndStage] Buttons cleaned up');
    }

    /**
     * 查找按钮
     * @param primaryName 主要名称
     * @param fallbackName 备用名称
     */
    private findButton(primaryName: string, fallbackName: string): Button | null {
        if (!this.rootNode) return null;

        // 先尝试主要名称
        let btnNode = this.rootNode.getChildByName(primaryName);
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                console.log(`[EndStage] Found button: ${primaryName}`);
                return button;
            }
        }

        // 尝试备用名称
        btnNode = this.rootNode.getChildByName(fallbackName);
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                console.log(`[EndStage] Found button: ${fallbackName}`);
                return button;
            }
        }

        console.warn(`[EndStage] Button not found: ${primaryName} or ${fallbackName}`);
        return null;
    }

    /**
     * 查找Label
     */
    private findLabel(primaryName: string, fallbackName: string): Label | null {
        if (!this.rootNode) return null;

        // 先尝试主要名称
        let labelNode = this.rootNode.getChildByName(primaryName);
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label) {
                console.log(`[EndStage] Found label: ${primaryName}`);
                return label;
            }
        }

        // 尝试备用名称
        labelNode = this.rootNode.getChildByName(fallbackName);
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label) {
                console.log(`[EndStage] Found label: ${fallbackName}`);
                return label;
            }
        }

        console.warn(`[EndStage] Label not found: ${primaryName} or ${fallbackName}`);
        return null;
    }

    /**
     * 显示游戏结果
     */
    private displayResults(): void {
        if (!this.gameResult) {
            console.log('[EndStage] No game result data, showing default message');
            this.setResultText('游戏结束');
            return;
        }

        // 根据游戏结果类型显示不同的信息
        const resultText = this.formatGameResult(this.gameResult);
        this.setResultText(resultText);

        console.log('[EndStage] Game results displayed');
    }

    /**
     * 格式化游戏结果为显示文本
     */
    private formatGameResult(result: any): string {
        // TODO: 根据实际的游戏结果格式来格式化
        // 这里提供一个通用的实现

        if (typeof result === 'string') {
            return result;
        }

        if (result.winner) {
            return `胜利者: ${result.winner}`;
        }

        if (result.scores) {
            let text = '最终分数:\n';
            for (const [playerId, score] of Object.entries(result.scores)) {
                text += `${playerId}: ${score}分\n`;
            }
            return text;
        }

        return '游戏结束';
    }

    /**
     * 设置结果文本
     */
    private setResultText(text: string): void {
        if (this.labelResult) {
            this.labelResult.string = text;
        } else {
            console.log(`[EndStage] Result text (label not found): ${text}`);
        }
    }

    /**
     * "再来一局"按钮点击回调
     */
    private onPlayAgainClicked(): void {
        console.log('[EndStage] Play again clicked');

        // 切换回准备阶段
        const stageManager = this.game.stageManager;
        if (stageManager) {
            stageManager.switchToStage(GameStage.READY);
        } else {
            console.error('[EndStage] StageManager not found on Game!');
        }
    }

    /**
     * "返回大厅"按钮点击回调
     */
    private onReturnLobbyClicked(): void {
        console.log('[EndStage] Return to lobby clicked');

        // TODO: 实现返回大厅的逻辑
        // 通常是切换场景
        console.warn('[EndStage] Return to lobby not implemented yet');

        // 临时实现：切换回准备阶段
        this.onPlayAgainClicked();
    }

    // ==================== 公共接口 ====================

    /**
     * 设置游戏结果数据
     * 通常在切换到EndStage之前调用
     * @param result 游戏结果数据
     */
    public setGameResult(result: any): void {
        this.gameResult = result;
        console.log('[EndStage] Game result set', result);

        // 如果已经在显示UI，立即更新
        if (this.isActive) {
            this.displayResults();
        }
    }

    /**
     * 获取游戏结果数据
     */
    public getGameResult(): any {
        return this.gameResult;
    }
}
