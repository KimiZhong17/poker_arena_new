import { GameModeClientBase } from "./GameModeClientBase";

/**
 * Guandan game mode implementation
 */
export class GuandanMode extends GameModeClientBase {
    private currentLevelRank: number = 3; // Start from 3
    private playerHands: Map<string, number[]> = new Map();
    private lastPlay: { playerId: string; cards: number[] } | null = null;

    constructor() {
        super({
            id: "guandan",
            name: "Guandan",
            displayName: "Guandan (掼蛋)",
            minPlayers: 5,
            maxPlayers: 5,
            deckCount: 2,
            initialHandSize: 21, // 108 cards / 5 players ≈ 21 cards per player (with some cards remaining)
            description: "Classic Guandan gameplay, 5 players"
        });
    }

    public initGame(playerIds: string[]): void {
        if (playerIds.length !== 5) {
            throw new Error("Guandan requires exactly 5 players");
        }

        this.playerHands.clear();
        playerIds.forEach(id => {
            this.playerHands.set(id, []);
        });

        this.lastPlay = null;
    }

    public dealCards(): void {
        // TODO: Implement card dealing logic
        // This should use a deck manager to shuffle and distribute cards
    }

    public isValidPlay(cards: number[], playerId: string): boolean {
        // TODO: Implement play validation
        // Check if cards form a valid hand type
        // Check if it beats the last play
        return true;
    }

    public playCards(cards: number[], playerId: string): boolean {
        if (!this.isValidPlay(cards, playerId)) {
            return false;
        }

        // Remove cards from player's hand
        const hand = this.playerHands.get(playerId);
        if (!hand) return false;

        // TODO: Remove played cards from hand

        this.lastPlay = { playerId, cards };
        return true;
    }

    public isGameOver(): boolean {
        // Check if any player has no cards left
        for (const [, hand] of this.playerHands) {
            if (hand.length === 0) {
                return true;
            }
        }
        return false;
    }

    public getCurrentLevelRank(): number {
        return this.currentLevelRank;
    }

    public setLevelRank(rank: number): void {
        this.currentLevelRank = rank;
    }
}
