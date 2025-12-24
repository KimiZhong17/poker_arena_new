import { GameModeBase, GameModeConfig } from "./GameModeBase";
import { TexasHoldEmEvaluator, TexasHandResult, TexasHandType } from "./TexasHoldEmEvaluator";
import { CardSuit, CardPoint } from "../../Card/CardConst";
import { Game } from "../../Game";
import { PlayerLayoutConfig } from "./PlayerLayoutConfig";
import { instantiate, Vec3 } from 'cc';
import { Poker } from '../../UI/Poker';
import { PokerFactory } from '../../UI/PokerFactory';
import { PlayerManager } from '../PlayerManager';
import { PlayerInfo, TheDecreePlayer } from '../Player';

/**
 * Round state
 */
interface RoundState {
    roundNumber: number;
    dealerId: string;        // Current dealer
    cardsToPlay: number;     // Number of cards to play (1, 2, or 3)
    playerPlays: Map<string, number[]>;  // Cards played by each player
    roundWinnerId: string | null;
    roundLoserId: string | null;
}

/**
 * Game state enumeration
 */
enum GameState {
    SETUP = "setup",                    // Initial setup
    FIRST_DEALER_SELECTION = "first_dealer",  // Selecting first dealer
    DEALER_CALL = "dealer_call",        // Dealer deciding cards to play
    PLAYER_SELECTION = "player_selection",    // Players selecting cards
    SHOWDOWN = "showdown",              // Revealing and comparing hands
    SCORING = "scoring",                // Calculating scores
    REFILL = "refill",                  // Refilling hands
    GAME_OVER = "game_over"             // Game finished
}

/**
 * The Decree game mode implementation
 *
 * 未定之数游戏模式 - 德州扑克风格的4人游戏
 *
 * 规则：
 * - 2-4名玩家
 * - 每人初始5张手牌，桌面4张公共牌
 * - 每轮：庄家宣布出牌数量(1-3张) → 所有玩家选牌 → 比大小
 * - 计分基于牌型强度，最大牌型玩家额外+1分
 * - 每轮结束后补牌至5张，输家成为下一轮庄家
 */
export class TheDecreeMode extends GameModeBase {
    // Game state
    private state: GameState = GameState.SETUP;

    // 数据层：使用 PlayerManager 管理玩家
    private playerManager: PlayerManager = new PlayerManager();

    private communityCards: number[] = [];  // 4 community cards
    private deck: number[] = [];  // Remaining deck
    private currentRound: RoundState | null = null;

    // Auto-play timing
    private stateTimer: number = 0;  // Timer for current state
    private readonly STATE_DELAY = 2.0;  // Delay between states (seconds)

    constructor(game: Game, config?: GameModeConfig) {
        // 使用提供的config或默认config
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

        super(game, config || defaultConfig);
    }

    // ==================== 生命周期方法（覆盖基类）====================

    /**
     * 进入游戏模式
     * 覆盖基类方法以添加游戏初始化逻辑
     */
    public onEnter(): void {
        console.log('[TheDecree] Entering game mode');
        this.isActive = true;

        // 1. 调整玩家布局
        this.adjustPlayerLayout();

        // 2. 显示UI
        this.showUI();

        // 3. 隐藏 call buttons 初始状态
        this.updateUICallButtonsVisibility();

        // 4. 初始化游戏
        const playerInfos: PlayerInfo[] = [
            { id: 'player_0', name: 'Player 1', isReady: true, isHost: true, seatIndex: 0 },
            { id: 'player_1', name: 'Player 2', isReady: true, isHost: false, seatIndex: 1 },
            { id: 'player_2', name: 'Player 3', isReady: true, isHost: false, seatIndex: 2 },
            { id: 'player_3', name: 'Player 4', isReady: true, isHost: false, seatIndex: 3 }
        ];
        this.initGame(playerInfos);

        // 5. 发牌
        this.dealCards();

        console.log('[TheDecree] Game initialized and cards dealt');
    }

    /**
     * 离开游戏模式
     */
    public onExit(): void {
        console.log('[TheDecree] Exiting game mode');
        this.isActive = false;

        // 隐藏UI
        this.hideUI();

        // 清理游戏状态
        this.state = GameState.SETUP;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[TheDecree] Cleaning up');
        super.cleanup();

        this.playerManager.clear();
        this.communityCards = [];
        this.deck = [];
        this.currentRound = null;
        this.stateTimer = 0;
    }

    /**
     * 每帧更新 - 驱动游戏状态机
     */
    public update(deltaTime: number): void {
        if (!this.isActive) return;

        this.stateTimer += deltaTime;

        // Process state machine based on current state
        switch (this.state) {
            case GameState.FIRST_DEALER_SELECTION:
                if (this.stateTimer >= this.STATE_DELAY) {
                    this.autoSelectFirstDealer();
                    this.stateTimer = 0;
                }
                break;

            case GameState.DEALER_CALL:
                if (this.stateTimer >= this.STATE_DELAY) {
                    this.autoDealerCall();
                    this.stateTimer = 0;
                }
                break;

            case GameState.PLAYER_SELECTION:
                if (this.stateTimer >= this.STATE_DELAY) {
                    this.autoPlayerSelection();
                    this.stateTimer = 0;
                }
                break;

            case GameState.SCORING:
                if (this.stateTimer >= this.STATE_DELAY * 1.5) {
                    this.logRoundResult();
                    this.state = GameState.REFILL;
                    this.stateTimer = 0;
                }
                break;

            case GameState.REFILL:
                if (this.stateTimer >= this.STATE_DELAY) {
                    this.autoRefill();
                    this.stateTimer = 0;
                }
                break;
        }
    }

    // ==================== UI 控制接口实现 ====================

    /**
     * 显示TheDecree相关UI
     * - 显示ObjectTheDecreeNode（游戏模式特定UI）
     * - 显示公共牌区域
     * - 显示TheDecreeUIController控制的按钮
     */
    public showUI(): void {
        console.log('[TheDecree] Showing UI');

        // 显示TheDecree模式的UI容器
        if (this.game.objectsTheDecreeNode) {
            this.game.objectsTheDecreeNode.active = true;
        }

        // 显示公共牌区域
        if (this.game.communityCardsNode) {
            this.game.communityCardsNode.active = true;
        }

        // 隐藏其他游戏模式的UI
        if (this.game.objectsGuandanNode) {
            this.game.objectsGuandanNode.active = false;
        }

        console.log('[TheDecree] UI shown');
    }

    /**
     * 隐藏TheDecree相关UI
     */
    public hideUI(): void {
        console.log('[TheDecree] Hiding UI');

        if (this.game.objectsTheDecreeNode) {
            this.game.objectsTheDecreeNode.active = false;
        }

        if (this.game.communityCardsNode) {
            this.game.communityCardsNode.active = false;
        }

        console.log('[TheDecree] UI hidden');
    }

    /**
     * 调整玩家位置布局
     * TheDecree支持2-4人，使用标准布局配置
     */
    public adjustPlayerLayout(): void {
        // 如果已经有玩家，使用实际玩家数量；否则使用配置的最大玩家数
        const playerCount = this.playerManager.getPlayerCount() || this.config.maxPlayers;
        console.log(`[TheDecree] Adjusting player layout for ${playerCount} players`);

        // 使用 PlayerLayoutConfig 提供的标准布局
        const positions = PlayerLayoutConfig.getStandardLayout(playerCount);

        // 应用布局（使用基类的 protected 方法）
        this.applyPlayerLayout(positions);

        const layoutName = PlayerLayoutConfig.getLayoutName(playerCount);
        console.log(`[TheDecree] Player layout adjusted: ${playerCount} players in ${layoutName} formation`);
    }

    // ========== Public API ==========

    public initGame(playerInfos: PlayerInfo[]): void {
        if (playerInfos.length < this.config.minPlayers ||
            playerInfos.length > this.config.maxPlayers) {
            throw new Error(
                `The Decree requires ${this.config.minPlayers}-${this.config.maxPlayers} players`
            );
        }

        // 使用 PlayerManager 创建玩家
        this.playerManager.createPlayers(playerInfos, TheDecreePlayer);

        console.log(`[TheDecree] Created ${this.playerManager.getPlayerCount()} TheDecreePlayer instances`);

        this.state = GameState.SETUP;
        this.initializeDeck();
    }

    public dealCards(): void {
        // Deal 4 community cards
        this.communityCards = [
            this.drawCard(),
            this.drawCard(),
            this.drawCard(),
            this.drawCard()
        ];

        // Deal 5 cards to each player
        for (const player of this.playerManager.getAllPlayers()) {
            player.setHandCards([
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard()
            ]);
        }

        this.state = GameState.FIRST_DEALER_SELECTION;

        // 初始化 PlayerUIManager 并显示发牌结果（TheDecree 不需要堆叠功能）
        this.initializePlayerUIManager(this.playerManager.getAllPlayers(), false);
        this.displayCards();
    }

    /**
     * 显示所有牌（公共牌和玩家手牌）
     */
    private displayCards(): void {
        console.log('[TheDecree] displayCards() - Starting display...');

        // 更新所有手牌显示
        this.updateAllHandsDisplay();

        // 更新所有玩家分数显示（初始分数为0）
        this.updateAllScoresDisplay();

        // 显示公共牌
        this.displayCommunityCards();

        console.log('[TheDecree] displayCards() - Display complete');
    }

    /**
     * 显示公共牌
     */
    private displayCommunityCards(): void {
        const communityCardsNode = this.game.communityCardsNode;
        if (!communityCardsNode) {
            console.warn('[TheDecree] Community cards node not found');
            return;
        }

        // 清除现有牌
        communityCardsNode.removeAllChildren();

        console.log(`[TheDecree] Displaying ${this.communityCards.length} community cards:`, this.communityCards);

        // 简单的横向布局
        const cardWidth = 140;
        const cardSpacing = 100;
        const totalWidth = (4 - 1) * cardSpacing + cardWidth;
        const startX = -totalWidth / 2 + cardWidth / 2;

        // 获取 poker 资源
        // @ts-ignore - accessing private property
        const pokerSprites = this.game['_pokerSprites'];
        // @ts-ignore - accessing private property
        const pokerPrefab = this.game['_pokerPrefab'];

        if (!pokerSprites || !pokerPrefab) {
            console.error('[TheDecree] Poker resources not available');
            return;
        }

        const pokerBack = pokerSprites.get("CardBack3");

        // 创建牌节点
        this.communityCards.forEach((cardValue, index) => {
            const cardNode = instantiate(pokerPrefab);
            const poker = cardNode.addComponent(Poker);

            const spriteName = PokerFactory.getCardSpriteName(cardValue);
            const pokerFront = pokerSprites.get(spriteName);

            if (pokerFront) {
                poker.init(cardValue, pokerBack, pokerFront);
                poker.showFront();

                const x = startX + cardSpacing * index;
                cardNode.setPosition(new Vec3(x, 30, 0));
                communityCardsNode.addChild(cardNode);
            } else {
                console.error(`[TheDecree] Sprite not found: ${spriteName}`);
                cardNode.destroy();
            }
        });

        console.log('[TheDecree] Community cards displayed successfully');
    }

    public isValidPlay(cards: number[], playerId: string): boolean {
        if (!this.currentRound) return false;

        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer | undefined;
        if (!player) return false;

        // Check if it's the right state
        if (this.state !== GameState.PLAYER_SELECTION) return false;

        // Check if player already played
        if (player.hasPlayed) return false;

        // Check if correct number of cards
        if (cards.length !== this.currentRound.cardsToPlay) return false;

        // Check if player has these cards
        return cards.every(card => player.handCards.indexOf(card) !== -1);
    }

    public playCards(cards: number[], playerId: string): boolean {
        if (!this.isValidPlay(cards, playerId)) {
            return false;
        }

        const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;

        // Mark cards as played (keep them in hand for display)
        player.playCards(cards);

        // NOTE: Cards are NOT removed from player.hand
        // They will be displayed with an offset to show they've been played

        this.currentRound!.playerPlays.set(playerId, cards);

        // 更新显示
        const playerIndex = this.playerManager.getPlayerOrder().indexOf(playerId);
        if (playerIndex >= 0) {
            this.updatePlayerHandDisplay(playerIndex, cards);
        }

        // Check if all players have played
        if (this.allPlayersPlayed()) {
            this.state = GameState.SHOWDOWN;
            this.processShowdown();
        }

        return true;
    }

    public isGameOver(): boolean {
        // Game is over when all players have no cards left
        for (const player of this.playerManager.getAllPlayers()) {
            if (player.handCards.length > 0) {
                return false;
            }
        }
        return true;
    }

    public getCurrentLevelRank(): number {
        return 0; // The Decree doesn't use level ranks
    }

    // ========== First Dealer Selection ==========

    /**
     * Select first dealer by comparing revealed cards
     * Each player reveals one card from hand
     */
    public selectFirstDealer(revealedCards: Map<string, number>): string {
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
     * @returns positive if card1 > card2
     */
    private compareCards(card1: number, card2: number): number {
        const rank1 = this.getTexasRank(this.getPoint(card1));
        const rank2 = this.getTexasRank(this.getPoint(card2));

        if (rank1 !== rank2) {
            return rank1 - rank2;
        }

        // Same rank, compare suits (♠ > ♥ > ♣ > ♦)
        return this.getSuitValue(this.getSuit(card1)) -
               this.getSuitValue(this.getSuit(card2));
    }

    // ========== Round Management ==========

    /**
     * Update UI call buttons visibility
     * Notifies TheDecreeUIController to show/hide call buttons
     */
    private updateUICallButtonsVisibility(): void {
        if (!this.game.objectsTheDecreeNode) return;

        // Find TheDecreeUIController component
        const uiController = this.game.objectsTheDecreeNode.getComponent('TheDecreeUIController') as any;
        if (uiController && typeof uiController.updateCallButtonsVisibility === 'function') {
            uiController.updateCallButtonsVisibility();
        }
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
            roundLoserId: null
        };

        // Reset player states
        for (const player of this.playerManager.getAllPlayers()) {
            const theDecreePlayer = player as TheDecreePlayer;
            theDecreePlayer.resetRound();
        }

        // 显示庄家指示器
        const dealerIndex = this.playerManager.getPlayerIndex(dealerId);
        if (dealerIndex !== -1 && this.game.playerUIManager) {
            // 根据玩家数量和位置设置不同的偏移量
            const playerCount = this.playerManager.getPlayerCount();
            const dealerOffsets = this.getDealerOffsetsByPlayerCount(playerCount);

            // 设置对应玩家的偏移量
            if (this.game.playerUIManager.dealerIndicator && dealerIndex < dealerOffsets.length) {
                const offset = dealerOffsets[dealerIndex];
                this.game.playerUIManager.dealerIndicator.setOffset(offset.x, offset.y);
                console.log(`[TheDecree] Set dealer indicator offset for player ${dealerIndex} (${playerCount} players): (${offset.x}, ${offset.y})`);
            }

            // 第一次显示立即显示，后续有动画
            const immediate = this.currentRound.roundNumber === 1;
            this.game.playerUIManager.showDealer(dealerIndex, immediate);
            console.log(`[TheDecree] Dealer indicator shown for player ${dealerIndex} (round ${this.currentRound.roundNumber})`);
        }

        this.state = GameState.DEALER_CALL;

        // Notify UI to update call buttons visibility
        this.updateUICallButtonsVisibility();
    }

    /**
     * Dealer declares how many cards to play
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): boolean {
        if (!this.currentRound) return false;
        if (this.state !== GameState.DEALER_CALL) return false;

        this.currentRound.cardsToPlay = cardsToPlay;
        this.state = GameState.PLAYER_SELECTION;

        // Update UI - hide call buttons after dealer makes decision
        this.updateUICallButtonsVisibility();

        return true;
    }

    // ========== Showdown & Scoring ==========

    private processShowdown(): void {
        if (!this.currentRound) return;

        const results = new Map<string, TexasHandResult>();

        // Evaluate each player's hand
        for (const [playerId, playedCards] of this.currentRound.playerPlays) {
            const allCards = [...playedCards, ...this.communityCards];
            const result = TexasHoldEmEvaluator.evaluate(allCards);
            results.set(playerId, result);
        }

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

        // Calculate scores
        this.calculateScores(results);

        this.state = GameState.SCORING;
    }

    /**
     * Calculate and award scores based on hand types
     */
    private calculateScores(results: Map<string, TexasHandResult>): void {
        if (!this.currentRound) return;

        const scoreTable: { [key in TexasHandType]: number } = {
            [TexasHandType.HIGH_CARD]: 2,
            [TexasHandType.ONE_PAIR]: 3,
            [TexasHandType.TWO_PAIR]: 5,
            [TexasHandType.THREE_OF_A_KIND]: 7,
            [TexasHandType.STRAIGHT]: 8,
            [TexasHandType.FLUSH]: 9,
            [TexasHandType.FULL_HOUSE]: 12,
            [TexasHandType.FOUR_OF_A_KIND]: 14,
            [TexasHandType.STRAIGHT_FLUSH]: 18,
            [TexasHandType.ROYAL_FLUSH]: 25
        };

        // Award base scores
        for (const [playerId, result] of results) {
            const player = this.playerManager.getPlayer(playerId);
            if (player) {
                player.score += scoreTable[result.type];
            }
        }

        // Winner bonus (+1)
        if (this.currentRound.roundWinnerId) {
            const winner = this.playerManager.getPlayer(this.currentRound.roundWinnerId);
            if (winner) {
                winner.score += 1;
            }
        }

        // Update score display in real-time
        this.updateAllScoresDisplay();
    }

    // ========== Refill ==========

    /**
     * Refill players' hands to 5 cards
     */
    public refillHands(): void {
        const playerOrder = this.playerManager.getPlayerOrder();
        const dealerIndex = playerOrder.indexOf(this.currentRound!.dealerId);

        // First, remove played cards from all players' hands
        for (let i = 0; i < playerOrder.length; i++) {
            const index = (dealerIndex + i) % playerOrder.length;
            const playerId = playerOrder[index];
            const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;

            if (player.playedCards.length > 0) {
                player.playedCards.forEach((card: number) => {
                    const cardIndex = player.handCards.indexOf(card);
                    if (cardIndex !== -1) {
                        player.handCards.splice(cardIndex, 1);
                    }
                });
            }
        }

        // Then refill cards fairly - one card at a time to each player in turn
        // This ensures fair distribution when deck is running low
        let continueRefilling = true;
        while (continueRefilling && this.deck.length > 0) {
            continueRefilling = false;

            for (let i = 0; i < playerOrder.length; i++) {
                const index = (dealerIndex + i) % playerOrder.length;
                const playerId = playerOrder[index];
                const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;

                // Give one card if player needs it and deck has cards
                if (player.handCards.length < 5 && this.deck.length > 0) {
                    player.addCards([this.drawCard()]);
                    continueRefilling = true; // At least one player needs more cards
                }
            }
        }

        // 更新所有手牌显示
        this.updateAllHandsDisplay();

        // Prepare for next round
        // Loser becomes next dealer
        if (this.currentRound?.roundLoserId) {
            this.startNewRound(this.currentRound.roundLoserId);
        }
    }

    // ========== Deck Management ==========

    private initializeDeck(): void {
        this.deck = [];

        // Standard 52-card deck (no jokers)
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
        // Fisher-Yates shuffle
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

    // ========== Helpers ==========

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
        if (point === CardPoint.P_A) return 14;
        if (point === CardPoint.P_2) return 2;
        return point;
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

    // ========== Getters ==========

    public getState(): GameState {
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

    // ========== Dealer Indicator Offset Configuration ==========

    /**
     * 获取不同玩家数量下的庄家指示器偏移配置
     * @param playerCount 玩家数量 (2-5)
     * @returns 每个玩家位置的偏移量数组
     */
    private getDealerOffsetsByPlayerCount(playerCount: number): Array<{ x: number, y: number }> {
        switch (playerCount) {
            case 2:
                // 2人布局：底部 (0) 和 顶部左侧 (1) - 面对面
                return [
                    { x: -150, y: 80 },   // Player 0 (bottom) - 左侧偏上
                    { x: -150, y: -80 },  // Player 1 (top-left) - 左侧偏下
                ];

            case 3:
                // 3人布局：底部 (0)、顶部左侧 (1)、顶部右侧 (2) - 三角形
                return [
                    { x: -150, y: 80 },   // Player 0 (bottom) - 左侧偏上
                    { x: 120, y: -50 },   // Player 1 (top-left) - 右侧偏下
                    { x: -120, y: -50 },  // Player 2 (top-right) - 左侧偏下
                ];

            case 4:
                // 4人布局：底部 (0)、左侧 (1)、顶部左侧 (2)、顶部右侧 (3) - 钻石形
                return [
                    { x: -300, y: 50 },   // Player 0 (bottom) - 左侧偏上
                    { x: 80, y: -100 },     // Player 1 (left) - 右侧居中
                    { x: -200, y: -50 },   // Player 2 (top) - 右侧偏下
                    { x: -80, y: -100 },  // Player 3 (right) - 左侧偏下
                ];

            case 5:
                // 5人布局：底部 (0)、左侧 (1)、顶部左侧 (2)、顶部右侧 (3)、右侧 (4) - 五角形
                return [
                    { x: -150, y: 80 },   // Player 0 (bottom) - 左侧偏上
                    { x: 120, y: 30 },    // Player 1 (left) - 右侧偏上
                    { x: 150, y: -50 },   // Player 2 (top-left) - 右侧偏下
                    { x: -150, y: -50 },  // Player 3 (top-right) - 左侧偏下
                    { x: -120, y: 30 },   // Player 4 (right) - 左侧偏上
                ];

            default:
                console.warn(`[TheDecree] Unsupported player count: ${playerCount}, using 4-player offsets`);
                return [
                    { x: -150, y: 80 },
                    { x: 120, y: 0 },
                    { x: 150, y: -50 },
                    { x: -150, y: -50 },
                ];
        }
    }

    // ========== Auto-play Methods ==========

    /**
     * 自动选择首庄
     * 每个玩家亮出手牌第一张，最大的成为庄家
     */
    private autoSelectFirstDealer(): void {
        console.log('[TheDecree] Auto-selecting first dealer...');

        const revealedCards = new Map<string, number>();
        const playerOrder = this.playerManager.getPlayerOrder();
        for (const playerId of playerOrder) {
            const player = this.playerManager.getPlayer(playerId);
            if (player && player.handCards.length > 0) {
                revealedCards.set(playerId, player.handCards[0]);
            }
        }

        const dealerId = this.selectFirstDealer(revealedCards);
        console.log(`[TheDecree] First dealer selected: ${dealerId}`);

        // Log revealed cards
        for (const [playerId, card] of revealedCards) {
            const suit = this.getSuitName(this.getSuit(card));
            const point = this.getPointName(this.getPoint(card));
            console.log(`  ${playerId}: ${point}${suit}`);
        }

        // Start first round
        this.startNewRound(dealerId);
    }

    /**
     * 自动庄家叫牌（AI决策）
     */
    private autoDealerCall(): void {
        if (!this.currentRound) return;

        const dealerId = this.currentRound.dealerId;
        const dealer = this.playerManager.getPlayer(dealerId);
        if (!dealer) return;

        // Simple AI: Random choice weighted by hand size
        let cardsToPlay: 1 | 2 | 3;
        const handSize = dealer.handCards.length;

        if (handSize >= 3) {
            // Randomly choose 1, 2, or 3
            const choice = Math.floor(Math.random() * 3) + 1;
            cardsToPlay = choice as 1 | 2 | 3;
        } else if (handSize === 2) {
            cardsToPlay = Math.random() < 0.5 ? 1 : 2;
        } else {
            cardsToPlay = 1;
        }

        console.log(`[TheDecree] Round ${this.currentRound.roundNumber}: Dealer ${dealerId} calls ${cardsToPlay} card(s)`);
        this.dealerCall(cardsToPlay);
    }

    /**
     * 自动所有玩家选牌（AI决策）
     */
    private autoPlayerSelection(): void {
        if (!this.currentRound) return;

        const cardsToPlay = this.currentRound.cardsToPlay;
        const playerOrder = this.playerManager.getPlayerOrder();

        for (const playerId of playerOrder) {
            const player = this.playerManager.getPlayer(playerId) as TheDecreePlayer;
            if (!player || player.hasPlayed) continue;

            // Simple AI: Just play first N cards
            const selectedCards = player.handCards.slice(0, cardsToPlay);

            if (selectedCards.length === cardsToPlay) {
                this.playCards(selectedCards, playerId);

                const cardNames = selectedCards.map((card: number) => {
                    const suit = this.getSuitName(this.getSuit(card));
                    const point = this.getPointName(this.getPoint(card));
                    return `${point}${suit}`;
                }).join(', ');

                console.log(`[TheDecree]   ${playerId} plays: [${cardNames}]`);
            }
        }
    }

    /**
     * 输出回合结果
     */
    private logRoundResult(): void {
        if (!this.currentRound) return;

        console.log(`[TheDecree] Round ${this.currentRound.roundNumber} Result:`);
        console.log(`  Winner: ${this.currentRound.roundWinnerId}`);
        console.log(`  Loser: ${this.currentRound.roundLoserId}`);
        console.log('  Current Scores:');

        for (const player of this.playerManager.getAllPlayers()) {
            console.log(`    ${player.id}: ${player.score}`);
        }
    }

    /**
     * 自动补牌并开始下一轮
     */
    private autoRefill(): void {
        console.log('[TheDecree] Refilling hands...');

        // Refill hands
        this.refillHands();

        // Check if game is over (only when all players have no cards)
        if (this.isGameOver()) {
            this.handleGameOver();
        } else {
            console.log(`[TheDecree] Starting round ${this.currentRound?.roundNumber}... (Deck: ${this.deck.length} cards remaining)`);
        }
    }

    /**
     * 处理游戏结束
     */
    private handleGameOver(): void {
        console.log('[TheDecree] ========== GAME OVER ==========');
        this.state = GameState.GAME_OVER;

        // Find final winner
        let winnerId = '';
        let maxScore = -1;

        for (const player of this.playerManager.getAllPlayers()) {
            console.log(`  ${player.id}: ${player.score} points`);
            if (player.score > maxScore) {
                maxScore = player.score;
                winnerId = player.id;
            }
        }

        console.log(`[TheDecree] Final Winner: ${winnerId} with ${maxScore} points!`);
        console.log('[TheDecree] ====================================');

        // Prepare game result
        const gameResult = {
            winnerId,
            scores: this.getScores(),
            totalRounds: this.currentRound?.roundNumber || 0
        };

        // Notify PlayingStage
        // Access PlayingStage through Game's stageManager
        const stageManager = this.game.stageManager;
        if (stageManager) {
            const playingStage = stageManager.getCurrentStage();
            if (playingStage && typeof (playingStage as any).onGameFinished === 'function') {
                (playingStage as any).onGameFinished(gameResult);
            }
        }
    }

    // ========== Helper Methods for Logging ==========

    private getSuitName(suit: CardSuit): string {
        switch (suit) {
            case CardSuit.SPADE: return '♠';
            case CardSuit.HEART: return '♥';
            case CardSuit.CLUB: return '♣';
            case CardSuit.DIAMOND: return '♦';
            default: return '?';
        }
    }

    private getPointName(point: CardPoint): string {
        switch (point) {
            case CardPoint.P_A: return 'A';
            case CardPoint.P_2: return '2';
            case CardPoint.P_3: return '3';
            case CardPoint.P_4: return '4';
            case CardPoint.P_5: return '5';
            case CardPoint.P_6: return '6';
            case CardPoint.P_7: return '7';
            case CardPoint.P_8: return '8';
            case CardPoint.P_9: return '9';
            case CardPoint.P_10: return '10';
            case CardPoint.P_J: return 'J';
            case CardPoint.P_Q: return 'Q';
            case CardPoint.P_K: return 'K';
            default: return '?';
        }
    }
}
