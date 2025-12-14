import { CardSuit, CardPoint } from "./CardConst";
import { GameConfig } from "./GameConfig";

export class CardUtils {
    /**
     * Get the suit of the card
     * @param card The card value (e.g. 0x25 returns 0x20 for Heart)
     */
    public static getSuit(card: number): number {
        return card & 0xF0;
    }

    /**
     * Get the physical point value of the card (3~15)
     * @param card The card value (e.g. 0x25 returns 5)
     */
    public static getPoint(card: number): number {
        return card & 0x0F;
    }

    /**
     * Get the logical weight of the card for comparison
     * @param card The card value
     * @param levelRank The current level rank (e.g. if playing 10, pass 10)
     */
    public static getLogicWeight(card: number, levelRank: number): number {
        const suit = this.getSuit(card);
        const point = this.getPoint(card);

        // 1. Handle jokers (Black Joker has higher weight than Red Joker)
        if (suit === CardSuit.JOKER) {
            return point === CardPoint.BLACK_JOKER ? 1000 : 900;
        }

        // 2. Handle level cards (current level rank)
        if (point === levelRank) {
            // If LEVEL_CARDS_HIGHEST is enabled, level cards become the highest
            if (GameConfig.LEVEL_CARDS_HIGHEST) {
                // Heart level card (wild card) is highest
                if (suit === CardSuit.HEART) {
                    return 800;
                }
                // Normal level cards are second highest
                return 700;
            } else {
                // Current rule: level cards don't change ranking
                // Only Heart level card becomes wild card (high weight for special handling)
                if (suit === CardSuit.HEART) {
                    return 800; // Wild card marker
                }
                // Non-Heart level cards use normal weight
                // Fall through to normal card handling
            }
        }

        // 3. Handle normal cards
        // Card ranking: 3 < 4 < 5 ... < K < A < 2 (2 is the highest normal card)
        // Physical values: P_3=3, P_4=4, ..., P_K=13, P_A=14, P_2=15
        // Weight mapping:
        // 3(point=3) -> 30
        // 4(point=4) -> 40
        // ...
        // K(point=13) -> 130
        // A(point=14) -> 140
        // 2(point=15) -> 150 (highest normal card)

        return point * 10; // Direct mapping since physical order already matches ranking
    }

    /**
     * Check if the card is a wild card
     * @param card The card value
     * @param levelRank The current level rank
     */
    public static isWildCard(card: number, levelRank: number): boolean {
        return this.getPoint(card) === levelRank && this.getSuit(card) === CardSuit.HEART;
    }
}


