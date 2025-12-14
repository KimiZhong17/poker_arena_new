import { GameModeBase } from "./GameModeBase";
import { TexasHoldEmEvaluator, TexasHandResult, TexasHandType } from "./TexasHoldEmEvaluator";
import { CardSuit, CardPoint } from "../../Card/CardConst";

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
 */
export class TheDecreeMode extends GameModeBase {
    // Game state
    private state: GameState = GameState.SETUP;
    private players: Map<string, PlayerState> = new Map();
    private playerOrder: string[] = [];  // Order of players
    private communityCards: number[] = [];  // 4 community cards
    private deck: number[] = [];  // Remaining deck
    private currentRound: RoundState | null = null;

    constructor() {
        super({
            id: "the_decree",
            name: "TheDecree",
            displayName: "The Decree",
            minPlayers: 2,
            maxPlayers: 4,
            deckCount: 1,
            initialHandSize: 5,
            description: "Dealer sets the number, you set the winner."
        });
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
}
