import { HandEvaluator, HandType } from "./HandEvaluator";
import { CardSuit, CardPoint } from "./CardConst";

/**
 * Test file for HandEvaluator bomb rules
 *
 * This is a standalone test file that can be run directly without a test framework.
 * To use with Jest/Vitest, uncomment the describe/test blocks and comment out the manual execution.
 *
 * Test cases:
 * 1. Four-card normal bomb
 * 2. Five-card normal bomb
 * 3. Six-card normal bomb
 * 4. Normal bomb with wild cards
 * 5. Two-joker bomb (with RED_JOKER)
 * 6. Three-joker bomb (with RED_JOKER)
 * 7. Bomb comparison: n Joker > 2n normal
 */

// Helper to create cards
const makeCard = (suit: CardSuit, point: CardPoint): number => {
    return suit | point;
};

const levelRank = CardPoint.P_3; // Example: playing 3s

// Manual test execution (comment out if using a test framework)
export function runTests() {
    console.log("=== HandEvaluator Bomb Tests ===\n");

    testFourCardBomb();
    testFiveCardBomb();
    testSixCardBomb();
    testTwoJokerBomb();
    testTwoRedJokerBomb();
    testInvalidTwoBlackJokers();
    testBombComparison1();
    testBombComparison2();
    testBombComparison3();
    testInvalidMixedSuits();
    testInvalidLessThan4Cards();

    console.log("\n=== All Tests Completed ===");
}

function testFourCardBomb() {
    console.log("Test: Four-card normal bomb (4 Aces)");
    const cards = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_A),
        makeCard(CardSuit.CLUB, CardPoint.P_A),
        makeCard(CardSuit.HEART, CardPoint.P_A),
        makeCard(CardSuit.SPADE, CardPoint.P_A)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: BOMB, Cards: ${result.mainCards.length}`);
    console.log(`  ✓ Pass: ${result.type === HandType.BOMB && result.mainCards.length === 4}\n`);
}

function testFiveCardBomb() {
    console.log("Test: Five-card normal bomb (5 Kings with wild card)");
    const cards = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_K),
        makeCard(CardSuit.CLUB, CardPoint.P_K),
        makeCard(CardSuit.SPADE, CardPoint.P_K),
        makeCard(CardSuit.DIAMOND, levelRank),
        makeCard(CardSuit.CLUB, levelRank)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: BOMB, Cards: ${result.mainCards.length}`);
    console.log(`  ✓ Pass: ${result.type === HandType.BOMB && result.mainCards.length === 5}\n`);
}

function testSixCardBomb() {
    console.log("Test: Six-card normal bomb (6 Queens with wild cards)");
    const cards = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_Q),
        makeCard(CardSuit.CLUB, CardPoint.P_Q),
        makeCard(CardSuit.SPADE, CardPoint.P_Q),
        makeCard(CardSuit.DIAMOND, levelRank),
        makeCard(CardSuit.CLUB, levelRank),
        makeCard(CardSuit.HEART, levelRank)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: BOMB, Cards: ${result.mainCards.length}`);
    console.log(`  ✓ Pass: ${result.type === HandType.BOMB && result.mainCards.length === 6}\n`);
}

function testTwoJokerBomb() {
    console.log("Test: Two-joker bomb (1 RED + 1 BLACK)");
    const cards = [
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: JOKER_BOMB, Cards: ${result.mainCards.length}`);
    console.log(`  ✓ Pass: ${result.type === HandType.JOKER_BOMB && result.mainCards.length === 2}\n`);
}

function testTwoRedJokerBomb() {
    console.log("Test: Two-joker bomb (2 RED) - multi-deck scenario");
    const cards = [
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: JOKER_BOMB, Cards: ${result.mainCards.length}`);
    console.log(`  ✓ Pass: ${result.type === HandType.JOKER_BOMB && result.mainCards.length === 2}\n`);
}

function testInvalidTwoBlackJokers() {
    console.log("Test: Invalid - Two black jokers (no RED_JOKER)");
    const cards = [
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}, Weight: ${result.weight}`);
    console.log(`  Expected: NOT JOKER_BOMB`);
    console.log(`  ✓ Pass: ${result.type !== HandType.JOKER_BOMB}\n`);
}

function testBombComparison1() {
    console.log("Test: Bomb comparison - 2 Jokers > 4-card normal bomb");
    const jokerBomb = [
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
    ];

    const normalBomb = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_A),
        makeCard(CardSuit.CLUB, CardPoint.P_A),
        makeCard(CardSuit.HEART, CardPoint.P_A),
        makeCard(CardSuit.SPADE, CardPoint.P_A)
    ];

    const jokerResult = HandEvaluator.evaluate(jokerBomb, levelRank);
    const normalResult = HandEvaluator.evaluate(normalBomb, levelRank);

    console.log(`  2 Joker weight: ${jokerResult.weight}`);
    console.log(`  4-card normal bomb weight: ${normalResult.weight}`);
    console.log(`  ✓ Pass: ${HandEvaluator.canBeat(jokerResult, normalResult)}\n`);
}

function testBombComparison2() {
    console.log("Test: Bomb comparison - 5-card normal bomb > 2 Jokers");
    const jokerBomb = [
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
    ];

    const fiveCardBomb = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_K),
        makeCard(CardSuit.CLUB, CardPoint.P_K),
        makeCard(CardSuit.SPADE, CardPoint.P_K),
        makeCard(CardSuit.DIAMOND, levelRank),
        makeCard(CardSuit.CLUB, levelRank)
    ];

    const jokerResult = HandEvaluator.evaluate(jokerBomb, levelRank);
    const fiveResult = HandEvaluator.evaluate(fiveCardBomb, levelRank);

    console.log(`  2 Joker weight: ${jokerResult.weight}`);
    console.log(`  5-card normal bomb weight: ${fiveResult.weight}`);
    console.log(`  ✓ Pass: ${HandEvaluator.canBeat(fiveResult, jokerResult)}\n`);
}

function testBombComparison3() {
    console.log("Test: Bomb comparison - 3 Jokers > 6-card normal bomb");
    const threeJokerBomb = [
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
        makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER)
    ];

    const sixCardBomb = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_Q),
        makeCard(CardSuit.CLUB, CardPoint.P_Q),
        makeCard(CardSuit.SPADE, CardPoint.P_Q),
        makeCard(CardSuit.DIAMOND, levelRank),
        makeCard(CardSuit.CLUB, levelRank),
        makeCard(CardSuit.SPADE, levelRank)
    ];

    const jokerResult = HandEvaluator.evaluate(threeJokerBomb, levelRank);
    const sixResult = HandEvaluator.evaluate(sixCardBomb, levelRank);

    console.log(`  3 Joker weight: ${jokerResult.weight}`);
    console.log(`  6-card normal bomb weight: ${sixResult.weight}`);
    console.log(`  ✓ Pass: ${HandEvaluator.canBeat(jokerResult, sixResult)}\n`);
}

function testInvalidMixedSuits() {
    console.log("Test: Invalid bomb - mixed suits without being same point");
    const cards = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_A),
        makeCard(CardSuit.CLUB, CardPoint.P_K),
        makeCard(CardSuit.HEART, CardPoint.P_Q),
        makeCard(CardSuit.SPADE, CardPoint.P_J)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}`);
    console.log(`  Expected: NOT BOMB`);
    console.log(`  ✓ Pass: ${result.type !== HandType.BOMB}\n`);
}

function testInvalidLessThan4Cards() {
    console.log("Test: Invalid bomb - less than 4 cards");
    const cards = [
        makeCard(CardSuit.DIAMOND, CardPoint.P_A),
        makeCard(CardSuit.CLUB, CardPoint.P_A),
        makeCard(CardSuit.HEART, CardPoint.P_A)
    ];

    const result = HandEvaluator.evaluate(cards, levelRank);
    console.log(`  Type: ${HandType[result.type]}`);
    console.log(`  Expected: TRIPLE (not BOMB)`);
    console.log(`  ✓ Pass: ${result.type === HandType.TRIPLE && result.type !== HandType.BOMB}\n`);
}

// Uncomment below for Jest/Vitest compatibility
/*
describe("HandEvaluator Bomb Tests", () => {
    const levelRank = CardPoint.P_3; // Example: playing 3s

    // Helper to create cards
    const makeCard = (suit: CardSuit, point: CardPoint): number => {
        return suit | point;
    };

    test("Four-card normal bomb (4 Aces)", () => {
        const cards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_A),
            makeCard(CardSuit.CLUB, CardPoint.P_A),
            makeCard(CardSuit.HEART, CardPoint.P_A),
            makeCard(CardSuit.SPADE, CardPoint.P_A)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).toBe(HandType.BOMB);
        expect(result.mainCards.length).toBe(4);
        console.log("4-card bomb weight:", result.weight);
    });

    test("Five-card normal bomb (5 Kings)", () => {
        const cards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_K),
            makeCard(CardSuit.CLUB, CardPoint.P_K),
            makeCard(CardSuit.HEART, CardPoint.P_K),
            makeCard(CardSuit.SPADE, CardPoint.P_K),
            makeCard(CardSuit.HEART, levelRank) // Wild card (Heart 3)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).toBe(HandType.BOMB);
        expect(result.mainCards.length).toBe(5);
        console.log("5-card bomb weight:", result.weight);
    });

    test("Six-card normal bomb (6 Queens)", () => {
        const cards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_Q),
            makeCard(CardSuit.CLUB, CardPoint.P_Q),
            makeCard(CardSuit.HEART, CardPoint.P_Q),
            makeCard(CardSuit.SPADE, CardPoint.P_Q),
            makeCard(CardSuit.HEART, levelRank), // Wild card
            makeCard(CardSuit.HEART, levelRank)  // Another wild card (this would be invalid in real game)
        ];

        // Note: In a real game, you can't have two Heart-3s, but for testing purposes
        // we'll use different suits for level cards
        const validCards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_Q),
            makeCard(CardSuit.CLUB, CardPoint.P_Q),
            makeCard(CardSuit.SPADE, CardPoint.P_Q),
            makeCard(CardSuit.DIAMOND, levelRank), // Diamond 3
            makeCard(CardSuit.CLUB, levelRank),    // Club 3
            makeCard(CardSuit.HEART, levelRank)    // Heart 3 (wild card)
        ];

        const result = HandEvaluator.evaluate(validCards, levelRank);
        expect(result.type).toBe(HandType.BOMB);
        expect(result.mainCards.length).toBe(6);
        console.log("6-card bomb weight:", result.weight);
    });

    test("Two-joker bomb (1 RED + 1 BLACK)", () => {
        const cards = [
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).toBe(HandType.JOKER_BOMB);
        expect(result.mainCards.length).toBe(2);
        console.log("2-joker bomb weight:", result.weight);
    });

    test("Two-joker bomb (2 RED) - if multiple decks", () => {
        // This would only be valid in multi-deck games
        const cards = [
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).toBe(HandType.JOKER_BOMB);
        expect(result.mainCards.length).toBe(2);
        console.log("2 RED joker bomb weight:", result.weight);
    });

    test("Invalid: Two black jokers (no RED_JOKER)", () => {
        const cards = [
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).not.toBe(HandType.JOKER_BOMB);
        console.log("2 BLACK joker result:", result.type);
    });

    test("Bomb comparison: 2 Jokers > 4-card normal bomb", () => {
        const jokerBomb = [
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
        ];

        const normalBomb = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_A),
            makeCard(CardSuit.CLUB, CardPoint.P_A),
            makeCard(CardSuit.HEART, CardPoint.P_A),
            makeCard(CardSuit.SPADE, CardPoint.P_A)
        ];

        const jokerResult = HandEvaluator.evaluate(jokerBomb, levelRank);
        const normalResult = HandEvaluator.evaluate(normalBomb, levelRank);

        console.log("2 Joker bomb weight:", jokerResult.weight);
        console.log("4-card normal bomb weight:", normalResult.weight);

        expect(HandEvaluator.canBeat(jokerResult, normalResult)).toBe(true);
    });

    test("Bomb comparison: 5-card normal bomb > 2 Jokers", () => {
        const jokerBomb = [
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER)
        ];

        const fiveCardBomb = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_K),
            makeCard(CardSuit.CLUB, CardPoint.P_K),
            makeCard(CardSuit.SPADE, CardPoint.P_K),
            makeCard(CardSuit.DIAMOND, levelRank), // Wild card
            makeCard(CardSuit.CLUB, levelRank)     // Wild card
        ];

        const jokerResult = HandEvaluator.evaluate(jokerBomb, levelRank);
        const fiveResult = HandEvaluator.evaluate(fiveCardBomb, levelRank);

        console.log("2 Joker bomb weight:", jokerResult.weight);
        console.log("5-card normal bomb weight:", fiveResult.weight);

        expect(HandEvaluator.canBeat(fiveResult, jokerResult)).toBe(true);
    });

    test("Bomb comparison: 3 Jokers > 6-card normal bomb", () => {
        // Note: 3 jokers would require multiple decks
        const threeJokerBomb = [
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.RED_JOKER),
            makeCard(CardSuit.JOKER, CardPoint.BLACK_JOKER)
        ];

        const sixCardBomb = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_Q),
            makeCard(CardSuit.CLUB, CardPoint.P_Q),
            makeCard(CardSuit.SPADE, CardPoint.P_Q),
            makeCard(CardSuit.DIAMOND, levelRank),
            makeCard(CardSuit.CLUB, levelRank),
            makeCard(CardSuit.SPADE, levelRank)
        ];

        const jokerResult = HandEvaluator.evaluate(threeJokerBomb, levelRank);
        const sixResult = HandEvaluator.evaluate(sixCardBomb, levelRank);

        console.log("3 Joker bomb weight:", jokerResult.weight);
        console.log("6-card normal bomb weight:", sixResult.weight);

        expect(HandEvaluator.canBeat(jokerResult, sixResult)).toBe(true);
    });

    test("Invalid bomb: mixed suits without being same point", () => {
        const cards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_A),
            makeCard(CardSuit.CLUB, CardPoint.P_K),
            makeCard(CardSuit.HEART, CardPoint.P_Q),
            makeCard(CardSuit.SPADE, CardPoint.P_J)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).not.toBe(HandType.BOMB);
    });

    test("Invalid bomb: less than 4 cards", () => {
        const cards = [
            makeCard(CardSuit.DIAMOND, CardPoint.P_A),
            makeCard(CardSuit.CLUB, CardPoint.P_A),
            makeCard(CardSuit.HEART, CardPoint.P_A)
        ];

        const result = HandEvaluator.evaluate(cards, levelRank);
        expect(result.type).toBe(HandType.TRIPLE);
        expect(result.type).not.toBe(HandType.BOMB);
    });
});
*/
