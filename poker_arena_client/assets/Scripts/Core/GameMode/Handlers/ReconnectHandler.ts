import { GameModeClientBase } from "../GameModeClientBase";
import { LocalGameStore } from "../../../State/GameStore";
import { logger } from "../../../Utils/Logger";

const log = logger('ReconnectHandler');

/**
 * 重连恢复 Handler
 * 负责：恢复手牌显示、分数显示、托管状态
 */
export class ReconnectHandler {
    private mode: GameModeClientBase;

    constructor(mode: GameModeClientBase) {
        this.mode = mode;
    }

    /**
     * 恢复手牌显示
     * @param myHandCards 主玩家手牌
     * @param enableCardSelectionCallback 启用选牌的回调（由子类提供）
     */
    public restoreHandCardsDisplay(myHandCards: number[], enableCardSelectionCallback?: () => void): void {
        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) {
            log.error('PlayerUIManager not found');
            return;
        }

        // 恢复主玩家手牌
        const playerUIController = playerUIManager.getPlayerUINode(0);
        if (playerUIController) {
            const player = playerUIController.getPlayer();
            if (player) {
                player.setHandCards(myHandCards);
                playerUIManager.updatePlayerHand(0);
                log.debug('Main player hand restored:', myHandCards.length, 'cards');

                // 应用 glow 特效
                const glowMaterial = game.glowMaterial;
                if (glowMaterial) {
                    const handDisplay = playerUIController.getHandDisplay();
                    if (handDisplay) {
                        handDisplay.setGlowMaterialAndApply(glowMaterial);
                    }
                }
            }
        }

        // 恢复其他玩家手牌数量
        const gameStore = LocalGameStore.getInstance();
        const allPlayerData = gameStore.getAllPlayerGameData();

        for (const playerData of allPlayerData) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(playerData.playerId);
            if (playerIndex <= 0) continue;

            const otherCtrl = playerUIManager.getPlayerUINode(playerIndex);
            if (otherCtrl) {
                const otherPlayer = otherCtrl.getPlayer();
                if (otherPlayer) {
                    const emptyCards = Array(playerData.cardCount).fill(-1);
                    otherPlayer.setHandCards(emptyCards);
                    playerUIManager.updatePlayerHand(playerIndex);
                    log.debug(`Player ${playerIndex} hand count restored: ${playerData.cardCount}`);
                }
            }
        }

        // 启用卡牌选择
        if (enableCardSelectionCallback) {
            enableCardSelectionCallback();
        }
    }

    /**
     * 恢复分数显示
     */
    public restoreScoresDisplay(): void {
        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) return;

        const gameStore = LocalGameStore.getInstance();
        const allScores = gameStore.getAllScores();

        for (const [playerId, score] of allScores) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (playerUINode) {
                playerUINode.updateScore(score);
                log.debug(`Restored score for player ${playerIndex}: ${score}`);
            }
        }
    }

    /**
     * 从 LocalGameStore 恢复所有玩家的托管状态
     */
    public applyAutoStatesFromGameStore(): void {
        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) return;

        const gameStore = LocalGameStore.getInstance();
        const allPlayerData = gameStore.getAllPlayerGameData();

        for (const playerData of allPlayerData) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(playerData.playerId);
            if (playerIndex === -1) continue;
            playerUIManager.setPlayerAutoStatus(playerIndex, playerData.isAuto, playerData.autoReason);
        }
    }
}
