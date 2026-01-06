// This file is deprecated and will be replaced soon.
// TODO: Change to GuandanModeClent
import { _decorator, Component } from 'cc';
import { Player, PlayerState } from '../LocalStore/LocalPlayerStore';
import { Dealer } from '../Card/Dealer';
import { HandEvaluator, HandResult, HandType } from '../Card/HandEvaluator';

const { ccclass, property } = _decorator;

/**
 * Game state enumeration
 */
export enum GameState {
    IDLE = 0,           // Idle, waiting to start
    DEALING = 1,        // Dealing cards
    PLAYING = 2,        // In progress
    ROUND_END = 3,      // Round ended
    GAME_END = 4        // Game ended
}

/**
 * Game phase enumeration
 */
export enum GamePhase {
    WAITING = 0,        // Waiting for players
    DEALING = 1,        // Dealing cards
    BOSS_COLLECT = 2,   // Boss collecting remaining cards
    PLAYING = 3,        // Playing phase
    SETTLING = 4        // Settling/Scoring
}

/**
 * Game configuration
 */
export interface GameConfig {
    playerCount: number;    // Number of players (default 5)
    deckCount: number;      // Number of decks (default 3, calculated as ceil(playerCount/2))
    cardsPerPlayer: number; // Cards per player (default 31)
    levelRank: number;      // Current level rank (2-A)
}

/**
 * Main game controller
 * Manages game flow, player turns, and rule enforcement
 */
@ccclass('GameController')
export class GameController extends Component {

    // Singleton instance
    public static instance: GameController = null!;

    // Game state
    private _gameState: GameState = GameState.IDLE;
    private _gamePhase: GamePhase = GamePhase.WAITING;

    // Players
    private _players: Player[] = [];
    private _currentPlayerIndex: number = 0;

    // Game config
    private _config: GameConfig = {
        playerCount: 5,
        deckCount: 3,           // ceil(5/2) = 3
        cardsPerPlayer: 31,
        levelRank: 2            // Start from 2
    };

    // Current round data
    private _deck: number[] = [];
    private _remainingCards: number[] = [];  // Remaining cards after dealing
    private _bossCollectedCards: number[] = [];  // Cards boss collected
    private _burnedCards: number[] = [];  // Cards removed from game (shown to all)
    private _bossPlayerIndex: number = 0;  // Index of the boss player (default: 0 for main player)
    private _lastPlayedCards: number[] = [];
    private _lastPlayedHand: HandResult | null = null;
    private _lastPlayerIndex: number = -1;
    private _passedPlayers: Set<number> = new Set();

    // ========== Lifecycle ==========

    onLoad() {
        GameController.instance = this;
    }

    start() {
        console.log("GameController initialized");
    }

    // ========== Game initialization ==========

    /**
     * Initialize game with custom config
     */
    public init(config: Partial<GameConfig> = {}): void {
        this._config = { ...this._config, ...config };
        this._gameState = GameState.IDLE;
        this._gamePhase = GamePhase.WAITING;

        console.log("Game initialized with config:", this._config);
    }

    /**
     * Create players
     */
    public createPlayers(playerNames: string[]): void {
        this._players = [];
        const count = Math.min(playerNames.length, this._config.playerCount);

        for (let i = 0; i < count; i++) {
            const player = new Player({
                id: `player_${i}`,
                name: playerNames[i],
                seatIndex: i,
                isReady: false,
                isHost: i === 0
            });
            this._players.push(player);
        }

        console.log(`Created ${count} players`);
    }

    /**
     * Start a new game
     */
    public startGame(): void {
        if (this._players.length < 2) {
            console.error("Not enough players to start game");
            return;
        }

        console.log("Starting new game...");

        // Reset all players
        this._players.forEach(p => p.reset());

        // Create and shuffle deck
        this._deck = Dealer.createDeck(this._config.deckCount);
        Dealer.shuffle(this._deck);

        // Phase 1: Deal cards
        this._gameState = GameState.DEALING;
        this._gamePhase = GamePhase.DEALING;
        this.dealCards();

        // Phase 2: Enter Boss collect phase
        this._gamePhase = GamePhase.BOSS_COLLECT;
        console.log("Entering BOSS_COLLECT phase. Call bossCollectCards() to continue.");

        // Note: The game will move to PLAYING phase after bossCollectCards() is called
        // At that point, we'll initialize the playing state
    }

    /**
     * Initialize playing phase (called after boss collects cards)
     */
    private initPlayingPhase(): void {
        this._currentPlayerIndex = this._bossPlayerIndex; // Boss starts first
        this._lastPlayerIndex = -1;
        this._lastPlayedCards = [];
        this._lastPlayedHand = null;
        this._passedPlayers.clear();

        this._players[this._currentPlayerIndex].state = PlayerState.THINKING;

        console.log("Playing phase started! Boss starts first:", this._players[this._currentPlayerIndex].name);
    }

    /**
     * Deal cards to all players
     */
    private dealCards(): void {
        const dealResult = Dealer.deal(
            this._deck,
            this._players.length,
            this._config.cardsPerPlayer
        );

        // Assign hands to players
        for (let i = 0; i < this._players.length; i++) {
            this._players[i].setHandCards(dealResult.hands[i]);
            this._players[i].sortCards(this._config.levelRank);
            console.log(`Dealt ${dealResult.hands[i].length} cards to ${this._players[i].name}`);
        }

        // Store remaining cards
        this._remainingCards = dealResult.remaining;
        console.log(`Remaining cards: ${this._remainingCards.length}`);

        // Validate remaining cards count
        if (this._remainingCards.length < this._players.length) {
            console.error(`Not enough remaining cards! Need at least ${this._players.length}, got ${this._remainingCards.length}`);
        }
    }

    /**
     * Boss collects cards from remaining cards (pseudo-random selection)
     * Boss receives playerCount cards, the rest are burned (shown to all players)
     */
    public bossCollectCards(): void {
        if (this._gamePhase !== GamePhase.BOSS_COLLECT) {
            console.error("Cannot collect cards - not in BOSS_COLLECT phase");
            return;
        }

        if (this._remainingCards.length < this._players.length) {
            console.error("Not enough remaining cards for boss to collect");
            return;
        }

        const playerCount = this._players.length;

        // Shuffle remaining cards for pseudo-random selection
        const shuffledRemaining = [...this._remainingCards];
        Dealer.shuffle(shuffledRemaining);

        // Boss takes first playerCount cards
        this._bossCollectedCards = shuffledRemaining.slice(0, playerCount);

        // Remaining cards are burned (shown to all)
        this._burnedCards = shuffledRemaining.slice(playerCount);

        // Add collected cards to boss's hand
        const boss = this._players[this._bossPlayerIndex];
        boss.addCards(this._bossCollectedCards);
        boss.sortCards(this._config.levelRank);

        console.log(`Boss (${boss.name}) collected ${this._bossCollectedCards.length} cards`);
        console.log(`Burned cards (shown to all): ${this._burnedCards.length} cards`);
        console.log(`Boss now has ${boss.handCards.length} cards total`);

        // Clear remaining cards as they've been distributed
        this._remainingCards = [];

        // Move to playing phase
        this._gamePhase = GamePhase.PLAYING;
        this._gameState = GameState.PLAYING;

        // Initialize playing phase
        this.initPlayingPhase();
    }

    // ========== Game flow ==========

    /**
     * Player plays cards
     * @param playerIndex Player index
     * @param cards Cards to play
     */
    public playCards(playerIndex: number, cards: number[]): boolean {
        const player = this._players[playerIndex];

        // Validate it's player's turn
        if (playerIndex !== this._currentPlayerIndex) {
            console.error("Not player's turn");
            return false;
        }

        // Validate player has these cards
        if (!player.hasCards(cards)) {
            console.error("Player doesn't have these cards");
            return false;
        }

        // Evaluate the hand
        const handResult = HandEvaluator.evaluate(cards, this._config.levelRank);
        if (handResult.type === HandType.INVALID) {
            console.error("Invalid hand type");
            return false;
        }

        // Validate can beat last hand (if any)
        if (this._lastPlayedHand !== null) {
            if (!HandEvaluator.canBeat(handResult, this._lastPlayedHand)) {
                console.error("Cannot beat last played hand");
                return false;
            }
        }

        // Play is valid, execute it
        player.removeCards(cards);
        this._lastPlayedCards = cards;
        this._lastPlayedHand = handResult;
        this._lastPlayerIndex = playerIndex;
        this._passedPlayers.clear(); // Reset passed players

        console.log(`${player.name} played ${cards.length} cards (${HandType[handResult.type]})`);

        // Check if player finished
        if (player.isFinished()) {
            player.state = PlayerState.FINISHED;
            console.log(`${player.name} finished!`);
            this.checkGameEnd();
            return true;
        }

        // Move to next player
        this.nextPlayer();
        return true;
    }

    /**
     * Player passes
     */
    public pass(playerIndex: number): boolean {
        const player = this._players[playerIndex];

        // Validate it's player's turn
        if (playerIndex !== this._currentPlayerIndex) {
            console.error("Not player's turn");
            return false;
        }

        // Cannot pass if no one has played yet
        if (this._lastPlayerIndex === -1) {
            console.error("Cannot pass on first play");
            return false;
        }

        // Cannot pass if you were the last to play
        if (playerIndex === this._lastPlayerIndex) {
            console.error("Cannot pass if you played last");
            return false;
        }

        player.state = PlayerState.PASSED;
        this._passedPlayers.add(playerIndex);

        console.log(`${player.name} passed`);

        // Check if all other players passed (new round starts)
        if (this.checkAllOthersPassed()) {
            console.log("New round started!");
            this._lastPlayedCards = [];
            this._lastPlayedHand = null;
            this._passedPlayers.clear();
            // Current player gets to start new round
        } else {
            this.nextPlayer();
        }

        return true;
    }

    /**
     * Move to next player
     */
    private nextPlayer(): void {
        this._players[this._currentPlayerIndex].state = PlayerState.IDLE;

        // Find next active player
        do {
            this._currentPlayerIndex = (this._currentPlayerIndex + 1) % this._players.length;
        } while (this._players[this._currentPlayerIndex].state === PlayerState.FINISHED);

        this._players[this._currentPlayerIndex].state = PlayerState.THINKING;

        console.log("Next player:", this._players[this._currentPlayerIndex].name);
    }

    /**
     * Check if all other players have passed
     */
    private checkAllOthersPassed(): boolean {
        let activeCount = 0;
        for (const player of this._players) {
            if (player.state !== PlayerState.FINISHED) {
                activeCount++;
            }
        }

        // If passed count + 1 (current player) equals active count
        return this._passedPlayers.size === activeCount - 1;
    }

    /**
     * Check if game should end
     */
    private checkGameEnd(): void {
        const activePlayers = this._players.filter(p => p.state !== PlayerState.FINISHED);

        if (activePlayers.length <= 1) {
            this._gameState = GameState.GAME_END;
            this._gamePhase = GamePhase.SETTLING;
            console.log("Game ended!");
            // TODO: Calculate scores and rankings
        }
    }

    // ========== Getters ==========

    public get gameState(): GameState {
        return this._gameState;
    }

    public get gamePhase(): GamePhase {
        return this._gamePhase;
    }

    public get players(): Player[] {
        return this._players;
    }

    public get currentPlayer(): Player {
        return this._players[this._currentPlayerIndex];
    }

    public get config(): GameConfig {
        return this._config;
    }

    public get lastPlayedCards(): number[] {
        return this._lastPlayedCards;
    }

    public get lastPlayedHand(): HandResult | null {
        return this._lastPlayedHand;
    }

    public get bossPlayerIndex(): number {
        return this._bossPlayerIndex;
    }

    public get bossPlayer(): Player {
        return this._players[this._bossPlayerIndex];
    }

    public get burnedCards(): number[] {
        return this._burnedCards;
    }

    public get remainingCards(): number[] {
        return this._remainingCards;
    }
}
