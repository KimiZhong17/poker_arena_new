import { CardSuit, CardPoint } from "../../Card/CardConst";

/**
 * Texas Hold'em hand types (sorted by strength)
 */
export enum TexasHandType {
    HIGH_CARD = 0,          // 高牌
    ONE_PAIR = 1,           // 一对
    TWO_PAIR = 2,           // 两对
    THREE_OF_A_KIND = 3,    // 三条
    STRAIGHT = 4,           // 顺子
    FLUSH = 5,              // 同花
    FULL_HOUSE = 6,         // 葫芦
    FOUR_OF_A_KIND = 7,     // 四条
    STRAIGHT_FLUSH = 8,     // 同花顺
    ROYAL_FLUSH = 9         // 皇家同花顺
}

/**
 * Texas Hold'em hand evaluation result
 */
export interface TexasHandResult {
    type: TexasHandType;
    cards: number[];        // The 5 cards that form the hand
    rankValues: number[];   // Rank values for comparison (descending)
    description: string;
}

/**
 * Texas Hold'em hand evaluator
 */
export class TexasHoldEmEvaluator {
    /**
     * Evaluate the best 5-card hand from given cards
     * @param cards Array of 5-7 cards
     */
    public static evaluate(cards: number[]): TexasHandResult {
        if (cards.length < 5) {
            throw new Error("Need at least 5 cards to evaluate");
        }

        if (cards.length === 5) {
            return this.evaluateFiveCards(cards);
        }

        // For 6 or 7 cards, try all combinations of 5 cards
        return this.findBestHand(cards);
    }

    /**
     * Compare two hands
     * @returns positive if hand1 > hand2, negative if hand1 < hand2, 0 if equal
     */
    public static compare(hand1: TexasHandResult, hand2: TexasHandResult): number {
        // First compare hand types
        if (hand1.type !== hand2.type) {
            return hand1.type - hand2.type;
        }

        // Same type, compare rank values
        for (let i = 0; i < hand1.rankValues.length; i++) {
            if (hand1.rankValues[i] !== hand2.rankValues[i]) {
                return hand1.rankValues[i] - hand2.rankValues[i];
            }
        }

        // Completely tied, compare suits
        return this.compareSuits(hand1.cards, hand2.cards);
    }

    /**
     * Compare suits when ranks are completely equal
     */
    private static compareSuits(cards1: number[], cards2: number[]): number {
        // Sort both hands by rank first, then by suit
        const sorted1 = this.sortByRankAndSuit(cards1);
        const sorted2 = this.sortByRankAndSuit(cards2);

        // Compare from highest to lowest
        for (let i = sorted1.length - 1; i >= 0; i--) {
            const suit1 = this.getSuit(sorted1[i]);
            const suit2 = this.getSuit(sorted2[i]);

            if (suit1 !== suit2) {
                return this.getSuitValue(suit1) - this.getSuitValue(suit2);
            }
        }

        return 0;
    }

    /**
     * Get suit value for comparison (♠ > ♥ > ♣ > ♦)
     */
    private static getSuitValue(suit: CardSuit): number {
        switch (suit) {
            case CardSuit.SPADE: return 4;
            case CardSuit.HEART: return 3;
            case CardSuit.CLUB: return 2;
            case CardSuit.DIAMOND: return 1;
            default: return 0;
        }
    }

    /**
     * Sort cards by rank (descending) then by suit (descending)
     */
    private static sortByRankAndSuit(cards: number[]): number[] {
        return [...cards].sort((a, b) => {
            const rankA = this.getTexasRank(this.getPoint(a));
            const rankB = this.getTexasRank(this.getPoint(b));

            if (rankA !== rankB) {
                return rankA - rankB;
            }

            return this.getSuitValue(this.getSuit(a)) - this.getSuitValue(this.getSuit(b));
        });
    }

    /**
     * Find the best 5-card hand from 6 or 7 cards
     */
    private static findBestHand(cards: number[]): TexasHandResult {
        const combinations = this.getCombinations(cards, 5);
        let bestHand: TexasHandResult | null = null;

        for (const combo of combinations) {
            const hand = this.evaluateFiveCards(combo);

            if (!bestHand || this.compare(hand, bestHand) > 0) {
                bestHand = hand;
            }
        }

        return bestHand!;
    }

    /**
     * Get all combinations of k cards from array
     */
    private static getCombinations(arr: number[], k: number): number[][] {
        if (k === 1) return arr.map(x => [x]);
        if (k === arr.length) return [arr];

        const result: number[][] = [];

        for (let i = 0; i <= arr.length - k; i++) {
            const first = arr[i];
            const rest = arr.slice(i + 1);
            const combos = this.getCombinations(rest, k - 1);

            for (const combo of combos) {
                result.push([first, ...combo]);
            }
        }

        return result;
    }

    /**
     * Evaluate exactly 5 cards
     */
    private static evaluateFiveCards(cards: number[]): TexasHandResult {
        const sorted = [...cards].sort((a, b) => {
            return this.getTexasRank(this.getPoint(b)) - this.getTexasRank(this.getPoint(a));
        });

        // Check for Royal Flush
        const royalFlush = this.checkRoyalFlush(sorted);
        if (royalFlush) return royalFlush;

        // Check for Straight Flush
        const straightFlush = this.checkStraightFlush(sorted);
        if (straightFlush) return straightFlush;

        // Check for Four of a Kind
        const fourKind = this.checkFourOfAKind(sorted);
        if (fourKind) return fourKind;

        // Check for Full House
        const fullHouse = this.checkFullHouse(sorted);
        if (fullHouse) return fullHouse;

        // Check for Flush
        const flush = this.checkFlush(sorted);
        if (flush) return flush;

        // Check for Straight
        const straight = this.checkStraight(sorted);
        if (straight) return straight;

        // Check for Three of a Kind
        const threeKind = this.checkThreeOfAKind(sorted);
        if (threeKind) return threeKind;

        // Check for Two Pair
        const twoPair = this.checkTwoPair(sorted);
        if (twoPair) return twoPair;

        // Check for One Pair
        const onePair = this.checkOnePair(sorted);
        if (onePair) return onePair;

        // High Card
        return this.checkHighCard(sorted);
    }

    // ========== Helper methods ==========

    private static getSuit(card: number): CardSuit {
        return (card & 0xF0) as CardSuit;
    }

    private static getPoint(card: number): CardPoint {
        return (card & 0x0F) as CardPoint;
    }

    /**
     * Get Texas Hold'em rank value (A=14, K=13, ..., 2=2)
     */
    private static getTexasRank(point: CardPoint): number {
        if (point === CardPoint.P_A) return 14;
        if (point === CardPoint.P_2) return 2;
        return point;
    }

    /**
     * Get rank counts
     */
    private static getRankCounts(cards: number[]): Map<number, number[]> {
        const counts = new Map<number, number[]>();

        for (const card of cards) {
            const rank = this.getTexasRank(this.getPoint(card));

            if (!counts.has(rank)) {
                counts.set(rank, []);
            }

            counts.get(rank)!.push(card);
        }

        return counts;
    }

    // ========== Hand type checkers ==========

    private static checkRoyalFlush(cards: number[]): TexasHandResult | null {
        const straight = this.checkStraightFlush(cards);

        if (straight && this.getTexasRank(this.getPoint(cards[0])) === 14) {
            return {
                type: TexasHandType.ROYAL_FLUSH,
                cards: straight.cards,
                rankValues: [14],
                description: "Royal Flush"
            };
        }

        return null;
    }

    private static checkStraightFlush(cards: number[]): TexasHandResult | null {
        const flush = this.checkFlush(cards);
        const straight = this.checkStraight(cards);

        if (flush && straight) {
            return {
                type: TexasHandType.STRAIGHT_FLUSH,
                cards,
                rankValues: straight.rankValues,
                description: "Straight Flush"
            };
        }

        return null;
    }

    private static checkFourOfAKind(cards: number[]): TexasHandResult | null {
        const counts = this.getRankCounts(cards);

        for (const [rank, rankCards] of counts) {
            if (rankCards.length === 4) {
                const kicker = cards.find(c => this.getTexasRank(this.getPoint(c)) !== rank)!;
                const kickerRank = this.getTexasRank(this.getPoint(kicker));

                return {
                    type: TexasHandType.FOUR_OF_A_KIND,
                    cards,
                    rankValues: [rank, kickerRank],
                    description: "Four of a Kind"
                };
            }
        }

        return null;
    }

    private static checkFullHouse(cards: number[]): TexasHandResult | null {
        const counts = this.getRankCounts(cards);
        let threeRank = -1;
        let pairRank = -1;

        for (const [rank, rankCards] of counts) {
            if (rankCards.length === 3) threeRank = rank;
            if (rankCards.length === 2) pairRank = rank;
        }

        if (threeRank !== -1 && pairRank !== -1) {
            return {
                type: TexasHandType.FULL_HOUSE,
                cards,
                rankValues: [threeRank, pairRank],
                description: "Full House"
            };
        }

        return null;
    }

    private static checkFlush(cards: number[]): TexasHandResult | null {
        const suit = this.getSuit(cards[0]);

        if (cards.every(c => this.getSuit(c) === suit)) {
            const ranks = cards.map(c => this.getTexasRank(this.getPoint(c)))
                .sort((a, b) => b - a);

            return {
                type: TexasHandType.FLUSH,
                cards,
                rankValues: ranks,
                description: "Flush"
            };
        }

        return null;
    }

    private static checkStraight(cards: number[]): TexasHandResult | null {
        const ranks = cards.map(c => this.getTexasRank(this.getPoint(c)))
            .sort((a, b) => b - a);

        // Check for regular straight
        let isStraight = true;
        for (let i = 1; i < ranks.length; i++) {
            if (ranks[i] !== ranks[i - 1] - 1) {
                isStraight = false;
                break;
            }
        }

        if (isStraight) {
            return {
                type: TexasHandType.STRAIGHT,
                cards,
                rankValues: [ranks[0]],
                description: "Straight"
            };
        }

        // Check for A-2-3-4-5 (wheel)
        if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 &&
            ranks[3] === 3 && ranks[4] === 2) {
            return {
                type: TexasHandType.STRAIGHT,
                cards,
                rankValues: [5], // In wheel, 5 is the high card
                description: "Straight (Wheel)"
            };
        }

        return null;
    }

    private static checkThreeOfAKind(cards: number[]): TexasHandResult | null {
        const counts = this.getRankCounts(cards);

        for (const [rank, rankCards] of counts) {
            if (rankCards.length === 3) {
                const kickers = cards
                    .filter(c => this.getTexasRank(this.getPoint(c)) !== rank)
                    .map(c => this.getTexasRank(this.getPoint(c)))
                    .sort((a, b) => b - a);

                return {
                    type: TexasHandType.THREE_OF_A_KIND,
                    cards,
                    rankValues: [rank, ...kickers],
                    description: "Three of a Kind"
                };
            }
        }

        return null;
    }

    private static checkTwoPair(cards: number[]): TexasHandResult | null {
        const counts = this.getRankCounts(cards);
        const pairs: number[] = [];

        for (const [rank, rankCards] of counts) {
            if (rankCards.length === 2) {
                pairs.push(rank);
            }
        }

        if (pairs.length === 2) {
            pairs.sort((a, b) => b - a);
            const kicker = cards
                .find(c => {
                    const r = this.getTexasRank(this.getPoint(c));
                    return r !== pairs[0] && r !== pairs[1];
                })!;
            const kickerRank = this.getTexasRank(this.getPoint(kicker));

            return {
                type: TexasHandType.TWO_PAIR,
                cards,
                rankValues: [pairs[0], pairs[1], kickerRank],
                description: "Two Pair"
            };
        }

        return null;
    }

    private static checkOnePair(cards: number[]): TexasHandResult | null {
        const counts = this.getRankCounts(cards);

        for (const [rank, rankCards] of counts) {
            if (rankCards.length === 2) {
                const kickers = cards
                    .filter(c => this.getTexasRank(this.getPoint(c)) !== rank)
                    .map(c => this.getTexasRank(this.getPoint(c)))
                    .sort((a, b) => b - a);

                return {
                    type: TexasHandType.ONE_PAIR,
                    cards,
                    rankValues: [rank, ...kickers],
                    description: "One Pair"
                };
            }
        }

        return null;
    }

    private static checkHighCard(cards: number[]): TexasHandResult {
        const ranks = cards.map(c => this.getTexasRank(this.getPoint(c)))
            .sort((a, b) => b - a);

        return {
            type: TexasHandType.HIGH_CARD,
            cards,
            rankValues: ranks,
            description: "High Card"
        };
    }
}
