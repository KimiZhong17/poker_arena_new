import { GameModeBase, GameModeConfig } from "./GameModeBase";
import { TexasHoldEmEvaluator, TexasHandResult, TexasHandType } from "./TexasHoldEmEvaluator";
import { CardSuit, CardPoint } from "../../Card/CardConst";
import { Game } from "../../Game";

/**
 * Player state in The Decree
 */
interface PlayerState {
    id: string;
    hand: number[];          // Private cards (5 cards initially)
    score: number;           // Total score
    playedCards: number[];   // Cards played this round (1-3 cards)
    hasPlayed: boolean;      // Whether player has selected cards this round
}

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
    private players: Map<string, PlayerState> = new Map();
    private playerOrder: string[] = [];  // Order of players
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
            displayName: "天命之战",
            minPlayers: 4,
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

        // 3. 初始化游戏
        const playerIds = ['player_0', 'player_1', 'player_2', 'player_3'];
        this.initGame(playerIds);

        // 4. 发牌
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

        this.players.clear();
        this.playerOrder = [];
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
     * TheDecree是4人游戏，使用菱形布局：
     * - Player 0: 底部（玩家）
     * - Player 1: 左侧
     * - Player 2: 顶部
     * - Player 3: 右侧
     * - Player 4 (RightHand): 隐藏
     */
    public adjustPlayerLayout(): void {
        console.log('[TheDecree] Adjusting player layout (4 players)');

        const handsManager = this.game.handsManager;
        if (!handsManager) {
            console.warn('[TheDecree] HandsManager not found');
            return;
        }

        const handsManagerNode = this.game.handsManagerNode;
        if (!handsManagerNode) {
            console.warn('[TheDecree] HandsManagerNode not found');
            return;
        }

        // TheDecree: 4人菱形布局
        const positions: Array<{ name: string; x: number; y: number; active: boolean }> = [
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'LeftHand', x: -450, y: 0, active: true },        // Player 1 (Left)
            { name: 'TopLeftHand', x: 0, y: 280, active: true },      // Player 2 (Top) - centered
            { name: 'TopRightHand', x: 450, y: 0, active: true },     // Player 3 (Right)
            { name: 'RightHand', x: 550, y: 50, active: false }       // Hidden for TheDecree
        ];

        for (const config of positions) {
            const handNode = handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                if (config.active) {
                    handNode.setPosition(config.x, config.y, 0);
                }
            }
        }

        console.log('[TheDecree] Player layout adjusted (4 players in diamond formation)');
    }

    // ========== Public API ==========

    public initGame(playerIds: string[]): void {
        if (playerIds.length < this.config.minPlayers ||
            playerIds.length > this.config.maxPlayers) {
            throw new Error(
                `The Decree requires ${this.config.minPlayers}-${this.config.maxPlayers} players`
            );
        }

        this.playerOrder = [...playerIds];
        this.players.clear();

        playerIds.forEach(id => {
            this.players.set(id, {
                id,
                hand: [],
                score: 0,
                playedCards: [],
                hasPlayed: false
            });
        });

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
        for (const player of this.players.values()) {
            player.hand = [
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard()
            ];
        }

        this.state = GameState.FIRST_DEALER_SELECTION;

        // 显示发牌结果到UI
        this.displayCards();
    }

    /**
     * 显示所有牌（公共牌和玩家手牌）
     */
    private displayCards(): void {
        // 调用 Game 的显示方法
        // @ts-ignore - accessing private method
        if (typeof this.game['initializeTheDecreeHandsDisplay'] === 'function') {
            // @ts-ignore
            this.game['initializeTheDecreeHandsDisplay']();
        }

        // @ts-ignore - accessing private method
        if (typeof this.game['displayCommunityCards'] === 'function') {
            // @ts-ignore
            this.game['displayCommunityCards']();
        }
    }

    public isValidPlay(cards: number[], playerId: string): boolean {
        if (!this.currentRound) return false;

        const player = this.players.get(playerId);
        if (!player) return false;

        // Check if it's the right state
        if (this.state !== GameState.PLAYER_SELECTION) return false;

        // Check if player already played
        if (player.hasPlayed) return false;

        // Check if correct number of cards
        if (cards.length !== this.currentRound.cardsToPlay) return false;

        // Check if player has these cards
        return cards.every(card => player.hand.includes(card));
    }

    public playCards(cards: number[], playerId: string): boolean {
        if (!this.isValidPlay(cards, playerId)) {
            return false;
        }

        const player = this.players.get(playerId)!;

        // Remove cards from hand
        player.playedCards = cards;
        player.hasPlayed = true;
        cards.forEach(card => {
            const index = player.hand.indexOf(card);
            if (index !== -1) {
                player.hand.splice(index, 1);
            }
        });

        this.currentRound!.playerPlays.set(playerId, cards);

        // Check if all players have played
        if (this.allPlayersPlayed()) {
            this.state = GameState.SHOWDOWN;
            this.processShowdown();
        }

        return true;
    }

    public isGameOver(): boolean {
        // Game is over when all players have no cards left
        for (const player of this.players.values()) {
            if (player.hand.length > 0) {
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
        for (const player of this.players.values()) {
            player.playedCards = [];
            player.hasPlayed = false;
        }

        this.state = GameState.DEALER_CALL;
    }

    /**
     * Dealer declares how many cards to play
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): boolean {
        if (!this.currentRound) return false;
        if (this.state !== GameState.DEALER_CALL) return false;

        this.currentRound.cardsToPlay = cardsToPlay;
        this.state = GameState.PLAYER_SELECTION;
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
            [TexasHandType.HIGH_CARD]: 0,
            [TexasHandType.ONE_PAIR]: 1,
            [TexasHandType.TWO_PAIR]: 2,
            [TexasHandType.THREE_OF_A_KIND]: 3,
            [TexasHandType.STRAIGHT]: 4,
            [TexasHandType.FLUSH]: 5,
            [TexasHandType.FULL_HOUSE]: 6,
            [TexasHandType.FOUR_OF_A_KIND]: 7,
            [TexasHandType.STRAIGHT_FLUSH]: 8,
            [TexasHandType.ROYAL_FLUSH]: 9
        };

        // Award base scores
        for (const [playerId, result] of results) {
            const player = this.players.get(playerId)!;
            player.score += scoreTable[result.type];
        }

        // Winner bonus (+1)
        if (this.currentRound.roundWinnerId) {
            const winner = this.players.get(this.currentRound.roundWinnerId)!;
            winner.score += 1;
        }
    }

    // ========== Refill ==========

    /**
     * Refill players' hands to 5 cards
     */
    public refillHands(): void {
        const dealerIndex = this.playerOrder.indexOf(this.currentRound!.dealerId);

        // Start from dealer, clockwise
        for (let i = 0; i < this.playerOrder.length; i++) {
            const index = (dealerIndex + i) % this.playerOrder.length;
            const playerId = this.playerOrder[index];
            const player = this.players.get(playerId)!;

            while (player.hand.length < 5 && this.deck.length > 0) {
                player.hand.push(this.drawCard());
            }
        }

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
        return this.currentRound.playerPlays.size === this.players.size;
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

    public getPlayerState(playerId: string): PlayerState | undefined {
        return this.players.get(playerId);
    }

    public getCurrentRound(): RoundState | null {
        return this.currentRound;
    }

    public getDeckSize(): number {
        return this.deck.length;
    }

    public getScores(): Map<string, number> {
        const scores = new Map<string, number>();
        for (const [playerId, player] of this.players) {
            scores.set(playerId, player.score);
        }
        return scores;
    }

    // ========== Auto-play Methods ==========

    /**
     * 自动选择首庄
     * 每个玩家亮出手牌第一张，最大的成为庄家
     */
    private autoSelectFirstDealer(): void {
        console.log('[TheDecree] Auto-selecting first dealer...');

        const revealedCards = new Map<string, number>();
        for (const playerId of this.playerOrder) {
            const player = this.players.get(playerId)!;
            if (player.hand.length > 0) {
                revealedCards.set(playerId, player.hand[0]);
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
        const dealer = this.players.get(dealerId)!;

        // Simple AI: Random choice weighted by hand size
        let cardsToPlay: 1 | 2 | 3;
        const handSize = dealer.hand.length;

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

        for (const playerId of this.playerOrder) {
            const player = this.players.get(playerId)!;
            if (player.hasPlayed) continue;

            // Simple AI: Just play first N cards
            const selectedCards = player.hand.slice(0, cardsToPlay);

            if (selectedCards.length === cardsToPlay) {
                this.playCards(selectedCards, playerId);

                const cardNames = selectedCards.map(card => {
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

        for (const [playerId, player] of this.players) {
            console.log(`    ${playerId}: ${player.score}`);
        }
    }

    /**
     * 自动补牌并开始下一轮
     */
    private autoRefill(): void {
        console.log('[TheDecree] Refilling hands...');

        // Check if game should end
        if (this.deck.length < this.players.size * 2) {
            console.log('[TheDecree] Deck running low, game ending soon...');
        }

        // Refill hands
        this.refillHands();

        // Check if game is over
        if (this.isGameOver() || this.deck.length === 0) {
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

        for (const [playerId, player] of this.players) {
            console.log(`  ${playerId}: ${player.score} points`);
            if (player.score > maxScore) {
                maxScore = player.score;
                winnerId = playerId;
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
