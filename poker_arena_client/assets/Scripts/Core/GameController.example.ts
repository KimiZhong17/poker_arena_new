/**
 * Example usage of GameController with Boss mechanics
 *
 * This demonstrates the complete game flow:
 * 1. Wait for players
 * 2. Deal cards
 * 3. Boss collects cards
 * 4. Start playing
 * 5. Scoring
 */

import { GameController } from './GameController';

// Example: Starting a new game
function exampleGameFlow() {
    const gameController = GameController.instance;

    // Step 1: Initialize game with custom config (optional)
    gameController.init({
        playerCount: 5,
        deckCount: 3,
        cardsPerPlayer: 31,
        levelRank: 2  // Start from 2
    });

    // Step 2: Create players
    const playerNames = ['Player1 (You)', 'Player2', 'Player3', 'Player4', 'Player5'];
    gameController.createPlayers(playerNames);

    // Step 3: Start game (deals cards and enters BOSS_COLLECT phase)
    gameController.startGame();

    // At this point:
    // - All players have 31 cards each
    // - 7 remaining cards are waiting
    // - Game is in BOSS_COLLECT phase

    console.log(`Boss is: ${gameController.bossPlayer.name} (index: ${gameController.bossPlayerIndex})`);
    console.log(`Remaining cards: ${gameController.remainingCards.length}`);

    // Step 4: Boss collects cards (can be triggered by UI button click)
    gameController.bossCollectCards();

    // After boss collects:
    // - Boss now has 36 cards (31 + 5)
    // - 2 cards are burned and shown to all players
    // - Game enters PLAYING phase
    // - Boss starts first

    console.log(`Boss has ${gameController.bossPlayer.handCards.length} cards`);
    console.log(`Burned cards: ${gameController.burnedCards.length}`);
    console.log(`Current player: ${gameController.currentPlayer.name}`);

    // Step 5: Play the game (existing logic continues)
    // Players can now call playCards() or pass()
}

// Example: Checking game phase
function checkGamePhase() {
    const gameController = GameController.instance;

    switch (gameController.gamePhase) {
        case 0: // WAITING
            console.log("Waiting for players to join");
            break;
        case 1: // DEALING
            console.log("Dealing cards...");
            break;
        case 2: // BOSS_COLLECT
            console.log("Boss is collecting cards");
            // Show UI button to trigger bossCollectCards()
            break;
        case 3: // PLAYING
            console.log("Game in progress");
            break;
        case 4: // SETTLING
            console.log("Calculating scores");
            break;
    }
}

// Example: Displaying burned cards in UI
function displayBurnedCards() {
    const gameController = GameController.instance;
    const burnedCards = gameController.burnedCards;

    console.log("Burned cards (visible to all players):");
    burnedCards.forEach(card => {
        // Convert card number to readable format
        console.log(`Card: ${card.toString(16)}`);
    });
}
