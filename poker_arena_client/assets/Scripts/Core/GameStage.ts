/**
 * Game Stage Enum
 * Defines the different stages of the game flow
 */
export enum GameStage {
    /** Preparing stage: Players click ready/start button */
    READY = 'READY',

    /** Playing stage: Main game logic, dealing cards, playing */
    PLAYING = 'PLAYING',

    /** End stage: Game finished, showing results */
    END = 'END'
}
