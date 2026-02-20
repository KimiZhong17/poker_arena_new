import { Button, Label, Node } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { GameStage } from './StageManager';
import { RoomService } from '../../Services/RoomService';
import { logger } from '../../Utils/Logger';

const log = logger('EndStage');

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

    // 玩家名字和分数标签（最多4个玩家）
    private nameLabels: (Label | null)[] = [null, null, null, null];
    private scoreLabels: (Label | null)[] = [null, null, null, null];

    // 游戏结果数据
    private gameResult: any = null;

    constructor(game: Game, rootNode: Node | null = null) {
        super(game, rootNode);
    }

    /**
     * 进入结束阶段
     */
    public onEnter(): void {
        log.debug('Entering end stage');
        this.isActive = true;

        // 1. 显示UI
        this.showUI();

        // 2. 设置按钮事件
        this.setupButtons();

        // 3. 显示游戏结果
        this.displayResults();

        log.debug('Game ended, showing results');
    }

    /**
     * 离开结束阶段
     */
    public onExit(): void {
        log.debug('Exiting end stage');

        // 1. 清理按钮事件
        this.cleanupButtons();

        // 2. 清理结果数据
        this.gameResult = null;

        // 3. 调用基类的 onExit（会自动隐藏UI）
        super.onExit();
    }

    /**
     * 显示结束阶段UI
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
            log.debug('UI shown');
        } else {
            log.warn('Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏结束阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            log.debug('UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        log.debug('Cleaning up');
        this.cleanupButtons();
        this.gameResult = null;
    }

    // ==================== 私有方法 ====================

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            log.warn('Cannot setup buttons: root node not set');
            return;
        }

        log.debug('Setting up buttons...');
        log.debug('rootNode:', this.rootNode.name);
        log.debug('rootNode children:', this.rootNode.children.map(c => c.name).join(', '));

        // 先尝试在 ResultPanel 子节点中查找按钮
        const resultPanel = this.rootNode.getChildByName('ResultPanel');
        if (resultPanel) {
            log.debug('Found ResultPanel, searching buttons inside it');
            log.debug('ResultPanel children:', resultPanel.children.map(c => c.name).join(', '));
        }

        // 查找按钮（支持 btn_restart 作为主要名称）
        this.btnPlayAgain = this.findButton('btn_restart', 'btn_play_again');
        this.btnReturnLobby = this.findButton('btn_return_lobby', 'ReturnLobbyButton');

        // 注册事件
        if (this.btnPlayAgain) {
            this.btnPlayAgain.node.on(Button.EventType.CLICK, this.onPlayAgainClicked, this);
            log.debug('✓ Play again button registered');
        } else {
            log.warn('✗ Play again button not found');
        }

        if (this.btnReturnLobby) {
            this.btnReturnLobby.node.on(Button.EventType.CLICK, this.onReturnLobbyClicked, this);
            log.debug('✓ Return lobby button registered');
        } else {
            log.warn('✗ Return lobby button not found (optional)');
        }

        // 查找结果Label（旧版兼容）
        this.labelResult = this.findLabel('label_result', 'ResultLabel');

        // 查找玩家名字和分数标签（新版）
        this.findPlayerLabels();
    }

    /**
     * 清理按钮事件
     */
    private cleanupButtons(): void {
        if (this.btnPlayAgain && this.btnPlayAgain.node) {
            this.btnPlayAgain.node.off(Button.EventType.CLICK, this.onPlayAgainClicked, this);
            this.btnPlayAgain = null;
        }

        if (this.btnReturnLobby && this.btnReturnLobby.node) {
            this.btnReturnLobby.node.off(Button.EventType.CLICK, this.onReturnLobbyClicked, this);
            this.btnReturnLobby = null;
        }

        this.labelResult = null;
        this.nameLabels = [null, null, null, null];
        this.scoreLabels = [null, null, null, null];

        log.debug('Buttons cleaned up');
    }

    /**
     * 查找按钮
     * @param primaryName 主要名称
     * @param fallbackName 备用名称
     */
    private findButton(primaryName: string, fallbackName: string): Button | null {
        if (!this.rootNode) return null;

        // 先尝试在 ResultPanel 子节点中查找
        const resultPanel = this.rootNode.getChildByName('ResultPanel');
        const searchRoot = resultPanel || this.rootNode;

        // 先尝试主要名称
        let btnNode = searchRoot.getChildByName(primaryName);
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                log.debug(`✓ Found button: ${primaryName}`);
                return button;
            }
        }

        // 尝试备用名称
        btnNode = searchRoot.getChildByName(fallbackName);
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                log.debug(`✓ Found button: ${fallbackName}`);
                return button;
            }
        }

        // 如果在 ResultPanel 中没找到，再尝试在 rootNode 中查找
        if (resultPanel) {
            btnNode = this.rootNode.getChildByName(primaryName);
            if (btnNode) {
                const button = btnNode.getComponent(Button);
                if (button) {
                    log.debug(`✓ Found button in rootNode: ${primaryName}`);
                    return button;
                }
            }

            btnNode = this.rootNode.getChildByName(fallbackName);
            if (btnNode) {
                const button = btnNode.getComponent(Button);
                if (button) {
                    log.debug(`✓ Found button in rootNode: ${fallbackName}`);
                    return button;
                }
            }
        }

        log.warn(`✗ Button not found: ${primaryName} or ${fallbackName}`);
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
                log.debug(`Found label: ${primaryName}`);
                return label;
            }
        }

        // 尝试备用名称
        labelNode = this.rootNode.getChildByName(fallbackName);
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label) {
                log.debug(`Found label: ${fallbackName}`);
                return label;
            }
        }

        log.warn(`Label not found: ${primaryName} or ${fallbackName}`);
        return null;
    }

    /**
     * 查找玩家名字和分数标签
     */
    private findPlayerLabels(): void {
        if (!this.rootNode) return;

        // 先尝试在 ResultPanel 子节点中查找
        const resultPanel = this.rootNode.getChildByName('ResultPanel');
        const searchRoot = resultPanel || this.rootNode;

        log.debug(`Searching for labels in: ${searchRoot.name}`);
        log.debug(`Children count: ${searchRoot.children.length}`);
        log.debug(`Children names:`, searchRoot.children.map(c => c.name).join(', '));

        // 查找 text_name_0/1/2/3 和 text_score_0/1/2/3
        for (let i = 0; i < 4; i++) {
            // 查找名字标签
            const nameNode = searchRoot.getChildByName(`text_name_${i}`);
            if (nameNode) {
                this.nameLabels[i] = nameNode.getComponent(Label);
                if (this.nameLabels[i]) {
                    log.debug(`✓ Found name label: text_name_${i}`);
                } else {
                    log.warn(`✗ Node text_name_${i} found but has no Label component`);
                }
            } else {
                log.warn(`✗ Node text_name_${i} not found`);
            }

            // 查找分数标签
            const scoreNode = searchRoot.getChildByName(`text_score_${i}`);
            if (scoreNode) {
                this.scoreLabels[i] = scoreNode.getComponent(Label);
                if (this.scoreLabels[i]) {
                    log.debug(`✓ Found score label: text_score_${i}`);
                } else {
                    log.warn(`✗ Node text_score_${i} found but has no Label component`);
                }
            } else {
                log.warn(`✗ Node text_score_${i} not found`);
            }
        }
    }

    /**
     * 显示游戏结果
     */
    private displayResults(): void {
        if (!this.gameResult) {
            log.debug('No game result data, showing default message');
            this.setResultText('游戏结束');
            this.clearPlayerLabels();
            return;
        }

        // 优先使用新版 UI（text_name_X 和 text_score_X）
        if (this.hasPlayerLabels()) {
            this.displayResultsInPlayerLabels(this.gameResult);
        } else {
            // 降级到旧版 UI（单个 label_result）
            const resultText = this.formatGameResult(this.gameResult);
            this.setResultText(resultText);
        }

        log.debug('Game results displayed');
    }

    /**
     * 检查是否有玩家标签
     */
    private hasPlayerLabels(): boolean {
        return this.nameLabels.some(label => label !== null) ||
               this.scoreLabels.some(label => label !== null);
    }

    /**
     * 截断过长的玩家名字，用省略号代替
     * @param name 玩家名字
     * @param maxLength 最大长度（默认9个字符）
     */
    private truncatePlayerName(name: string, maxLength: number = 9): string {
        if (name.length <= maxLength) {
            return name;
        }
        return name.substring(0, maxLength) + '...';
    }

    /**
     * 在玩家标签中显示结果
     */
    private displayResultsInPlayerLabels(result: any): void {
        log.debug('========== displayResultsInPlayerLabels ==========');
        log.debug('Input result:', result);

        // 清空所有标签
        this.clearPlayerLabels();

        // 解析游戏结果
        let rankings: Array<{ name: string, score: number }> = [];

        // 支持多种结果格式
        if (Array.isArray(result.rankings)) {
            // 格式1: { rankings: [{ name: "玩家A", score: 100 }, ...] }
            rankings = result.rankings;
            log.debug('Using format 1: result.rankings');
        } else if (result.scores) {
            // 格式2: { scores: { "player1": 100, "player2": 80 } }
            rankings = Object.entries(result.scores)
                .map(([name, score]) => ({ name, score: score as number }))
                .sort((a, b) => b.score - a.score); // 按分数降序排序
            log.debug('Using format 2: result.scores');
        } else if (result.players) {
            // 格式3: { players: [{ name: "玩家A", score: 100 }, ...] }
            rankings = [...result.players].sort((a, b) => b.score - a.score);
            log.debug('Using format 3: result.players');
        }

        log.debug('Parsed rankings:', rankings);
        log.debug('Rankings count:', rankings.length);

        // 显示排名（最多4个玩家）
        for (let i = 0; i < Math.min(rankings.length, 4); i++) {
            const player = rankings[i];
            log.debug(`Setting player ${i}:`, player);

            // 设置名字（限制名字长度）
            if (this.nameLabels[i]) {
                const truncatedName = this.truncatePlayerName(player.name);
                this.nameLabels[i]!.string = truncatedName;
                log.debug(`Set nameLabel[${i}] to: "${truncatedName}"`);
            } else {
                log.warn(`nameLabel[${i}] is null!`);
            }

            // 设置分数
            if (this.scoreLabels[i]) {
                const scoreText = `${player.score}`;
                this.scoreLabels[i]!.string = scoreText;
                log.debug(`Set scoreLabel[${i}] to: "${scoreText}"`);
            } else {
                log.warn(`scoreLabel[${i}] is null!`);
            }
        }

        log.debug(`Displayed ${rankings.length} player results`);
        log.debug('=====================================');
    }

    /**
     * 清空玩家标签
     */
    private clearPlayerLabels(): void {
        for (let i = 0; i < 4; i++) {
            if (this.nameLabels[i]) {
                this.nameLabels[i]!.string = '';
            }
            if (this.scoreLabels[i]) {
                this.scoreLabels[i]!.string = '';
            }
        }
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
            log.debug(`Result text (label not found): ${text}`);
        }
    }

    /**
     * "再来一局"按钮点击回调
     */
    private onPlayAgainClicked(): void {
        log.debug('Play again clicked');

        // 检查是否在线模式
        const networkClient = this.game.networkClient;
        if (networkClient && networkClient.getIsConnected()) {
            // 在线模式：先发送重启请求到服务器，然后立即切换到ReadyStage
            log.debug('Sending restart game request to server');
            const roomService = RoomService.getInstance();
            roomService.restartGame();

            // 立即切换到ReadyStage（不等服务器响应）
            log.debug('Immediately switching to Ready stage');
            const stageManager = this.game.stageManager;
            if (stageManager) {
                stageManager.switchToStage(GameStage.READY);
            } else {
                log.error('StageManager not found on Game!');
            }
        } else {
            // 单机模式：直接切换回准备阶段
            log.debug('Single player mode, switching to Ready stage directly');
            const stageManager = this.game.stageManager;
            if (stageManager) {
                stageManager.switchToStage(GameStage.READY);
            } else {
                log.error('StageManager not found on Game!');
            }
        }
    }

    /**
     * "返回大厅"按钮点击回调
     */
    private onReturnLobbyClicked(): void {
        log.debug('Return to lobby clicked');

        // TODO: 实现返回大厅的逻辑
        // 通常是切换场景
        log.warn('Return to lobby not implemented yet');

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
        log.debug('========== Game result set ==========');
        log.debug('Result data:', JSON.stringify(result, null, 2));
        log.debug('Has rankings:', Array.isArray(result?.rankings));
        log.debug('Rankings length:', result?.rankings?.length);
        log.debug('=====================================');

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
