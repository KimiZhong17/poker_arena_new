import { CardUtils } from "./CardUtils";
import { CardSuit, CardPoint } from "./CardConst";

/**
 * Hand type enumeration
 */
export enum HandType {
    INVALID = 0,        // Invalid hand
    SINGLE = 1,         // Single card
    PAIR = 2,           // Pair
    TRIPLE = 3,         // Three of a kind
    // TRIPLE_WITH_SINGLE = 4,  // Three + Single
    TRIPLE_WITH_PAIR = 5,    // Three + Pair
    STRAIGHT = 6,       // Straight (5+ consecutive cards)
    STRAIGHT_PAIR = 7,  // Consecutive pairs (3+ pairs)
    AIRPLANE = 8,       // Airplane (consecutive triples)
    // AIRPLANE_WITH_SINGLES = 9,  // Airplane + singles
    AIRPLANE_WITH_PAIRS = 10,   // Airplane + pairs
    // QUAD_WITH_TWO = 11,     // Four of a kind + 2 cards
    BOMB = 12,          // Bomb (4+ of a kind, can include wild cards)
    // STRAIGHT_BOMB = 13, // Straight flush (5+ consecutive same suit)
    JOKER_BOMB = 14     // Joker bomb (2+ jokers, must have at least 1 RED_JOKER)
}

/**
 * Hand evaluation result
 */
export interface HandResult {
    type: HandType;
    mainCards: number[];    // Main cards (e.g., the triple in three+single)
    kickerCards: number[];  // Kicker cards (e.g., the single in three+single)
    weight: number;         // Hand strength for comparison
}

/**
 * Hand evaluator - detects and compares poker hand types
 */
export class HandEvaluator {

    /**
     * Evaluate a hand and return its type and strength
     * @param cards Array of cards
     * @param levelRank Current level rank for weight calculation
     */
    public static evaluate(cards: number[], levelRank: number): HandResult {
        if (!cards || cards.length === 0) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // Sort cards by point value
        const sorted = [...cards].sort((a, b) => {
            return CardUtils.getPoint(a) - CardUtils.getPoint(b);
        });

        // Try to match hand types from most specific to least specific
        const len = sorted.length;

        // First check for bombs (any length >= 4)
        if (len >= 4) {
            const bombResult = this.evaluateBomb(sorted, levelRank);
            if (bombResult.type !== HandType.INVALID) return bombResult;
        }

        // Check for Joker bombs (any length >= 2, all jokers, at least 1 red)
        if (len >= 2) {
            const jokerBomb = this.evaluateJokerBomb(sorted, levelRank);
            if (jokerBomb.type !== HandType.INVALID) return jokerBomb;
        }

        // Single card
        if (len === 1) {
            return this.evaluateSingle(sorted, levelRank);
        }

        // Pair
        if (len === 2) {
            const pairResult = this.evaluatePair(sorted, levelRank);
            if (pairResult.type !== HandType.INVALID) return pairResult;
        }

        // Triple
        if (len === 3) {
            const tripleResult = this.evaluateTriple(sorted, levelRank);
            if (tripleResult.type !== HandType.INVALID) return tripleResult;
        }

        // Triple + single/pair
        if (len === 4 || len === 5) {
            const tripleCombo = this.evaluateTripleCombo(sorted, levelRank);
            if (tripleCombo.type !== HandType.INVALID) return tripleCombo;
        }

        // Four + two (bomb with kickers) - note: this is currently disabled
        if (len === 6) {
            const quadWithTwo = this.evaluateQuadWithTwo(sorted, levelRank);
            if (quadWithTwo.type !== HandType.INVALID) return quadWithTwo;
        }

        // Straight (5+ cards)
        if (len >= 5) {
            const straightResult = this.evaluateStraight(sorted, levelRank);
            if (straightResult.type !== HandType.INVALID) return straightResult;
        }

        // Consecutive pairs (3+ pairs)
        if (len >= 6 && len % 2 === 0) {
            const straightPairResult = this.evaluateStraightPair(sorted, levelRank);
            if (straightPairResult.type !== HandType.INVALID) return straightPairResult;
        }

        // Airplane and airplane combos
        if (len >= 6) {
            const airplaneResult = this.evaluateAirplane(sorted, levelRank);
            if (airplaneResult.type !== HandType.INVALID) return airplaneResult;
        }

        return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
    }

    /**
     * Compare two hands
     * @returns positive if hand1 > hand2, negative if hand1 < hand2, 0 if equal
     */
    public static compare(hand1: HandResult, hand2: HandResult): number {
        // Bombs beat everything except higher bombs
        if (hand1.type >= HandType.BOMB && hand2.type < HandType.BOMB) return 1;
        if (hand2.type >= HandType.BOMB && hand1.type < HandType.BOMB) return -1;

        // Different types (non-bomb) cannot be compared
        if (hand1.type !== hand2.type) return 0;

        // Same type, compare weight
        return hand1.weight - hand2.weight;
    }

    /**
     * Check if hand1 can beat hand2
     */
    public static canBeat(hand1: HandResult, hand2: HandResult): boolean {
        return this.compare(hand1, hand2) > 0;
    }

    // ========== Individual hand type evaluators ==========

    private static evaluateSingle(cards: number[], levelRank: number): HandResult {
        const weight = CardUtils.getLogicWeight(cards[0], levelRank);
        return {
            type: HandType.SINGLE,
            mainCards: cards,
            kickerCards: [],
            weight
        };
    }

    private static evaluatePair(cards: number[], levelRank: number): HandResult {
        if (CardUtils.getPoint(cards[0]) !== CardUtils.getPoint(cards[1])) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        const weight = CardUtils.getLogicWeight(cards[0], levelRank);
        return {
            type: HandType.PAIR,
            mainCards: cards,
            kickerCards: [],
            weight
        };
    }

    private static evaluateJokerBomb(cards: number[], levelRank: number): HandResult {
        if (cards.length < 2) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        let redJokerCount = 0;
        let blackJokerCount = 0;

        // Check all cards are jokers and count them
        for (const card of cards) {
            const suit = CardUtils.getSuit(card);
            const point = CardUtils.getPoint(card);

            if (suit !== CardSuit.JOKER) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }

            if (point === CardPoint.RED_JOKER) {
                redJokerCount++;
            } else if (point === CardPoint.BLACK_JOKER) {
                blackJokerCount++;
            } else {
                // Unknown joker type
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }
        }

        // Must have at least one RED_JOKER
        if (redJokerCount === 0) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        const totalJokers = redJokerCount + blackJokerCount;

        // Calculate Joker bomb weight
        // Rule: n Joker bomb sits between 2n and (2n+1) normal bombs in strength
        // Normal bomb weight: 5000 + (count * 1000) + mainPointWeight
        // mainPointWeight range: 30 (3s) to 150 (2s) for normal cards
        //                        700 (level cards) to 1000 (Black Joker level) for special cases
        //
        // For 2n normal bomb worst case (3s): 5000 + 2n*1000 + 30 = 5030 + 2000n
        // For 2n normal bomb best case (2s): 5000 + 2n*1000 + 150 = 5150 + 2000n
        // For (2n+1) normal bomb best case (2s): 5000 + (2n+1)*1000 + 150 = 6150 + 2000n
        //
        // We need: (2n best case) < n Joker < (2n+1 best case)
        //          5150 + 2000n < n Joker < 6150 + 2000n
        // Choose middle value: 5650 + 2000n (giving 500 margin on each side)
        const jokerBombWeight = 5650 + (2000 * totalJokers);

        return {
            type: HandType.JOKER_BOMB,
            mainCards: cards,
            kickerCards: [],
            weight: jokerBombWeight
        };
    }

    private static evaluateTriple(cards: number[], levelRank: number): HandResult {
        const p1 = CardUtils.getPoint(cards[0]);
        const p2 = CardUtils.getPoint(cards[1]);
        const p3 = CardUtils.getPoint(cards[2]);

        if (p1 === p2 && p2 === p3) {
            const weight = CardUtils.getLogicWeight(cards[0], levelRank);
            return {
                type: HandType.TRIPLE,
                mainCards: cards,
                kickerCards: [],
                weight
            };
        }

        return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
    }

    private static evaluateBomb(cards: number[], levelRank: number): HandResult {
        if (cards.length < 4) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // Count cards by point value
        const pointCount = new Map<number, number>();
        let wildCardCount = 0;
        let mainPoint = -1;

        for (const card of cards) {
            const point = CardUtils.getPoint(card);
            const suit = CardUtils.getSuit(card);

            // Skip jokers - they don't form normal bombs
            if (suit === CardSuit.JOKER) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }

            // Count wild cards separately
            if (CardUtils.isWildCard(card, levelRank)) {
                wildCardCount++;
            } else {
                pointCount.set(point, (pointCount.get(point) || 0) + 1);
                if (pointCount.get(point)! > (pointCount.get(mainPoint) || 0)) {
                    mainPoint = point;
                }
            }
        }

        // If all cards are wild cards, invalid (needs at least one normal card)
        if (pointCount.size === 0) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // If multiple different point values (excluding wild cards), invalid
        if (pointCount.size > 1) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // Total cards should equal the main point count + wild cards
        const totalCount = (pointCount.get(mainPoint) || 0) + wildCardCount;
        if (totalCount !== cards.length || totalCount < 4) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // Calculate bomb weight based on number of cards
        // Rule: Card count is MORE important than point value
        // Weight formula: 5000 + (count * 1000) + mainPointWeight
        // This ensures that n+1 card bomb always beats n card bomb regardless of points
        const mainCard = cards.find(c => CardUtils.getPoint(c) === mainPoint)!;
        const mainPointWeight = CardUtils.getLogicWeight(mainCard, levelRank);
        const bombWeight = 5000 + (cards.length * 1000) + mainPointWeight;

        return {
            type: HandType.BOMB,
            mainCards: cards,
            kickerCards: [],
            weight: bombWeight
        };
    }

    private static evaluateTripleCombo(cards: number[], levelRank: number): HandResult {
        // Try to find a triple
        const pointCount = new Map<number, number[]>();
        cards.forEach(card => {
            const point = CardUtils.getPoint(card);
            if (!pointCount.has(point)) {
                pointCount.set(point, []);
            }
            pointCount.get(point)!.push(card);
        });

        let triple: number[] = [];
        let kickers: number[] = [];

        for (const [point, group] of pointCount.entries()) {
            if (group.length === 3) {
                triple = group;
            } else {
                kickers.push(...group);
            }
        }

        if (triple.length !== 3) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        const weight = CardUtils.getLogicWeight(triple[0], levelRank);

        // Three + single
        if (cards.length === 4 && kickers.length === 1) {
            return {
                type: HandType.TRIPLE_WITH_SINGLE,
                mainCards: triple,
                kickerCards: kickers,
                weight
            };
        }

        // Three + pair
        if (cards.length === 5 && kickers.length === 2) {
            const k1 = CardUtils.getPoint(kickers[0]);
            const k2 = CardUtils.getPoint(kickers[1]);
            if (k1 === k2) {
                return {
                    type: HandType.TRIPLE_WITH_PAIR,
                    mainCards: triple,
                    kickerCards: kickers,
                    weight
                };
            }
        }

        return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
    }

    private static evaluateQuadWithTwo(cards: number[], levelRank: number): HandResult {
        const pointCount = new Map<number, number[]>();
        cards.forEach(card => {
            const point = CardUtils.getPoint(card);
            if (!pointCount.has(point)) {
                pointCount.set(point, []);
            }
            pointCount.get(point)!.push(card);
        });

        let quad: number[] = [];
        let kickers: number[] = [];

        for (const [point, group] of pointCount.entries()) {
            if (group.length === 4) {
                quad = group;
            } else {
                kickers.push(...group);
            }
        }

        if (quad.length === 4 && kickers.length === 2) {
            const weight = CardUtils.getLogicWeight(quad[0], levelRank);
            return {
                type: HandType.QUAD_WITH_TWO,
                mainCards: quad,
                kickerCards: kickers,
                weight: weight + 5000
            };
        }

        return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
    }

    private static evaluateStraight(cards: number[], levelRank: number): HandResult {
        if (cards.length < 5) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        const points = cards.map(c => CardUtils.getPoint(c));

        // Check if consecutive
        for (let i = 1; i < points.length; i++) {
            if (points[i] !== points[i - 1] + 1) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }
        }

        const weight = CardUtils.getLogicWeight(cards[cards.length - 1], levelRank);
        return {
            type: HandType.STRAIGHT,
            mainCards: cards,
            kickerCards: [],
            weight
        };
    }

    private static evaluateStraightPair(cards: number[], levelRank: number): HandResult {
        if (cards.length < 6 || cards.length % 2 !== 0) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        const pairs: number[] = [];
        for (let i = 0; i < cards.length; i += 2) {
            const p1 = CardUtils.getPoint(cards[i]);
            const p2 = CardUtils.getPoint(cards[i + 1]);
            if (p1 !== p2) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }
            pairs.push(p1);
        }

        // Check if consecutive
        for (let i = 1; i < pairs.length; i++) {
            if (pairs[i] !== pairs[i - 1] + 1) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }
        }

        const weight = CardUtils.getLogicWeight(cards[cards.length - 1], levelRank);
        return {
            type: HandType.STRAIGHT_PAIR,
            mainCards: cards,
            kickerCards: [],
            weight
        };
    }

    private static evaluateAirplane(cards: number[], levelRank: number): HandResult {
        // Group by point
        const pointCount = new Map<number, number[]>();
        cards.forEach(card => {
            const point = CardUtils.getPoint(card);
            if (!pointCount.has(point)) {
                pointCount.set(point, []);
            }
            pointCount.get(point)!.push(card);
        });

        // Find all triples
        const triples: number[][] = [];
        const kickers: number[] = [];

        for (const [point, group] of pointCount.entries()) {
            if (group.length === 3) {
                triples.push(group);
            } else {
                kickers.push(...group);
            }
        }

        if (triples.length < 2) {
            return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
        }

        // Check if triples are consecutive
        const triplePoints = triples.map(t => CardUtils.getPoint(t[0])).sort((a, b) => a - b);
        for (let i = 1; i < triplePoints.length; i++) {
            if (triplePoints[i] !== triplePoints[i - 1] + 1) {
                return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
            }
        }

        const mainCards = triples.flat();
        const weight = CardUtils.getLogicWeight(mainCards[mainCards.length - 1], levelRank);

        // Pure airplane
        if (kickers.length === 0) {
            return {
                type: HandType.AIRPLANE,
                mainCards,
                kickerCards: [],
                weight
            };
        }

        // Airplane + singles
        if (kickers.length === triples.length) {
            return {
                type: HandType.AIRPLANE_WITH_SINGLES,
                mainCards,
                kickerCards: kickers,
                weight
            };
        }

        // Airplane + pairs
        if (kickers.length === triples.length * 2) {
            // Check if kickers form pairs
            const kickerPoints = kickers.map(c => CardUtils.getPoint(c)).sort((a, b) => a - b);
            let validPairs = true;
            for (let i = 0; i < kickerPoints.length; i += 2) {
                if (kickerPoints[i] !== kickerPoints[i + 1]) {
                    validPairs = false;
                    break;
                }
            }

            if (validPairs) {
                return {
                    type: HandType.AIRPLANE_WITH_PAIRS,
                    mainCards,
                    kickerCards: kickers,
                    weight
                };
            }
        }

        return { type: HandType.INVALID, mainCards: [], kickerCards: [], weight: 0 };
    }
}
