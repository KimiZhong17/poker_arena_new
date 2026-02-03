/**
 * Card ranking mode for sorting
 */
export enum CardRankingMode {
    /** A is low (A=1, 2=2, ..., K=13) - Standard poker ranking */
    ACE_LOW = 'ACE_LOW',

    /** A is high (2=2, ..., K=13, A=14) - Most common in poker games */
    ACE_HIGH = 'ACE_HIGH',

    /** 2 is highest (3=3, ..., A=14, 2=15) - Used in games like Guandan (掼蛋) */
    TWO_HIGH = 'TWO_HIGH'
}

/**
 * Get the rank value for a card point based on ranking mode
 * @param point Card point value (can be 1-13 for standard, or CardPoint enum value 14-15 for Guandan)
 * @param mode Ranking mode
 * @returns Rank value for sorting
 */
function getCardRank(point: number, mode: CardRankingMode): number {
    // Handle CardPoint enum values (Guandan format where A=14, 2=15)
    // Convert to standard 1-13 format first
    let normalizedPoint = point;
    if (point === 14) {
        normalizedPoint = 1; // A
    } else if (point === 15) {
        normalizedPoint = 2; // 2
    } else if (point >= 3 && point <= 13) {
        normalizedPoint = point; // 3-K stays the same
    }

    switch (mode) {
        case CardRankingMode.ACE_LOW:
            // A=1, 2=2, ..., K=13
            return normalizedPoint;

        case CardRankingMode.ACE_HIGH:
            // 2=2, ..., K=13, A=14
            return normalizedPoint === 1 ? 14 : normalizedPoint;

        case CardRankingMode.TWO_HIGH:
            // 3=3, ..., A=14, 2=15
            if (normalizedPoint === 2) return 15;
            if (normalizedPoint === 1) return 14;
            return normalizedPoint;

        default:
            return normalizedPoint;
    }
}

/**
 * Sort cards by point value, then by suit
 * @param cards Array of card values (encoded as numbers)
 * @param mode Ranking mode (default: ACE_HIGH)
 * @param ascending Sort in ascending order (default: true)
 * @returns Sorted array of cards (does not modify original array)
 *
 * @example
 * // Sort with A high (A > K > Q > ... > 2)
 * const sorted = sortCards([0x11, 0x22, 0x01], CardRankingMode.ACE_HIGH);
 * // sorted = [0x22, 0x11, 0x01] (2♠, J♣, A♦)
 *
 * @example
 * // Sort with 2 high (2 > A > K > ... > 3)
 * const sorted = sortCards([0x11, 0x22, 0x01], CardRankingMode.TWO_HIGH);
 * // sorted = [0x11, 0x01, 0x22] (J♠, A♦, 2♣)
 */
export function sortCards(
    cards: number[],
    mode: CardRankingMode = CardRankingMode.ACE_HIGH,
    ascending: boolean = true
): number[] {
    const sorted = [...cards].sort((a, b) => {
        const pointA = a & 0x0F;
        const pointB = b & 0x0F;

        const rankA = getCardRank(pointA, mode);
        const rankB = getCardRank(pointB, mode);

        const diff = rankA - rankB;
        const pointDiff = ascending ? diff : -diff;

        // If same point, sort by suit
        if (pointDiff !== 0) {
            return pointDiff;
        }

        const suitA = (a & 0xF0) >> 4;
        const suitB = (b & 0xF0) >> 4;
        return suitA - suitB;
    });

    return sorted;
}

/**
 * Sort cards in place by point value, then by suit
 * @param cards Array of card values (encoded as numbers) - will be modified
 * @param mode Ranking mode (default: ACE_HIGH)
 * @param ascending Sort in ascending order (default: true)
 * @returns The same array (modified in place)
 */
export function sortCardsInPlace(
    cards: number[],
    mode: CardRankingMode = CardRankingMode.ACE_HIGH,
    ascending: boolean = true
): number[] {
    cards.sort((a, b) => {
        const pointA = a & 0x0F;
        const pointB = b & 0x0F;

        const rankA = getCardRank(pointA, mode);
        const rankB = getCardRank(pointB, mode);

        const diff = rankA - rankB;
        const pointDiff = ascending ? diff : -diff;

        // If same point, sort by suit
        if (pointDiff !== 0) {
            return pointDiff;
        }

        const suitA = (a & 0xF0) >> 4;
        const suitB = (b & 0xF0) >> 4;
        return suitA - suitB;
    });

    return cards;
}

/**
 * Decode card value to human-readable string
 * @param card Card value (encoded as number)
 * @returns Human-readable card string (e.g., "A♠", "K♥", "2♣")
 */
export function decodeCard(card: number): string {
    const suit = (card >> 4) & 0xF;
    const point = card & 0xF;

    const suitSymbols = ['♦', '♠', '♣', '♥'];
    const pointSymbols = ['?', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    const suitStr = suitSymbols[suit] || '?';
    const pointStr = pointSymbols[point] || '?';

    return `${pointStr}${suitStr}`;
}
