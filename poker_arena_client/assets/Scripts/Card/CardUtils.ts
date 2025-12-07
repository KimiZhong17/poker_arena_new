import { CardSuit, CardPoint } from "./CardConst";

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

        // 1. Handle jokers (Red for 1000 and Black for 900)
        if (suit === CardSuit.JOKER) {
            return point === CardPoint.BLACK_JOKER ? 1000 : 900;
        }

        // 2. Handle level cards (current level rank)
        if (point === levelRank) {
            // If it's a Heart level card -> Wild card (weight just below Black Joker, or give a special mark)
            // For sorting convenience, set to 800
            if (suit === CardSuit.HEART) {
                return 800; 
            }
            // Normal level card -> weight 700
            return 700;
        }

        // 3. Handle normal cards
        // Guandan rules: 2 < 3 ... < A
        // If your physical value P_2 is already 15, just return the point
        // Remember to multiply by a factor to avoid conflicts with the special cards above, or directly return point + base offset
        
        // Suppose physical value P_2 = 15, P_A = 14
        // If the rule is 2 is the smallest (in Guandan if not playing 2, 2 is the smallest)
        // We need to map P_2(15) back to the position of 2
        
        let logicPoint = point;
        if (point === 15) logicPoint = 2; // Adjust weight for 2
        if (point === 14) logicPoint = 14; // A

        return logicPoint * 10; // *10 is to leave space for future suit sorting expansion
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


