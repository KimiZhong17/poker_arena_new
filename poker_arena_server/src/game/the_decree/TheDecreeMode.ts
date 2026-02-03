import { GameModeBase, GameModeConfig, PlayerInfo } from '../GameModeBase';
import { PlayerManager } from '../PlayerManager';
import { TheDecreePlayer } from '../Player';
import { TexasHoldEmEvaluator, TexasHandResult, TexasHandType } from './TexasHoldEmEvaluator';
import { HandTypeHelper } from './HandTypeHelper';
import { CardSuit, CardPoint } from './CardConst';
import { sortCardsInPlace, CardRankingMode } from '../../utils/CardUtils';
import { AutoPlayStrategy, ConservativeStrategy } from './AutoPlayStrategy';
import { Logger } from '../../utils/Logger';

/**
 * Round state
 */
export interface RoundState {
    roundNumber: number;
    dealerId: string;
    cardsToPlay: number;
    playerPlays: Map<string, number[]>;
    roundWinnerId: string | null;
    roundLoserId: string | null;
    handResults: Map<string, TexasHandResult> | null;
}

/**
 * TheDecree game state enumeration
 * 服务端和客户端需要保持一致
 */
export enum TheDecreeGameState {
    SETUP = "setup",
    FIRST_DEALER_SELECTION = "first_dealer",
    DEALER_CALL = "dealer_call",
    PLAYER_SELECTION = "player_selection",
    SHOWDOWN = "showdown",
    SCORING = "scoring",
    REFILL = "refill",
    GAME_OVER = "game_over"
}

/**
 * Event callbacks for game state changes
 */
export interface TheDecreeEventCallbacks {
    onGameStarted?: (communityCards: number[], gameState: TheDecreeGameState) => void;
    onPlayerDealt?: (playerId: string, cards: number[]) => void;
    onRequestFirstDealerSelection?: (gameState: TheDecreeGameState) => void;
    onPlayerSelectedCard?: (playerId: string) => void;
    onFirstDealerReveal?: (dealerId: string, selections: Map<string, number>, gameState: TheDecreeGameState) => void;
    onFirstDealerSelected?: (dealerId: string, revealedCards: Map<string, number>) => void;
    onNewRound?: (roundNumber: number, dealerId: string, gameState: TheDecreeGameState) => void;
    onDealerCall?: (dealerId: string, cardsToPlay: number, gameState: TheDecreeGameState) => void;
    onPlayerPlayed?: (playerId: string, cardCount: number) => void;
    onShowdown?: (results: Map<string, TexasHandResult>, gameState: TheDecreeGameState) => void;
    onRoundEnd?: (winnerId: string, loserId: string, scores: Map<string, number>, gameState: TheDecreeGameState) => void;
    onHandsRefilled?: (deckSize: number) => void;
    onGameOver?: (winnerId: string, scores: Map<string, number>, totalRounds: number, gameState: TheDecreeGameState) => void;
    onPlayerAutoChanged?: (playerId: string, isAuto: boolean, reason?: string) => void;
}

/**
 * The Decree game mode implementation (Server-side)
 *
 * 未定之数游戏模式 - 服务器端实现
 *
 * 规则：
 * - 2-4名玩家
 * - 每人初始5张手牌，桌面4张公共牌
 * - 每轮：庄家宣布出牌数量(1-3张) → 所有玩家选牌 → 比大小
 * - 计分基于牌型强度，最大牌型玩家额外+1分
 * - 每轮结束后补牌至5张，输家成为下一轮庄家
 */
export class TheDecreeMode extends GameModeBase {
    private state: TheDecreeGameState = TheDecreeGameState.SETUP;
    private playerManager: PlayerManager = new PlayerManager();
    private communityCards: number[] = [];
    private deck: number[] = [];
    private currentRound: RoundState | null = null;
    private callbacks: TheDecreeEventCallbacks;
    private firstDealerSelections: Map<string, number> = new Map();

    // 托管相关字段
    private autoPlayStrategy: AutoPlayStrategy = new ConservativeStrategy();
    private autoPlayTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(config?: GameModeConfig, callbacks?: TheDecreeEventCallbacks) {
        const defaultConfig: GameModeConfig = {
            id: "the_decree",
            name: "TheDecree",
            displayName: "未定之数",
            minPlayers: 2,
            maxPlayers: 4,
            deckCount: 1,
            initialHandSize: 5,
            description: "Dealer sets the number, you set the winner."
        };

        super(config || defaultConfig);
        this.callbacks = callbacks || {};
    }

    // ==================== 生命周期方法 ====================

    public initGame(playerInfos: PlayerInfo[]): void {
        if (playerInfos.length < this.config.minPlayers ||
            playerInfos.length > this.config.maxPlayers) {
            throw new Error(
                `The Decree requires ${this.config.minPlayers}-${this.config.maxPlayers} players`
            );
        }

        this.playerManager.createPlayers(playerInfos, TheDecreePlayer);
        Logger.info('TheDecree', `Created ${this.playerManager.getPlayerCount()} players`);

        this.state = TheDecreeGameState.SETUP;
        this.initializeDeck();
    }

    public startGame(): void {
        Logger.info('TheDecree', 'Starting game');
        this.isActive = true;

        // 延迟发牌，给客户端时间注册事件监听器
        // 避免客户端还在 ReadyStage -> PlayingStage 切换过程中错过事件
        setTimeout(() => {
            try {
                Logger.debug('TheDecree', 'Delayed dealing cards...');
                this.dealCards();
            } catch (error) {
                Logger.error('TheDecree', 'Error dealing cards:', error);
            }
        }, 500); // 500ms 延迟
    }

    public dealCards(): void {
        // Deal 4 community cards
        this.communityCards = [
            this.drawCard(),
            this.drawCard(),
            this.drawCard(),
            this.drawCard()
        ];

        // Sort community cards by point value (ascending, A high)
        sortCardsInPlace(this.communityCards, CardRankingMode.ACE_HIGH, true);

        // Deal 5 cards to each player
        for (const player of this.playerManager.getAllPlayers()) {
            const cards = [
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard()
            ];

            // Sort cards by point value (ascending, A high)
            sortCardsInPlace(cards, CardRankingMode.ACE_HIGH, true);

            player.setHandCards(cards);

            // Notify callback
            if (this.callbacks.onPlayerDealt) {
                this.callbacks.onPlayerDealt(player.id, cards);
            }
        }

        Logger.info('TheDecree', 'Cards dealt to players and community');

        this.state = TheDecreeGameState.FIRST_DEALER_SELECTION;

        // Notify game started with community cards
        if (this.callbacks.onGameStarted) {
            this.callbacks.onGameStarted(this.communityCards, this.state);
        }

        // Request players to select cards for first dealer
        this.requestFirstDealerSelection();
    }

    public cleanup(): void {
        Logger.info('TheDecree', 'Cleaning up');
        super.cleanup();

        // 清理所有托管定时器
        for (const [playerId, timer] of this.autoPlayTimers) {
            clearTimeout(timer);
        }
        this.autoPlayTimers.clear();

        this.playerManager.clear();
        this.communityCards = [];
        this.deck = [];
        this.currentRound = null;
    }

    // ==================== 游戏逻辑 ====================

    /**
     * Request players to select a card for first dealer selection
     */
    private requestFirstDealerSelection(): void {
        Logger.info('TheDecree', 'Requesting first dealer selection from all players');
        this.firstDealerSelections.clear();

        // Notify callback to request selection
        if (this.callbacks.onRequestFirstDealerSelection) {
            this.callbacks.onRequestFirstDealerSelection(this.state);
        }
    }

    /**
     * Player selects a card for first dealer selection
     */
    public selectFirstDealerCard(playerId: string, card: number): boolean {
        Logger.debug('TheDecree', `========== selectFirstDealerCard ==========`);
        Logger.debug('TheDecree', `Player ID: ${playerId}`);
        Logger.debug('TheDecree', `Card: 0x${card.toString(16)}`);
        Logger.debug('TheDecree', `Current state: ${this.state}`);
        Logger.debug('TheDecree', `Expected state: ${TheDecreeGameState.FIRST_DEALER_SELECTION}`);

        if (this.state !== TheDecreeGameState.FIRST_DEALER_SELECTION) {
            Logger.warn('TheDecree', `✗ Cannot select card in state: ${this.state}`);
            return false;
        }

        const player = this.playerManager.getPlayer(playerId);
        if (!player) {
            Logger.warn('TheDecree', `✗ Player ${playerId} not found`);
            return false;
        }

        Logger.debug('TheDecree', `Player found: ${player.id}`);
        Logger.debug('TheDecree', `Player hand cards:`, player.handCards.map((c: number) => '0x' + c.toString(16)));

        if (!player.hasCards([card])) {
            Logger.warn('TheDecree', `✗ Player ${playerId} does not have card 0x${card.toString(16)}`);
            Logger.warn('TheDecree', `  Player's hand:`, player.handCards.map((c: number) => '0x' + c.toString(16)));
            return false;
        }

        if (this.firstDealerSelections.has(playerId)) {
            Logger.warn('TheDecree', `✗ Player ${playerId} already selected a card`);
            Logger.warn('TheDecree', `  Already selected players:`, Array.from(this.firstDealerSelections.keys()));
            Logger.warn('TheDecree', `  Their cards:`, Array.from(this.firstDealerSelections.entries()).map(([id, card]) => `${id}: 0x${card.toString(16)}`));
            return false;
        }

        // 更新最后操作时间
        this.updatePlayerActionTime(playerId);

        this.firstDealerSelections.set(playerId, card);
        Logger.info('TheDecree', `✓ Player ${playerId} selected card for dealer selection`);
        Logger.info('TheDecree', `  Total selections: ${this.firstDealerSelections.size}/${this.playerManager.getPlayerCount()}`);

        // Notify callback
        if (this.callbacks.onPlayerSelectedCard) {
            this.callbacks.onPlayerSelectedCard(playerId);
        }

        // Check if all players have selected
        if (this.firstDealerSelections.size === this.playerManager.getPlayerCount()) {
            Logger.info('TheDecree', `All ${this.playerManager.getPlayerCount()} players have selected, revealing first dealer...`);
            this.revealFirstDealer();
        }

        return true;
    }

    /**
     * Reveal first dealer after all players have selected
     */
    private revealFirstDealer(): void {
        Logger.info('TheDecree', 'All players selected, revealing first dealer');

        const dealerId = this.selectFirstDealer(this.firstDealerSelections);
        Logger.info('TheDecree', `First dealer selected: ${dealerId}`);

        // Move to DEALER_CALL state before callback (will be updated in startNewRound)
        this.state = TheDecreeGameState.DEALER_CALL;

        // Notify callback
        if (this.callbacks.onFirstDealerReveal) {
            this.callbacks.onFirstDealerReveal(dealerId, this.firstDealerSelections, this.state);
        }

        // Start first round
        this.startNewRound(dealerId);
    }

    /**
     * Auto-select first dealer by comparing first card from each player
     * Used for AI/托管 functionality
     */
    public selectFirstDealerAuto(): void {
        Logger.info('TheDecree', 'Auto-selecting first dealer');
        const revealedCards = new Map<string, number>();
        const playerOrder = this.playerManager.getPlayerOrder();

        for (const playerId of playerOrder) {
            const player = this.playerManager.getPlayer(playerId);
            if (player && player.handCards.length > 0) {
                revealedCards.set(playerId, player.handCards[0]);
            }
        }

        const dealerId = this.selectFirstDealer(revealedCards);
        Logger.info('TheDecree', `First dealer auto-selected: ${dealerId}`);

        // Notify callback (using the reveal callback)
        if (this.callbacks.onFirstDealerReveal) {
            this.callbacks.onFirstDealerReveal(dealerId, revealedCards, TheDecreeGameState.DEALER_CALL);
        }

        // Also trigger the old callback for compatibility
        if (this.callbacks.onFirstDealerSelected) {
            this.callbacks.onFirstDealerSelected(dealerId, revealedCards);
        }

        // Start first round
        this.startNewRound(dealerId);
    }

    /**
     * Select first dealer by comparing revealed cards
     */
    private selectFirstDealer(revealedCards: Map<string, number>): string {
        let bestPlayerId: string = "";
        let bestCard: number = -1;

        for (const [playerId, card] of revealedCards) {
            if (bestCard === -1 || this.compareCards(card, bestCard) > 0) {
                bestCard = card;
                bestPlayerId = playerId;
            }
        }

        return bestPlayerId;
    }

    /**
     * Compare two cards (rank first, then suit)
     */
    private compareCards(card1: number, card2: number): number {
        const rank1 = this.getTexasRank(this.getPoint(card1));
        const rank2 = this.getTexasRank(this.getPoint(card2));

        if (rank1 !== rank2) {
            return rank1 - rank2;
        }

        return this.getSuitValue(this.getSuit(card1)) -
               this.getSuitValue(this.getSuit(card2));
    }

    /**
     * Start a new round with specified dealer
     */
    public startNewRound(dealerId: string): void {
        this.currentRound = {
            roundNumber: (this.currentRound?.roundNumber || 0) + 1,
            dealerId,
            cardsToPlay: 0,
            playerPlays: new Map(),
            roundWinnerId: null,
            roundLoserId: null,
            handResults: null
        };

        // Reset player states
        for (const player of this.playerManager.getAllPlayers()) {
            const theDecreePlayer = player as TheDecreePlayer;
            theDecreePlayer.resetRound();
        }

        this.state = TheDecreeGameState.DEALER_CALL;

        // Notify callback
        if (this.callbacks.onNewRound) {
            this.callbacks.onNewRound(this.currentRound.roundNumber, dealerId, this.state);
        }

        Logger.info('TheDecree', `Round ${this.currentRound.roundNumber} started, dealer: ${dealerId}`);

        // 检查庄家是否托管，如果是则自动叫牌
        this.checkAndTriggerAutoPlay();
    }

    /**
     * Dealer declares how many cards to play
     */
    public dealerCall(dealerId: string, cardsToPlay: 1 | 2 | 3): boolean {
        if (!this.currentRound) return false;
        if (this.state !== TheDecreeGameState.DEALER_CALL) return false;
        if (this.currentRound.dealerId !== dealerId) return false;

        // 更新最后操作时间
        this.updatePlayerActionTime(dealerId);

        this.currentRound.cardsToPlay = cardsToPlay;
        this.state = TheDecreeGameState.PLAYER_SELECTION;

        // Notify callback
        if (this.callbacks.onDealerCall) {
            this.callbacks.onDealerCall(dealerId, cardsToPlay, this.state);
        }

        Logger.info('TheDecree', `Dealer ${dealerId} calls ${cardsToPlay} card(s)`);

        // 检查所有托管玩家，触发自动出牌
        this.checkAndTriggerAutoPlay();

        return true;
    }

    public isValidPlay(cards: number[], playerId: string): boolean {
        if (!this.currentRound) return false;

        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer | undefined;
        if (!player) return false;

        if (this.state !== TheDecreeGameState.PLAYER_SELECTION) return false;
        if (player.hasPlayed) return false;
        if (cards.length !== this.currentRound.cardsToPlay) return false;

        return player.hasCards(cards);
    }

    public playCards(cards: number[], playerId: string): boolean {
        if (!this.isValidPlay(cards, playerId)) {
            return false;
        }

        // 更新最后操作时间
        this.updatePlayerActionTime(playerId);

        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
        player.playCards(cards);
        this.currentRound!.playerPlays.set(playerId, cards);

        // Notify callback
        if (this.callbacks.onPlayerPlayed) {
            this.callbacks.onPlayerPlayed(playerId, cards.length);
        }

        Logger.info('TheDecree', `Player ${playerId} played ${cards.length} card(s)`);

        // Check if all players have played
        if (this.allPlayersPlayed()) {
            this.state = TheDecreeGameState.SHOWDOWN;
            this.processShowdown();
        }

        return true;
    }

    private processShowdown(): void {
        if (!this.currentRound) return;

        const results = new Map<string, TexasHandResult>();

        // Evaluate each player's hand
        for (const [playerId, playedCards] of this.currentRound.playerPlays) {
            const allCards = [...playedCards, ...this.communityCards];
            const result = TexasHoldEmEvaluator.evaluate(allCards);
            results.set(playerId, result);
        }

        this.currentRound.handResults = results;

        // Find winner and loser
        let winnerId: string = "";
        let loserId: string = "";
        let bestHand: TexasHandResult | null = null;
        let worstHand: TexasHandResult | null = null;

        for (const [playerId, result] of results) {
            if (!bestHand || TexasHoldEmEvaluator.compare(result, bestHand) > 0) {
                bestHand = result;
                winnerId = playerId;
            }
            if (!worstHand || TexasHoldEmEvaluator.compare(result, worstHand) < 0) {
                worstHand = result;
                loserId = playerId;
            }
        }

        this.currentRound.roundWinnerId = winnerId;
        this.currentRound.roundLoserId = loserId;

        // Notify callback
        if (this.callbacks.onShowdown) {
            this.callbacks.onShowdown(results, this.state);
        }

        // Calculate scores
        this.calculateScores(results);
        this.state = TheDecreeGameState.SCORING;

        // Log results
        Logger.info('TheDecree', `Round ${this.currentRound.roundNumber} - Winner: ${winnerId}, Loser: ${loserId}`);

        // Automatically proceed to refill after a delay (handled by caller)
        setTimeout(() => this.proceedToRefill(), 2000);
    }

    private calculateScores(results: Map<string, TexasHandResult>): void {
        if (!this.currentRound) return;

        // Award base scores
        for (const [playerId, result] of results) {
            const player = this.playerManager.getPlayer(playerId);
            if (player) {
                const baseScore = HandTypeHelper.getScore(result.type);
                player.score += baseScore;
            }
        }

        // Winner bonus (+1)
        if (this.currentRound.roundWinnerId) {
            const winner = this.playerManager.getPlayer(this.currentRound.roundWinnerId);
            if (winner) {
                winner.score += 1;
            }
        }

        // Notify callback
        if (this.callbacks.onRoundEnd) {
            this.callbacks.onRoundEnd(
                this.currentRound.roundWinnerId!,
                this.currentRound.roundLoserId!,
                this.getScores(),
                this.state
            );
        }
    }

    private proceedToRefill(): void {
        this.state = TheDecreeGameState.REFILL;
        this.refillHands();
    }

    /**
     * Refill players' hands to 5 cards
     */
    public refillHands(): void {
        // if (this.deck.length < 48) this.deck.length = 0; // debug: quickly run out of cards
        if (!this.currentRound) return;

        const playerOrder = this.playerManager.getPlayerOrder();
        const dealerIndex = playerOrder.indexOf(this.currentRound.dealerId);

        // Remove played cards from all players' hands
        for (let i = 0; i < playerOrder.length; i++) {
            const index = (dealerIndex + i) % playerOrder.length;
            const playerId = playerOrder[index];
            const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;

            player.removeCards(player.playedCards);
        }

        // Refill cards fairly
        let continueRefilling = true;
        while (continueRefilling && this.deck.length > 0) {
            continueRefilling = false;

            for (let i = 0; i < playerOrder.length; i++) {
                const index = (dealerIndex + i) % playerOrder.length;
                const playerId = playerOrder[index];
                const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;

                if (player.handCards.length < 5 && this.deck.length > 0) {
                    player.addCards([this.drawCard()]);
                    continueRefilling = true;
                }
            }
        }

        // Sort each player's hand cards after refilling
        for (const playerId of playerOrder) {
            const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
            if (player.handCards.length > 0) {
                sortCardsInPlace(player.handCards, CardRankingMode.ACE_HIGH, true);
            }
        }

        // Notify callback
        if (this.callbacks.onHandsRefilled) {
            this.callbacks.onHandsRefilled(this.deck.length);
        }

        Logger.info('TheDecree', `Hands refilled. Deck: ${this.deck.length} cards remaining`);

        // Check if game is over
        if (this.isGameOver()) {
            this.handleGameOver();
        } else {
            // Start next round with loser as dealer
            if (this.currentRound.roundLoserId) {
                this.startNewRound(this.currentRound.roundLoserId);
            }
        }
    }

    public isGameOver(): boolean {
        for (const player of this.playerManager.getAllPlayers()) {
            if (player.handCards.length > 0) {
                return false;
            }
        }
        return true;
    }

    private handleGameOver(): void {
        Logger.info('TheDecree', 'Game Over');
        this.state = TheDecreeGameState.GAME_OVER;

        // Find final winner
        let winnerId = '';
        let maxScore = -1;

        for (const player of this.playerManager.getAllPlayers()) {
            if (player.score > maxScore) {
                maxScore = player.score;
                winnerId = player.id;
            }
        }

        Logger.info('TheDecree', `Winner: ${winnerId} with ${maxScore} points`);

        // Notify callback
        if (this.callbacks.onGameOver) {
            this.callbacks.onGameOver(
                winnerId,
                this.getScores(),
                this.currentRound?.roundNumber || 0,
                this.state
            );
        }
    }

    // ==================== Deck Management ====================

    private initializeDeck(): void {
        this.deck = [];

        const suits = [CardSuit.SPADE, CardSuit.HEART, CardSuit.CLUB, CardSuit.DIAMOND];
        const points = [
            CardPoint.P_A, CardPoint.P_2, CardPoint.P_3, CardPoint.P_4, CardPoint.P_5,
            CardPoint.P_6, CardPoint.P_7, CardPoint.P_8, CardPoint.P_9, CardPoint.P_10,
            CardPoint.P_J, CardPoint.P_Q, CardPoint.P_K
        ];

        for (const suit of suits) {
            for (const point of points) {
                this.deck.push(suit | point);
            }
        }

        this.shuffleDeck();
    }

    private shuffleDeck(): void {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    private drawCard(): number {
        const card = this.deck.pop();
        if (card === undefined) {
            throw new Error("Deck is empty");
        }
        return card;
    }

    // ==================== Helper Methods ====================

    private allPlayersPlayed(): boolean {
        if (!this.currentRound) return false;
        return this.currentRound.playerPlays.size === this.playerManager.getPlayerCount();
    }

    private getSuit(card: number): CardSuit {
        return (card & 0xF0) as CardSuit;
    }

    private getPoint(card: number): CardPoint {
        return (card & 0x0F) as CardPoint;
    }

    private getTexasRank(point: CardPoint): number {
        // Map CardPoint enum values to Texas Hold'em ranking (A is high)
        // Note: CardPoint enum uses Guandan rules where P_A=14, P_2=15
        // We need to remap for Texas Hold'em where A=14 is highest, 2=2 is lowest
        switch (point) {
            case CardPoint.P_A: return 14;  // A is highest
            case CardPoint.P_2: return 2;   // 2 is lowest (override enum value of 15)
            case CardPoint.P_3: return 3;
            case CardPoint.P_4: return 4;
            case CardPoint.P_5: return 5;
            case CardPoint.P_6: return 6;
            case CardPoint.P_7: return 7;
            case CardPoint.P_8: return 8;
            case CardPoint.P_9: return 9;
            case CardPoint.P_10: return 10;
            case CardPoint.P_J: return 11;
            case CardPoint.P_Q: return 12;
            case CardPoint.P_K: return 13;
            default: return point;
        }
    }

    private getSuitValue(suit: CardSuit): number {
        switch (suit) {
            case CardSuit.SPADE: return 4;
            case CardSuit.HEART: return 3;
            case CardSuit.CLUB: return 2;
            case CardSuit.DIAMOND: return 1;
            default: return 0;
        }
    }

    // ==================== Getters ====================

    public getState(): TheDecreeGameState {
        return this.state;
    }

    public getCommunityCards(): number[] {
        return [...this.communityCards];
    }

    public getPlayer(playerId: string): TheDecreePlayer | undefined {
        return this.playerManager.getPlayer(playerId) as TheDecreePlayer | undefined;
    }

    public getCurrentRound(): RoundState | null {
        return this.currentRound;
    }

    public getDeckSize(): number {
        return this.deck.length;
    }

    public getScores(): Map<string, number> {
        const scores = new Map<string, number>();
        for (const player of this.playerManager.getAllPlayers()) {
            scores.set(player.id, player.score);
        }
        return scores;
    }

    public getPlayerHandCards(playerId: string): number[] | null {
        const player = this.getPlayer(playerId);
        return player ? [...player.handCards] : null;
    }

    public getAllPlayers(): TheDecreePlayer[] {
        return this.playerManager.getAllPlayers() as TheDecreePlayer[];
    }

    // ==================== 托管相关方法 ====================

    /**
     * 设置玩家托管状态
     * @param playerId 玩家ID
     * @param isAuto 是否托管
     * @param reason 托管原因
     */
    public setPlayerAuto(playerId: string, isAuto: boolean, reason?: string): void {
        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
        if (!player) {
            Logger.warn('TheDecree', `Player ${playerId} not found for auto mode`);
            return;
        }

        player.isAuto = isAuto;

        if (isAuto) {
            player.autoStartTime = Date.now();
            Logger.info('TheDecree', `Player ${player.name} is now in auto mode (${reason || 'manual'})`);

            // 如果轮到该玩家，立即执行托管操作
            if (this.isPlayerTurn(playerId)) {
                this.scheduleAutoAction(playerId);
            }
        } else {
            // 取消托管，清除定时器
            this.clearAutoPlayTimer(playerId);
            Logger.info('TheDecree', `Player ${player.name} cancelled auto mode`);
        }

        // 通知所有客户端
        if (this.callbacks.onPlayerAutoChanged) {
            this.callbacks.onPlayerAutoChanged(playerId, isAuto, reason);
        }
    }

    /**
     * 检查是否轮到该玩家操作
     */
    private isPlayerTurn(playerId: string): boolean {
        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
        if (!player) return false;

        switch (this.state) {
            case TheDecreeGameState.FIRST_DEALER_SELECTION:
                return !player.hasPlayed;

            case TheDecreeGameState.DEALER_CALL:
                return this.currentRound?.dealerId === playerId;

            case TheDecreeGameState.PLAYER_SELECTION:
                return !player.hasPlayed;

            default:
                return false;
        }
    }

    /**
     * 调度托管操作（延迟执行，模拟思考）
     */
    private scheduleAutoAction(playerId: string): void {
        this.clearAutoPlayTimer(playerId);

        const AUTO_PLAY_ACTION_DELAY = 2000; // 2秒延迟
        const timer = setTimeout(() => {
            try {
                this.executeAutoAction(playerId);
            } catch (error) {
                Logger.error('TheDecree', `Error in auto action for player ${playerId}:`, error);
            }
        }, AUTO_PLAY_ACTION_DELAY);

        this.autoPlayTimers.set(playerId, timer);
    }

    /**
     * 执行托管操作
     */
    private executeAutoAction(playerId: string): void {
        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
        if (!player || !player.isAuto) {
            return;
        }

        Logger.debug('TheDecree', `Executing auto action for player ${player.name} in state ${this.state}`);

        try {
            switch (this.state) {
                case TheDecreeGameState.FIRST_DEALER_SELECTION:
                    if (!player.hasPlayed) {
                        const card = this.autoPlayStrategy.selectFirstDealerCard(player.handCards);
                        Logger.debug('TheDecree', `Auto selecting card: 0x${card.toString(16)}`);
                        this.selectFirstDealerCard(playerId, card);
                    }
                    break;

                case TheDecreeGameState.DEALER_CALL:
                    if (this.currentRound?.dealerId === playerId) {
                        const cardsToPlay = this.autoPlayStrategy.dealerCall(
                            player.handCards,
                            this.communityCards
                        );
                        Logger.debug('TheDecree', `Auto dealer call: ${cardsToPlay} cards`);
                        this.dealerCall(playerId, cardsToPlay);
                    }
                    break;

                case TheDecreeGameState.PLAYER_SELECTION:
                    if (!player.hasPlayed && this.currentRound?.cardsToPlay) {
                        const cards = this.autoPlayStrategy.playCards(
                            player.handCards,
                            this.currentRound.cardsToPlay
                        );
                        Logger.debug('TheDecree', `Auto playing cards:`, cards.map(c => '0x' + c.toString(16)));
                        this.playCards(cards, playerId);
                    }
                    break;
            }
        } catch (error) {
            Logger.error('TheDecree', `Error executing auto action for player ${playerId}:`, error);
        }
    }

    /**
     * 清除托管定时器
     */
    private clearAutoPlayTimer(playerId: string): void {
        const timer = this.autoPlayTimers.get(playerId);
        if (timer) {
            clearTimeout(timer);
            this.autoPlayTimers.delete(playerId);
        }
    }

    /**
     * 更新玩家最后操作时间
     */
    private updatePlayerActionTime(playerId: string): void {
        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
        if (player) {
            player.lastActionTime = Date.now();
        }
    }

    /**
     * 检查所有玩家是否需要自动托管（超时检测）
     * 应该由外部定时器调用
     */
    public checkAutoPlayTimeouts(timeoutMs: number): void {
        for (const player of this.playerManager.getAllPlayers()) {
            const theDecreePlayer = player as TheDecreePlayer;
            if (theDecreePlayer.isAuto) continue; // 已经托管的跳过

            const timeSinceLastAction = Date.now() - theDecreePlayer.lastActionTime;
            if (timeSinceLastAction > timeoutMs && this.isPlayerTurn(theDecreePlayer.id)) {
                Logger.info('TheDecree', `Player ${theDecreePlayer.name} timeout, enabling auto mode`);
                this.setPlayerAuto(theDecreePlayer.id, true, 'timeout');
            }
        }
    }

    /**
     * 检查并触发所有托管玩家的自动操作
     * 在游戏状态改变后调用（如新回合开始、庄家叫牌后）
     */
    private checkAndTriggerAutoPlay(): void {
        Logger.debug('TheDecree', 'Checking auto-play players...');
        for (const player of this.playerManager.getAllPlayers()) {
            const theDecreePlayer = player as TheDecreePlayer;
            if (theDecreePlayer.isAuto && this.isPlayerTurn(theDecreePlayer.id)) {
                Logger.debug('TheDecree', `Triggering auto-play for ${theDecreePlayer.name}`);
                this.scheduleAutoAction(theDecreePlayer.id);
            }
        }
    }
}

