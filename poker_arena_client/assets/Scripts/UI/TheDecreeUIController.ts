import { _decorator, Component, Node, Button } from 'cc';
import { Game } from '../Game';
const { ccclass, property } = _decorator;

/**
 * The Decree UI Controller
 * Manages all UI interactions for The Decree game mode
 *
 * Usage:
 * 1. Attach this component to ObjectTheDecreeNode
 * 2. UI buttons will be automatically found by name, or you can manually assign them in the editor
 */
@ccclass('TheDecreeUIController')
export class TheDecreeUIController extends Component {

    // Option 1: Manually assign in editor (recommended for important buttons)
    @property(Button)
    public playButton: Button | null = null;

    @property(Button)
    public callOneButton: Button | null = null;

    @property(Button)
    public callTwoButton: Button | null = null;

    @property(Button)
    public callThreeButton: Button | null = null;

    // Temporarily unused - uncomment when needed
    // @property(Button)
    // public clearSelectionButton: Button | null = null;

    // @property(Label)
    // public statusLabel: Label | null = null;

    // Private
    private _game: Game = null!;
    private _selectedCardIndices: number[] = [];

    onLoad() {
        // Find Game component
        this._game = this.findGameComponent();

        if (!this._game) {
            console.error('[TheDecreeUI] Game component not found!');
            return;
        }

        // Option 2: Auto-find buttons by name (if not manually assigned)
        this.autoFindUIElements();

        // Register button events
        this.registerButtonEvents();

        // Initialize UI state
        this.updateUIState();
    }

    start() {
        // Enable card selection when game starts
        this.scheduleOnce(() => {
            this.enableCardSelection();
        }, 2);
    }

    /**
     * Find Game component in the scene
     */
    private findGameComponent(): Game {
        // Try to find in parent nodes
        let node = this.node.parent;
        while (node) {
            const game = node.getComponent(Game);
            if (game) {
                return game;
            }
            node = node.parent;
        }

        console.error('[TheDecreeUI] Could not find Game component');
        return null!;
    }

    /**
     * Auto-find UI elements by name (if not manually assigned)
     */
    private autoFindUIElements(): void {
        // Find buttons by name if not assigned
        if (!this.playButton) {
            const playButtonNode = this.node.getChildByName('PlayButton');
            this.playButton = playButtonNode?.getComponent(Button) || null;
        }

        if (!this.callOneButton) {
            const callOneNode = this.node.getChildByName('CallOneButton');
            this.callOneButton = callOneNode?.getComponent(Button) || null;
        }

        if (!this.callTwoButton) {
            const callTwoNode = this.node.getChildByName('CallTwoButton');
            this.callTwoButton = callTwoNode?.getComponent(Button) || null;
        }

        if (!this.callThreeButton) {
            const callThreeNode = this.node.getChildByName('CallThreeButton');
            this.callThreeButton = callThreeNode?.getComponent(Button) || null;
        }

        // Temporarily disabled
        // if (!this.clearSelectionButton) {
        //     const clearNode = this.node.getChildByName('ClearSelectionButton');
        //     this.clearSelectionButton = clearNode?.getComponent(Button) || null;
        // }

        // if (!this.statusLabel) {
        //     const labelNode = this.node.getChildByName('StatusLabel');
        //     this.statusLabel = labelNode?.getComponent(Label) || null;
        // }

        console.log('[TheDecreeUI] UI elements found:', {
            playButton: !!this.playButton,
            callOneButton: !!this.callOneButton,
            callTwoButton: !!this.callTwoButton,
            callThreeButton: !!this.callThreeButton,
            // clearSelectionButton: !!this.clearSelectionButton,
            // statusLabel: !!this.statusLabel
        });
    }

    /**
     * Register button click events
     */
    private registerButtonEvents(): void {
        if (this.playButton) {
            this.playButton.node.on(Button.EventType.CLICK, this.onPlayButtonClicked, this);
        }

        if (this.callOneButton) {
            this.callOneButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(1), this);
        }

        if (this.callTwoButton) {
            this.callTwoButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(2), this);
        }

        if (this.callThreeButton) {
            this.callThreeButton.node.on(Button.EventType.CLICK, () => this.onCallButtonClicked(3), this);
        }

        // Temporarily disabled
        // if (this.clearSelectionButton) {
        //     this.clearSelectionButton.node.on(Button.EventType.CLICK, this.onClearSelectionClicked, this);
        // }
    }

    /**
     * Enable card selection for player 0
     */
    private enableCardSelection(): void {
        if (!this._game || !this._game.handsManager) {
            console.error('[TheDecreeUI] Cannot enable card selection - game not ready');
            return;
        }

        this._game.handsManager.enableCardSelection(0, (selectedIndices: number[]) => {
            this._selectedCardIndices = selectedIndices;
            this.onSelectionChanged(selectedIndices);
        });

        console.log('[TheDecreeUI] Card selection enabled');
    }

    /**
     * Handle card selection changes
     */
    private onSelectionChanged(selectedIndices: number[]): void {
        console.log(`[TheDecreeUI] Selected cards: [${selectedIndices.join(', ')}]`);

        // Update UI based on selection
        this.updateUIState();

        // Temporarily disabled - status label update
        // if (this.statusLabel) {
        //     if (selectedIndices.length > 0) {
        //         this.statusLabel.string = `已选择 ${selectedIndices.length} 张牌`;
        //     } else {
        //         this.statusLabel.string = '请选择牌';
        //     }
        // }
    }

    /**
     * Update UI state (enable/disable buttons)
     */
    private updateUIState(): void {
        const hasSelection = this._selectedCardIndices.length > 0;

        // Enable/disable play button based on selection
        if (this.playButton) {
            this.playButton.interactable = hasSelection;
        }

        // Temporarily disabled - clear button
        // if (this.clearSelectionButton) {
        //     this.clearSelectionButton.interactable = hasSelection;
        // }

        // Call buttons are always enabled (or based on game state)
        // You can add more logic here based on game phase
    }

    // ==================== Button Event Handlers ====================

    /**
     * Handle "Play" button clicked
     */
    private onPlayButtonClicked(): void {
        console.log('[TheDecreeUI] Play button clicked');

        if (this._selectedCardIndices.length === 0) {
            console.warn('[TheDecreeUI] No cards selected');
            // this.updateStatusLabel('请先选择牌！', 'warning');
            return;
        }

        // Call game interface to play cards
        const success = this._game.playerSelectCards('player_0', this._selectedCardIndices);

        if (success) {
            console.log('[TheDecreeUI] Cards played successfully');
            // this.updateStatusLabel('出牌成功！', 'success');

            // Clear selection
            this._game.handsManager.clearSelection(0);
            this._selectedCardIndices = [];
            this.updateUIState();
        } else {
            console.error('[TheDecreeUI] Failed to play cards');
            // this.updateStatusLabel('出牌失败！', 'error');
        }
    }

    /**
     * Handle "Call" button clicked (dealer calls how many cards to play)
     * @param cardsCount Number of cards (1, 2, or 3)
     */
    private onCallButtonClicked(cardsCount: 1 | 2 | 3): void {
        console.log(`[TheDecreeUI] Call ${cardsCount} button clicked`);

        const success = this._game.dealerCall(cardsCount);

        if (success) {
            console.log(`[TheDecreeUI] Dealer called: ${cardsCount} cards`);
            // this.updateStatusLabel(`庄家叫牌：${cardsCount}张`, 'success');

            // Hide call buttons after calling
            this.hideCallButtons();

            // Enable card selection for all players
            this.enableCardSelection();
        } else {
            console.error(`[TheDecreeUI] Failed to call ${cardsCount} cards`);
            // this.updateStatusLabel('叫牌失败！', 'error');
        }
    }

    // Temporarily disabled - Clear Selection button handler
    /**
     * Handle "Clear Selection" button clicked
     */
    // private onClearSelectionClicked(): void {
    //     console.log('[TheDecreeUI] Clear selection button clicked');
    //
    //     this._game.handsManager.clearSelection(0);
    //     this._selectedCardIndices = [];
    //     this.updateUIState();
    //
    //     this.updateStatusLabel('已清除选择', 'info');
    // }

    // ==================== Helper Methods ====================

    // Temporarily disabled - Status Label update method
    /**
     * Update status label
     */
    // private updateStatusLabel(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    //     if (!this.statusLabel) return;
    //
    //     this.statusLabel.string = message;
    //
    //     // You can change color based on type
    //     // For example:
    //     // switch (type) {
    //     //     case 'success': this.statusLabel.color = Color.GREEN; break;
    //     //     case 'error': this.statusLabel.color = Color.RED; break;
    //     //     case 'warning': this.statusLabel.color = Color.YELLOW; break;
    //     //     default: this.statusLabel.color = Color.WHITE; break;
    //     // }
    // }

    /**
     * Hide call buttons (after dealer has called)
     */
    private hideCallButtons(): void {
        if (this.callOneButton) this.callOneButton.node.active = false;
        if (this.callTwoButton) this.callTwoButton.node.active = false;
        if (this.callThreeButton) this.callThreeButton.node.active = false;
    }

    /**
     * Show call buttons (when starting new round)
     */
    private showCallButtons(): void {
        if (this.callOneButton) this.callOneButton.node.active = true;
        if (this.callTwoButton) this.callTwoButton.node.active = true;
        if (this.callThreeButton) this.callThreeButton.node.active = true;
    }

    /**
     * Disable all UI interactions
     */
    public disableAllButtons(): void {
        if (this.playButton) this.playButton.interactable = false;
        if (this.callOneButton) this.callOneButton.interactable = false;
        if (this.callTwoButton) this.callTwoButton.interactable = false;
        if (this.callThreeButton) this.callThreeButton.interactable = false;
        // if (this.clearSelectionButton) this.clearSelectionButton.interactable = false;

        // Disable card selection
        this._game?.handsManager?.disableCardSelection(0);
    }

    /**
     * Enable all UI interactions
     */
    public enableAllButtons(): void {
        this.updateUIState(); // This will properly enable/disable based on state
    }

    /**
     * Clean up
     */
    onDestroy() {
        // Unregister events
        if (this.playButton) {
            this.playButton.node.off(Button.EventType.CLICK, this.onPlayButtonClicked, this);
        }

        // Temporarily disabled
        // if (this.clearSelectionButton) {
        //     this.clearSelectionButton.node.off(Button.EventType.CLICK, this.onClearSelectionClicked, this);
        // }
    }
}
