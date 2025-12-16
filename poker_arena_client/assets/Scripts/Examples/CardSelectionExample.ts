import { _decorator, Component } from 'cc';
import { GameHandsManager } from '../UI/GameHandsManager';
import { Game } from '../Game';
const { ccclass, property } = _decorator;

/**
 * Example: How to use card selection in your game
 *
 * This example demonstrates:
 * 1. Enabling card click/touch interaction
 * 2. Handling card selection events
 * 3. Playing selected cards
 */
@ccclass('CardSelectionExample')
export class CardSelectionExample extends Component {

    private _game: Game = null!;
    private _handsManager: GameHandsManager = null!;

    start() {
        // Get game instance
        this._game = this.node.getComponent(Game) || this.node.parent?.getComponent(Game);

        if (!this._game) {
            console.error('Game component not found');
            return;
        }

        // Example: Enable card selection after game starts
        this.scheduleOnce(() => {
            this.enablePlayerCardSelection();
        }, 3);
    }

    /**
     * Enable card selection for the main player (player 0)
     */
    private enablePlayerCardSelection(): void {
        // Get hands manager from game
        // You need to expose handsManager in Game.ts or get it via another way
        // For now, assume we have access

        console.log('=== Card Selection Example ===');
        console.log('Click/touch cards to select them!');
        console.log('Selected cards will be lifted up');

        // Enable card selection for player 0 (main player)
        // Pass a callback to handle selection changes
        this._handsManager.enableCardSelection(0, (selectedIndices: number[]) => {
            console.log(`Selected cards changed: [${selectedIndices.join(', ')}]`);

            // You can do something with the selection here
            // For example, enable/disable a "Play" button
            if (selectedIndices.length > 0) {
                console.log(`You have selected ${selectedIndices.length} card(s)`);
            }
        });
    }

    /**
     * Example: Play selected cards (call this from a UI button)
     */
    public playSelectedCards(): void {
        const selectedIndices = this._handsManager.getSelectedIndices(0);

        if (selectedIndices.length === 0) {
            console.log('No cards selected!');
            return;
        }

        console.log(`Playing cards at indices: [${selectedIndices.join(', ')}]`);

        // Use the universal interface to play cards
        const success = this._game.playerSelectCards('0', selectedIndices);

        if (success) {
            console.log('Cards played successfully!');
            // Clear selection after playing
            this._handsManager.clearSelection(0);
        } else {
            console.error('Failed to play cards');
        }
    }

    /**
     * Example: Pass turn (call this from a UI button)
     */
    public passTurn(): void {
        const success = this._game.playerPass('0');

        if (success) {
            console.log('Passed successfully!');
            // Clear selection when passing
            this._handsManager.clearSelection(0);
        } else {
            console.error('Failed to pass');
        }
    }

    /**
     * Example: Disable card selection
     */
    public disableCardSelection(): void {
        this._handsManager.disableCardSelection(0);
        console.log('Card selection disabled');
    }
}
