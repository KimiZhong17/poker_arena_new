import { PlayingStage } from "../Stage/PlayingStage";
import { GameModeClientBase, GameModeConfig } from "./GameModeClientBase";
import { Game } from "../../Game";
import { PlayerInfo } from "../../LocalStore/LocalPlayerStore";
import { LocalRoomStore } from "../../LocalStore/LocalRoomStore";
import { Node } from "cc";
import {
    DealCardsEvent,
    CommunityCardsEvent,
    RequestFirstDealerSelectionEvent,
    PlayerSelectedCardEvent,
    FirstDealerRevealEvent,
    DealerSelectedEvent,
    DealerCalledEvent,
    PlayerPlayedEvent,
    ShowdownEvent,
    RoundEndEvent,
    GameOverEvent,
    PlayerAutoChangedEvent,
    ClientMessageType,
    SetAutoRequest
} from '../../Network/Messages';
import { LocalGameStore } from '../../LocalStore/LocalGameStore';
import { TheDecreeUIController } from '../../UI/TheDecreeUIController';
import { TheDecreeGameState } from './TheDecreeGameState';
import { EventCenter, GameEvents } from '../../Utils/EventCenter';
import { logger } from '../../Utils/Logger';
import { DealingHandler } from './Handlers/DealingHandler';
import { ShowdownHandler } from './Handlers/ShowdownHandler';
import { ReconnectHandler } from './Handlers/ReconnectHandler';

const log = logger('TheDecree');

/**
 * The Decree game mode - Network/Client version
 * 网络版未定之数游戏模式（客户端）
 *
 * 职责：
 * - 监听服务器事件并更新 UI
 * - 管理游戏模式特定的 UI 节点
 * - 委托发牌动画、摊牌展示、重连恢复给 Handler
 * - 通过 NetworkClient 发送玩家操作到服务器
 */
export class TheDecreeModeClient extends GameModeClientBase {
    // TheDecree 特有状态
    private gameState: TheDecreeGameState;
    private isPlayer0AutoPlay: boolean;

    // 待处理的 GameOver 事件（摊牌动画期间延迟处理）
    private _pendingGameOver: GameOverEvent | null;

    // UI 节点（游戏模式特定）
    private theDecreeContainerNode: Node | null;
    private communityCardsNode: Node | null;
    private theDecreeUIController: TheDecreeUIController | null;

    constructor(game: Game, config?: GameModeConfig) {
        super(game, config || {
            id: "the_decree",
            name: "TheDecree",
            displayName: "未定之数",
            minPlayers: 2,
            maxPlayers: 4,
            deckCount: 1,
            initialHandSize: 5,
            description: "Network multiplayer poker game"
        });

        // 初始化实例属性
        this.gameState = TheDecreeGameState.SETUP;
        this.isPlayer0AutoPlay = true;
        this._pendingGameOver = null;
        this.theDecreeContainerNode = null;
        this.communityCardsNode = null;
        this.theDecreeUIController = null;
    }

    private resetRuntimeState(): void {
        this.communityCards = [];
        this.dealerId = '';
        this.currentRoundNumber = 0;
        this.cardsToPlay = 0;
        this.gameState = TheDecreeGameState.SETUP;
        this._pendingGameOver = null;
        this.clearPendingTimeouts();

        if (this.dealingHandler instanceof DealingHandler) {
            this.dealingHandler.resetState();
        }
        if (this.showdownHandler instanceof ShowdownHandler) {
            this.showdownHandler.clearShowdownTimer();
        }
    }

    // ==================== 钩子覆盖 ====================

    public onDealAnimationComplete(): void {
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            log.debug('Card selection enabled via UI controller');
        }
    }

    public showMessage(msg: string, duration: number): void {
        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage(msg, duration);
        }
    }

    protected getEnableGrouping(): boolean { return false; }

    // ==================== 生命周期方法 ====================

    public onEnter(): void {
        log.debug('Entering game mode');
        this.isActive = true;

        this.resetRuntimeState();

        // 初始化 Handler
        this.dealingHandler = new DealingHandler(this);
        this.showdownHandler = new ShowdownHandler(this);
        this.reconnectHandler = new ReconnectHandler(this);

        // 查找并缓存游戏模式特定的节点
        this.findModeSpecificNodes();

        // 升级 PlayerUIManager 到游戏模式
        this.upgradePlayerUIToPlayingMode();

        this.showUI();
        this.setupNetworkEvents();
        this.setupLocalEvents();

        // 检查是否是重连场景
        this.checkAndRestoreReconnectState();

        log.debug('Waiting for server events...');
    }

    public onExit(): void {
        log.debug('Exiting game mode');
        this.isActive = false;

        if (this.showdownHandler instanceof ShowdownHandler) {
            this.showdownHandler.clearShowdownTimer();
        }
        this.clearPendingTimeouts();
        this._pendingGameOver = null;

        this.unregisterAllNetworkEvents();
        this.cleanupLocalEvents();
        this.hideUI();

        // 清理公牌节点
        if (this.communityCardsNode && this.communityCardsNode.isValid) {
            this.communityCardsNode.removeAllChildren();
        }

        this.theDecreeContainerNode = null;
        this.communityCardsNode = null;
    }

    public cleanup(): void {
        log.debug('Cleaning up');
        if (this.showdownHandler instanceof ShowdownHandler) {
            this.showdownHandler.clearShowdownTimer();
        }
        this.clearPendingTimeouts();
        super.cleanup();
        this.unregisterAllNetworkEvents();
        this.cleanupLocalEvents();
    }

    // ==================== 节点查找 ====================

    private findModeSpecificNodes(): void {
        this.theDecreeContainerNode = this.findNodeByName(this.game.node, 'TheDecree');
        if (this.theDecreeContainerNode) {
            this.theDecreeUIController = this.theDecreeContainerNode.getComponent(TheDecreeUIController);
        }

        this.communityCardsNode = this.findNodeByName(this.game.node, 'CommunityCardsNode');

        // 初始化发牌动画系统
        if (this.theDecreeContainerNode && this.dealingHandler instanceof DealingHandler) {
            this.dealingHandler.initDealingAnimation(this.theDecreeContainerNode, this.communityCardsNode);
        }
    }

    // ==================== UI 控制 ====================

    public showUI(): void {
        if (this.theDecreeContainerNode) {
            this.theDecreeContainerNode.active = true;
        }
        if (this.communityCardsNode) {
            this.communityCardsNode.active = true;
        }
        if (this.theDecreeUIController && this.theDecreeUIController.autoPlaySwitch) {
            this.theDecreeUIController.autoPlaySwitch.node.active = true;
        }

        // 隐藏其他游戏模式的节点
        const guandanNode = this.findNodeByName(this.game.node, 'Guandan');
        if (guandanNode) {
            guandanNode.active = false;
        }
    }

    public hideUI(): void {
        if (this.theDecreeContainerNode) {
            this.theDecreeContainerNode.active = false;
        }
        if (this.communityCardsNode) {
            this.communityCardsNode.active = false;
        }
    }

    // ==================== 网络事件监听 ====================

    protected setupNetworkEvents(): void {
        this.registerNetworkEvents({
            'deal_cards': this.onDealCards,
            'community_cards': this.onCommunityCards,
            'request_first_dealer_selection': this.onRequestFirstDealerSelection,
            'player_selected_card': this.onPlayerSelectedCard,
            'first_dealer_reveal': this.onFirstDealerReveal,
            'dealer_selected': this.onDealerSelected,
            'dealer_called': this.onDealerCalled,
            'player_played': this.onPlayerPlayed,
            'showdown': this.onShowdown,
            'round_end': this.onRoundEnd,
            'game_over': this.onGameOver,
            'player_auto_changed': this.onPlayerAutoChanged
        });
    }

    private setupLocalEvents(): void {
        EventCenter.on(GameEvents.GAME_RECONNECTED, this.onGameReconnected, this);
        EventCenter.on(GameEvents.PLAYER_AUTO_CHANGED, this.onPlayerAutoChangedEvent, this);
    }

    private cleanupLocalEvents(): void {
        EventCenter.off(GameEvents.GAME_RECONNECTED, this.onGameReconnected, this);
        EventCenter.off(GameEvents.PLAYER_AUTO_CHANGED, this.onPlayerAutoChangedEvent, this);
    }

    private onGameReconnected = () => {
        log.debug('Game reconnected, resyncing UI/state...');

        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager && playerUIManager.getPlayerCount() === 0) {
            this.upgradePlayerUIToPlayingMode();
        } else {
            this.refreshPlayerIdMapping();
        }

        this.checkAndRestoreReconnectState(true);
    };

    private onPlayerAutoChangedEvent = (data: PlayerAutoChangedEvent) => {
        const playerIndex = this.getPlayerIndex(data.playerId);
        if (playerIndex === -1) return;

        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.setPlayerAutoStatus(playerIndex, data.isAuto, data.reason);
        }
    };

    // ==================== 事件处理器：发牌（委托 DealingHandler）====================

    private onDealCards(data: DealCardsEvent): void {
        if (this.dealingHandler instanceof DealingHandler) {
            this.dealingHandler.onDealCards(data);
        }
    }

    private onCommunityCards(data: CommunityCardsEvent): void {
        this.communityCards = data.cards;
        this.gameState = data.gameState as TheDecreeGameState;

        if (this.dealingHandler instanceof DealingHandler) {
            this.dealingHandler.onCommunityCards(data.cards);
        }
    }

    // ==================== 事件处理器：首庄选择（TheDecree 特有）====================

    private onRequestFirstDealerSelection(data: RequestFirstDealerSelectionEvent): void {
        this.gameState = data.gameState as TheDecreeGameState;

        // 缓存消息，等发牌动画完成后再显示
        if (this.dealingHandler instanceof DealingHandler) {
            this.dealingHandler.setPendingMessage({ message: '请选择一张手牌，牌最大的成为首个庄家', duration: 3.0 });
            this.dealingHandler.showPendingMessageIfReady();
        }

        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
        }
    }

    private onPlayerSelectedCard(data: PlayerSelectedCardEvent): void {
        const playerName = this.getPlayerName(data.playerId);
        log.debug(`${playerName} 已选择`);
    }

    private onFirstDealerReveal(data: FirstDealerRevealEvent): void {
        const dealerName = this.getPlayerName(data.dealerId);
        this.showMessage(`${dealerName} 成为首个庄家！`, 2.5);

        this.dealerId = data.dealerId;
        this.currentRoundNumber = 1;
        this.gameState = data.gameState as TheDecreeGameState;

        // 在 UI 上显示所有玩家选择的牌
        this.displayFirstDealerSelections(data.selections, data.dealerId);

        // 延迟后清除选择状态，准备游戏
        this.registerTimeout(() => {
            const playerUIManager = this.game.playerUIManager;
            if (playerUIManager) {
                playerUIManager.clearSelection(0);
                this.hideFirstDealerSelections();
            }

            const localRoomStore = LocalRoomStore.getInstance();
            const currentPlayerId = localRoomStore.getMyPlayerId();
            if (currentPlayerId === data.dealerId) {
                if (this.theDecreeUIController) {
                    this.theDecreeUIController.updateCallButtonsVisibility();
                }
            }
        }, 3000);
    }

    private displayFirstDealerSelections(selections: { playerId: string; card: number }[], dealerId: string): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) return;

        for (const selection of selections) {
            const playerIndex = this.getPlayerIndex(selection.playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) continue;

            const handDisplay = playerUINode.getHandDisplay();
            if (!handDisplay) continue;

            if (playerIndex !== 0) {
                handDisplay.updateDisplay([selection.card]);
            }
        }
    }

    private hideFirstDealerSelections(): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) return;

        const playerCount = playerUIManager.getPlayerCount();
        for (let i = 0; i < playerCount; i++) {
            const playerUINode = playerUIManager.getPlayerUINode(i);
            if (playerUINode) {
                const handDisplay = playerUINode.getHandDisplay();
                if (handDisplay) {
                    handDisplay.updateDisplay([]);
                }
            }
        }

        // 重新启用主玩家的卡牌选择功能
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
        }
    }

    // ==================== 事件处理器：庄家叫牌 / 出牌 ====================

    private onDealerSelected(data: DealerSelectedEvent): void {
        this.dealerId = data.dealerId;
        this.currentRoundNumber = data.roundNumber;
        this.gameState = data.gameState as TheDecreeGameState;

        // 重置 cardsToPlay
        this.cardsToPlay = 0;

        if (this.theDecreeUIController) {
            this.theDecreeUIController.updateUIState();
        }

        // 显示庄家指示器
        const dealerIndex = this.getPlayerIndex(data.dealerId);
        if (dealerIndex !== -1 && this.game.playerUIManager) {
            this.game.playerUIManager.showDealer(dealerIndex);
        }

        // 第一回合：call 按钮在 onFirstDealerReveal 延迟后显示
        if (data.roundNumber === 1) return;

        // 后续回合：如果本地玩家是庄家，立即显示叫牌按钮
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();
        if (currentPlayerId === data.dealerId && this.theDecreeUIController) {
            this.theDecreeUIController.updateCallButtonsVisibility();
        }
    }

    private onDealerCalled(data: DealerCalledEvent): void {
        this.cardsToPlay = data.cardsToPlay;
        this.gameState = data.gameState as TheDecreeGameState;

        // 清除上一回合的摊牌显示
        if (this.showdownHandler instanceof ShowdownHandler) {
            this.showdownHandler.clearShowdownDisplay();
        }

        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();
        const isDealer = currentPlayerId === data.dealerId;

        const dealerName = this.getPlayerName(data.dealerId);
        const message = isDealer
            ? `你叫了 ${data.cardsToPlay} 张牌`
            : `庄家 ${dealerName} 叫了 ${data.cardsToPlay} 张牌`;
        this.showMessage(message, 2.5);

        if (this.theDecreeUIController) {
            if (!isDealer) {
                this.theDecreeUIController.updateCallButtonsVisibility();
            }
            this.theDecreeUIController.updateUIState();
            this.theDecreeUIController.showCardsToPlayHint(data.cardsToPlay);
        }
    }

    private onPlayerPlayed(data: PlayerPlayedEvent): void {
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        if (data.playerId !== currentPlayerId) {
            const playerName = this.getPlayerName(data.playerId);
            this.showMessage(`${playerName} 已出牌`, 1.5);
        }
    }

    // ==================== 事件处理器：摊牌（委托 ShowdownHandler）====================

    private onShowdown(data: ShowdownEvent): void {
        this.gameState = data.gameState as TheDecreeGameState;

        // 隐藏出牌数量提示
        if (this.theDecreeUIController) {
            this.theDecreeUIController.hideCardsToPlayHint();
        }

        if (this.showdownHandler instanceof ShowdownHandler) {
            this.showdownHandler.onShowdown(data.results, () => {
                // 摊牌动画完成后，检查是否有待处理的 GameOver
                if (this._pendingGameOver) {
                    const pendingData = this._pendingGameOver;
                    this._pendingGameOver = null;
                    this.processGameOver(pendingData);
                }
            });
        }
    }

    // ==================== 事件处理器：回合结束 / 游戏结束 ====================

    private onRoundEnd(data: RoundEndEvent): void {
        this.gameState = data.gameState as TheDecreeGameState;
        this.cardsToPlay = 0;

        if (this.theDecreeUIController) {
            this.theDecreeUIController.hideCardsToPlayHint();
        }

        // 更新所有玩家的分数显示
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) return;

        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom || !currentRoom.players) return;

        const players = currentRoom.players;
        const mySeatIndex = localRoomStore.getMyPlayerId();
        const myPlayer = players.find(p => p.id === mySeatIndex);
        const myAbsoluteSeat = myPlayer ? myPlayer.seatIndex : 0;
        const totalSeats = players.length;

        for (const player of players) {
            const score = data.scores[player.id];
            if (score !== undefined) {
                const relativeSeat = playerUIManager.getRelativeSeatIndex(player.seatIndex, myAbsoluteSeat, totalSeats);
                const playerUINode = playerUIManager.getPlayerUINode(relativeSeat);
                if (playerUINode) {
                    playerUINode.updateScore(score);
                }
            }
        }
    }

    private onGameOver(data: GameOverEvent): void {
        this.gameState = data.gameState as TheDecreeGameState;

        // 如果摊牌动画正在进行，延迟处理
        if (this.showdownHandler instanceof ShowdownHandler && this.showdownHandler.isShowdownInProgress) {
            this._pendingGameOver = data;
            return;
        }

        this.processGameOver(data);
    }

    private processGameOver(data: GameOverEvent): void {
        const gameResult = this.prepareGameResult(data);

        const stageManager = this.game.stageManager;
        if (stageManager) {
            const playingStage = stageManager.getCurrentStage();
            if (playingStage instanceof PlayingStage) {
                playingStage.onGameFinished(gameResult);
            }
        }
    }

    private prepareGameResult(data: GameOverEvent): any {
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();

        if (!currentRoom || !currentRoom.players) {
            return { rankings: [], winnerId: data.winnerId, totalRounds: data.totalRounds };
        }

        const rankings = currentRoom.players.map(player => ({
            name: player.name,
            score: data.scores[player.id] || 0,
            isWinner: player.id === data.winnerId
        })).sort((a, b) => b.score - a.score);

        return { rankings, winnerId: data.winnerId, totalRounds: data.totalRounds };
    }

    // ==================== 托管相关 ====================

    private onPlayerAutoChanged(data: PlayerAutoChangedEvent): void {
        LocalGameStore.getInstance().setPlayerAuto(data.playerId, data.isAuto, data.reason);
    }

    public toggleAuto(): void {
        const myId = LocalGameStore.getInstance().getMyPlayerId();
        const isAuto = LocalGameStore.getInstance().isPlayerAuto(myId);
        this.setAuto(!isAuto);
    }

    public setAuto(isAuto: boolean): void {
        const request: SetAutoRequest = { isAuto };
        const networkClient = this.game.networkClient;
        if (!networkClient) return;
        networkClient.send(ClientMessageType.SET_AUTO, request);
    }

    // ==================== 重连恢复 ====================

    private checkAndRestoreReconnectState(force: boolean = false): void {
        try {
            const gameStore = LocalGameStore.getInstance();
            const communityCards = gameStore.getCommunityCards();
            const myHandCards = gameStore.getMyHandCards();

            if (!force && communityCards.length === 0 && myHandCards.length === 0) {
                log.debug('No reconnect data found, waiting for server events');
                return;
            }

            log.debug('========== Restoring Reconnect State ==========');
            this.refreshPlayerIdMapping();

            // 恢复游戏状态
            const savedGameState = gameStore.getGameState();
            if (savedGameState) {
                this.gameState = savedGameState;
            }

            // 恢复庄家信息
            const savedDealerId = gameStore.getDealerId();
            if (savedDealerId) {
                this.dealerId = savedDealerId;
                const dealerIndex = this.getPlayerIndex(savedDealerId);
                if (dealerIndex !== -1 && this.game.playerUIManager) {
                    this.game.playerUIManager.showDealer(dealerIndex);
                }
            }

            // 恢复叫牌数和回合数
            const savedCardsToPlay = gameStore.getCardsToPlay();
            if (savedCardsToPlay > 0) this.cardsToPlay = savedCardsToPlay;

            const savedRound = gameStore.getCurrentRound();
            if (savedRound > 0) this.currentRoundNumber = savedRound;

            // 恢复公共牌显示
            if (communityCards.length > 0 && this.dealingHandler instanceof DealingHandler) {
                this.communityCards = communityCards;
                this.dealingHandler.communityCardsDealt = true;
                this.dealingHandler.displayCommunityCards(communityCards);
            }

            // 恢复手牌显示
            if (this.reconnectHandler instanceof ReconnectHandler) {
                if (myHandCards.length > 0 && this.dealingHandler instanceof DealingHandler) {
                    this.dealingHandler.initialDealAnimationComplete = true;
                }
                this.reconnectHandler.restoreHandCardsDisplay(
                    myHandCards,
                    () => this.theDecreeUIController?.enableCardSelection()
                );
                this.reconnectHandler.restoreScoresDisplay();
                this.reconnectHandler.applyAutoStatesFromGameStore();
            }

            // 更新 UI 状态
            if (this.theDecreeUIController) {
                this.theDecreeUIController.updateUIState();
                this.theDecreeUIController.updateCallButtonsVisibility();

                if (this.gameState === TheDecreeGameState.PLAYER_SELECTION && this.cardsToPlay > 0) {
                    this.theDecreeUIController.showCardsToPlayHint(this.cardsToPlay);
                }
            }

            log.debug('========== Reconnect State Restored ==========');
        } catch (error) {
            log.error('Failed to restore reconnect state:', error);
        } finally {
            this.game.finishReconnectLoading();
        }
    }

    // ==================== 游戏逻辑接口（空实现，逻辑在服务器）====================

    public initGame(playerInfos: PlayerInfo[]): void {
        this.refreshPlayerIdMapping();
        if (this.playerIdToIndexMap.size === 0) {
            this.setupPlayerIdMapping(playerInfos);
        }
    }

    public dealCards(): void {}
    public isValidPlay(cards: number[], playerId: string): boolean { return true; }

    public playCards(cards: number[], playerId: string): boolean {
        return this.sendPlayCardsRequest(cards);
    }

    public isGameOver(): boolean { return false; }
    public getCurrentLevelRank(): number { return 0; }

    // ==================== 公共方法供 UI 调用 ====================

    public dealerCall(cardsToPlay: 1 | 2 | 3): boolean {
        return this.sendDealerCallRequest(cardsToPlay);
    }

    public getCardsToPlay(): number { return this.cardsToPlay; }
    public getDealerId(): string { return this.dealerId; }

    public isCurrentPlayerDealer(): boolean {
        const currentPlayerId = LocalRoomStore.getInstance().getMyPlayerId();
        return currentPlayerId ? currentPlayerId === this.dealerId : false;
    }

    public isPlayer0AutoPlayEnabled(): boolean { return this.isPlayer0AutoPlay; }

    public setPlayer0AutoPlay(enabled: boolean): void {
        this.isPlayer0AutoPlay = enabled;
    }

    // ==================== Legacy 兼容方法 ====================

    public getCommunityCards(): number[] { return [...this.communityCards]; }
    public getPlayer(playerId: string): any | undefined { return undefined; }
    public getScores(): Map<string, number> { return new Map(); }
    public getState(): TheDecreeGameState { return this.gameState; }
    public getCurrentRound(): any | null { return null; }
    public selectFirstDealer(revealedCards: Map<string, number>): string { return ''; }
    public startNewRound(dealerId: string): void {}
    public refillHands(): void {}
}
