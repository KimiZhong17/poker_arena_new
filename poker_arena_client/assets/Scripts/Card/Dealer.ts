import { CardSuit, CardPoint } from "./CardConst";

export class Dealer {

    /**
     * Generate initial deck
     * @param deckCount Number of decks
     */
    public static createDeck(deckCount: number = 2): number[] {
        let deck: number[] = [];
        
        for (let d = 0; d < deckCount; d++) {
            // 1. Generate normal cards
            for (let point = 3; point <= 15; point++) {
                for (let suitVal = 0x00; suitVal <= 0x30; suitVal += 0x10) {
                    let card = suitVal | point; 
                    deck.push(card);
                }
            }

            // 2. Generate Jokers
            deck.push(0x41); 
            deck.push(0x42);
        }

        return deck;
    }

    /**
     * Shuffle algorithm: Fisher-Yates Shuffle
     * @param deck Array of cards
     */
    public static shuffle(deck: number[]): void {
        let len = deck.length;
        // Start from the last card and swap with any card before it
        for (let i = len - 1; i > 0; i--) {
            // Randomly generate an index from 0 to i
            const randomIndex = Math.floor(Math.random() * (i + 1));
            
            // ES6 destructuring assignment to swap
            [deck[i], deck[randomIndex]] = [deck[randomIndex], deck[i]];
        }
    }

    /**
     * Deal cards (round-robin style)
     * @param deck Shuffled deck
     * @param playerCount Number of players
     * @param cardsPerPlayer Number of cards each player should receive
     * @returns Object containing players' hands and remaining cards
     */
    public static deal(deck: number[], playerCount: number, cardsPerPlayer: number): { hands: number[][], remaining: number[] } {
        if (playerCount <= 0) {
            throw new Error("Player count must be greater than 0");
        }

        if (deck.length < playerCount * cardsPerPlayer) {
            throw new Error("Not enough cards in deck");
        }

        const playersHands: number[][] = [];

        // Initialize arrays for each player
        for (let i = 0; i < playerCount; i++) {
            playersHands.push([]);
        }

        // Deal cards in round-robin fashion: one card to each player in turn
        let cardIndex = 0;
        for (let round = 0; round < cardsPerPlayer; round++) {
            for (let player = 0; player < playerCount; player++) {
                playersHands[player].push(deck[cardIndex++]);
            }
        }

        // Remaining cards stay undealt
        const remaining = deck.slice(cardIndex);

        return {
            hands: playersHands,
            remaining: remaining
        };
    }
}