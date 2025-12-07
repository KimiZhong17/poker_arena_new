/**
 * Player state enumeration
 */
export enum PlayerState {
    WAITING = 0,        // Waiting for game to start
    PLAYING = 1,        // In game
    IDLE = 2,           // Idle (not current turn)
    THINKING = 3,       // Thinking (current turn)
    PASSED = 4,         // Passed this round
    FINISHED = 5        // Finished (no cards left)
}

/**
 * Player data model
 */
export class Player {
    private _id: number;                    // Player ID
    private _name: string;                  // Player name
    private _position: number;              // Position/Seat (0-3 for 4 players)
    private _handCards: number[];           // Hand cards
    private _state: PlayerState;            // Current state
    private _isDealer: boolean;             // Is dealer

    constructor(id: number, name: string, position: number) {
        this._id = id;
        this._name = name;
        this._position = position;
        this._handCards = [];
        this._state = PlayerState.WAITING;
        this._isDealer = false;
    }

    // ========== Getters ==========

    public get id(): number {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public get position(): number {
        return this._position;
    }

    public get handCards(): number[] {
        return this._handCards;
    }

    public get state(): PlayerState {
        return this._state;
    }

    public get isDealer(): boolean {
        return this._isDealer;
    }

    public get cardCount(): number {
        return this._handCards.length;
    }

    // ========== Setters ==========

    public set state(value: PlayerState) {
        this._state = value;
    }

    public set isDealer(value: boolean) {
        this._isDealer = value;
    }

    // ========== Card operations ==========

    /**
     * Set hand cards (usually after dealing)
     */
    public setHandCards(cards: number[]): void {
        this._handCards = [...cards];
    }

    /**
     * Add cards to hand
     */
    public addCards(cards: number[]): void {
        this._handCards.push(...cards);
    }

    /**
     * Remove cards from hand (after playing)
     */
    public removeCards(cards: number[]): void {
        cards.forEach(card => {
            const index = this._handCards.indexOf(card);
            if (index !== -1) {
                this._handCards.splice(index, 1);
            }
        });
    }

    /**
     * Check if player has specific cards
     */
    public hasCards(cards: number[]): boolean {
        const handCopy = [...this._handCards];
        for (const card of cards) {
            const index = handCopy.indexOf(card);
            if (index === -1) {
                return false;
            }
            handCopy.splice(index, 1);
        }
        return true;
    }

    /**
     * Clear all cards
     */
    public clearCards(): void {
        this._handCards = [];
    }

    /**
     * Sort hand cards by point value
     */
    public sortCards(levelRank: number = 0): void {
        // Simple sort by card value
        // Can be enhanced with CardUtils.getLogicWeight for better sorting
        this._handCards.sort((a, b) => a - b);
    }

    /**
     * Check if player has finished (no cards left)
     */
    public isFinished(): boolean {
        return this._handCards.length === 0;
    }

    // ========== Utility methods ==========

    /**
     * Reset player state for new game
     */
    public reset(): void {
        this._handCards = [];
        this._state = PlayerState.WAITING;
        this._isDealer = false;
    }

    /**
     * Get player info as string for debugging
     */
    public toString(): string {
        return `Player[${this._id}] ${this._name} - Position: ${this._position}, Cards: ${this._handCards.length}, State: ${PlayerState[this._state]}`;
    }
}
