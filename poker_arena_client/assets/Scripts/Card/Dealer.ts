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
     * Deal cards
     * @param deck Shuffled deck
     * @param playerCount Number of players
     * @returns Array of players' hands
     */
    public static deal(deck: number[], playerCount: number): number[][] {
        if (playerCount <= 0) {
            throw new Error("Player count must be greater than 0");
        }

        if (deck.length < playerCount) {
            throw new Error("Not enough cards for the number of players");
        }

        const playersHands: number[][] = [];
        const cardsPerPlayer = Math.floor(deck.length / playerCount);

        // Initialize arrays for each player
        for (let i = 0; i < playerCount; i++) {
            playersHands.push([]);
        }

        // Deal cards evenly (remaining cards stay in the deck)
        for (let i = 0; i < playerCount; i++) {
            const start = i * cardsPerPlayer;
            const end = start + cardsPerPlayer;
            playersHands[i] = deck.slice(start, end);

            // After dealing, it is usually recommended to immediately sort the hands for easier client display
            // SortHelper.sort(playersHands[i], currentLevel);
        }

        return playersHands;
    }
}