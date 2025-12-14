import { HandEvaluator, HandResult } from "../Card/HandEvaluator";

/**
 * Game mode configuration
 */
export interface GameModeConfig {
    id: string;
    name: string;
    displayName: string;
    minPlayers: number;
    maxPlayers: number;
    deckCount: number;        // Number of decks
    initialHandSize: number;  // Initial cards per player
    description: string;
}

/**
 * Base class for all game modes
 */
export abstract class GameModeBase {
    protected config: GameModeConfig;

    constructor(config: GameModeConfig) {
        this.config = config;
    }

    public getConfig(): GameModeConfig {
        return { ...this.config };
    }

    /**
     * Initialize game state
     */
    public abstract initGame(playerIds: string[]): void;

    /**
     * Deal cards to players
     */
    public abstract dealCards(): void;

    /**
     * Validate if a play is legal
     */
    public abstract isValidPlay(cards: number[], playerId: string): boolean;

    /**
     * Process a player's play
     */
    public abstract playCards(cards: number[], playerId: string): boolean;

    /**
     * Check if game is over
     */
    public abstract isGameOver(): boolean;

    /**
     * Get current level rank (for games like Guandan)
     */
    public abstract getCurrentLevelRank(): number;
}
