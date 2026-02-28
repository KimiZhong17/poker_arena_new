import { GameModeClientBase } from "../GameModeClientBase";
import { ShowdownResult } from "../../../Network/Messages";
import { LocalGameStore } from "../../../State/GameStore";
import { logger } from "../../../Utils/Logger";

const log = logger('ShowdownHandler');

/**
 * 摊牌展示 Handler
 * 负责：摊牌时显示所有玩家出的牌、依次展示牌型、赢家消息、清理
 */
export class ShowdownHandler {
    private mode: GameModeClientBase;

    // 摊牌展示配置
    private readonly SHOWDOWN_INTERVAL_MS = 1000;
    private readonly WINNER_MESSAGE_DURATION = 3.0;
    private readonly WINNER_COLOR = '#FFD700';

    // 摊牌状态
    private showdownClearTimer: number | null = null;
    private _isShowdownInProgress: boolean = false;

    constructor(mode: GameModeClientBase) {
        this.mode = mode;
    }

    public get isShowdownInProgress(): boolean { return this._isShowdownInProgress; }

    // ==================== 摊牌主流程 ====================

    /**
     * 处理摊牌事件
     * @param results 摊牌结果数组
     * @param onPendingGameOver 摊牌完成后如果有待处理的 GameOver，调用此回调
     */
    public onShowdown(results: ShowdownResult[], onShowdownComplete: () => void): void {
        this._isShowdownInProgress = true;

        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) {
            log.error('PlayerUIManager not found');
            return;
        }

        // 显示所有玩家出的牌
        for (const result of results) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(result.playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) continue;

            const handDisplay = playerUINode.getHandDisplay();
            if (!handDisplay) continue;

            const myId = LocalGameStore.getInstance().getMyPlayerId();
            const isMe = result.playerId === myId;

            if (isMe) {
                const isAuto = LocalGameStore.getInstance().isPlayerAuto(myId);
                if (isAuto) {
                    // 托管出牌：选中并高亮
                    const player = playerUINode.getPlayer();
                    const handCards = player ? player.handCards : [];
                    const indicesToSelect: number[] = [];
                    for (const playedCard of result.cards) {
                        const index = handCards.indexOf(playedCard);
                        if (index !== -1) indicesToSelect.push(index);
                    }
                    if (indicesToSelect.length > 0) {
                        handDisplay.selectCards(indicesToSelect);
                    }
                    playerUIManager.lockUnselectedCards(0);
                }
                // 手动出牌：牌已经高亮，不需要更新
            } else {
                handDisplay.updateDisplay(result.cards);
            }
        }

        // 从所有玩家手牌中移除已出的牌
        for (const result of results) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(result.playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) continue;

            const player = playerUINode.getPlayer();
            if (player) {
                if (playerIndex === 0) {
                    // 主玩家：按牌值过滤（有真实牌值）
                    const remainingCards = player.handCards.filter(card => !result.cards.includes(card));
                    player.setHandCards(remainingCards);
                } else {
                    // 其他玩家：handCards 是 [-1, -1, ...] 无法按牌值匹配，直接按出牌数量截断
                    const removeCount = result.cards.length;
                    const remaining = player.handCards.slice(0, Math.max(0, player.handCards.length - removeCount));
                    player.setHandCards(remaining);
                }
            }
        }

        // 清除之前的定时器
        this.clearShowdownTimer();

        // 按牌型强度排序（从弱到强），依次展示
        const sortedResults = [...results].sort((a, b) => a.handType - b.handType);
        this._onShowdownComplete = onShowdownComplete;
        this.showHandTypesSequentially(sortedResults, 0);
    }

    // ==================== 牌型展示 ====================

    private _onShowdownComplete: (() => void) | null = null;

    private showHandTypesSequentially(sortedResults: ShowdownResult[], index: number): void {
        if (index >= sortedResults.length) {
            this.showWinnerMessageAndCleanup(sortedResults);
            return;
        }

        const result = sortedResults[index];
        const playerIndex = this.mode.getPlayerIndexByPlayerId(result.playerId);

        if (playerIndex === -1) {
            this.showHandTypesSequentially(sortedResults, index + 1);
            return;
        }

        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) return;

        const scoreText = result.isWinner
            ? `${result.handTypeName} +${result.score}+1`
            : `${result.handTypeName} +${result.score}`;

        const color = result.isWinner ? this.WINNER_COLOR : this.getHandTypeColor(result.handType);

        playerUIManager.updatePlayerHandType(playerIndex, scoreText, color);

        this.showdownClearTimer = setTimeout(() => {
            this.showHandTypesSequentially(sortedResults, index + 1);
        }, this.SHOWDOWN_INTERVAL_MS) as unknown as number;
    }

    private showWinnerMessageAndCleanup(sortedResults: ShowdownResult[]): void {
        const winner = sortedResults.find(r => r.isWinner);
        if (!winner) {
            this.clearShowdownDisplay();
            return;
        }

        const winnerName = this.mode.getPlayerName(winner.playerId);
        this.mode.showMessage(`${winnerName} 获胜！`, this.WINNER_MESSAGE_DURATION);

        this.showdownClearTimer = setTimeout(() => {
            this.clearShowdownDisplay();
        }, this.WINNER_MESSAGE_DURATION * 1000) as unknown as number;
    }

    // ==================== 清理 ====================

    public clearShowdownTimer(): void {
        if (this.showdownClearTimer !== null) {
            clearTimeout(this.showdownClearTimer);
            this.showdownClearTimer = null;
        }
    }

    /**
     * 清除摊牌显示，恢复手牌背面，清除牌型
     */
    public clearShowdownDisplay(): void {
        log.debug('Clearing showdown display...');
        this.clearShowdownTimer();

        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) {
            this.onShowdownAnimationComplete();
            return;
        }

        const playerCount = playerUIManager.getPlayerCount();
        playerUIManager.clearAllHandTypes();

        // 恢复主玩家手牌透明度（不重新布局，避免补牌前提前居中）
        // 实际的重新布局由后续的 deal_cards 事件触发
        playerUIManager.unlockCards(0);

        // 发牌动画进行中时跳过其他玩家的 updateDisplay，
        // 因为 handCards 已被提前更新为补牌后的完整数据，直接渲染会覆盖动画状态
        const dealingInProgress = this.mode.isDealingInProgress();
        if (!dealingInProgress) {
            for (let i = 1; i < playerCount; i++) {
                const playerUINode = playerUIManager.getPlayerUINode(i);
                if (playerUINode) {
                    const handDisplay = playerUINode.getHandDisplay();
                    if (handDisplay) {
                        handDisplay.updateDisplay([]);
                    }
                }
            }
        }

        this.onShowdownAnimationComplete();
    }

    private onShowdownAnimationComplete(): void {
        log.debug('Showdown animation completed');
        this._isShowdownInProgress = false;

        if (this._onShowdownComplete) {
            const cb = this._onShowdownComplete;
            this._onShowdownComplete = null;
            cb();
        }
    }

    // ==================== 工具 ====================

    private getHandTypeColor(handType: number): string {
        if (handType >= 8) return '#FFD700';
        if (handType >= 6) return '#4169E1';
        if (handType >= 3) return '#32CD32';
        return '#FFFFFF';
    }
}
