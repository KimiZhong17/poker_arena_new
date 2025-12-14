/**
 * Game configuration for card ranking rules
 */
export class GameConfig {
    /**
     * Card ranking mode
     * - 'normal': 3 < 4 < ... < K < A < 2 (default)
     * - 'level_highest': Level cards are highest (future expansion)
     */
    public static CARD_RANKING_MODE: 'normal' | 'level_highest' = 'normal';

    /**
     * Whether level cards affect card ranking
     * - false: Level cards don't change ranking, only Heart level cards are wild (current rule)
     * - true: Level cards become highest (future expansion)
     */
    public static LEVEL_CARDS_HIGHEST: boolean = false;

    /**
     * Joker bomb must have at least one RED_JOKER
     */
    public static JOKER_BOMB_REQUIRES_RED: boolean = true;

    /**
     * Minimum cards for a normal bomb
     */
    public static MIN_BOMB_SIZE: number = 4;

    /**
     * Minimum jokers for a joker bomb
     */
    public static MIN_JOKER_BOMB_SIZE: number = 2;
}
