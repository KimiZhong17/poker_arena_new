import { _decorator, Component, Node, Button, Label, Color } from 'cc';
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

    @property(Node)
    public btnCall123Node: Node | null = null;

    @property(Button)
    public autoPlayToggleButton: Button | null = null;

    // Auto-found references (don't need to assign in editor)
    private callOneButton: Button | null = null;
    private callTwoButton: Button | null = null;
    private callThreeButton: Button | null = null;
    private autoPlayToggleLabel: Label | null = null;

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

        // Hide call buttons initially
        this.hideCallButtons();
        console.log('[TheDecreeUI] Call buttons hidden on load');
    }

    start() {
        // Initialize button visibility
        this.updateCallButtonsVisibility();

        // Initialize auto-play toggle UI
        this.scheduleOnce(() => {
            if (this._game && this._game.theDecreeMode) {
                const isEnabled = this._game.theDecreeMode.isPlayer0AutoPlayEnabled();
                this.updateAutoPlayToggleUI(isEnabled);
            }
        }, 0.1);
    }

    /**
     * Update call buttons visibility based on dealer status
     * Only show when player_0 is the dealer and in DEALER_CALL state
     */
    public updateCallButtonsVisibility(): void {
        console.log('[TheDecreeUI] updateCallButtonsVisibility() called');
        console.log('[TheDecreeUI]   _game:', !!this._game);
        console.log('[TheDecreeUI]   theDecreeMode:', !!this._game?.theDecreeMode);

        if (!this._game || !this._game.theDecreeMode) {
            console.log('[TheDecreeUI]   Game or mode not ready, hiding buttons');
            this.hideCallButtons();
            return;
        }

        const theDecreeMode = this._game.theDecreeMode;
        const currentRound = theDecreeMode.getCurrentRound();
        const gameState = theDecreeMode.getState();

        console.log('[TheDecreeUI]   currentRound:', !!currentRound);
        console.log('[TheDecreeUI]   dealerId:', currentRound?.dealerId);
        console.log('[TheDecreeUI]   gameState:', gameState);

        // Show buttons only when:
        // 1. There's an active round
        // 2. player_0 is the dealer
        // 3. Game state is DEALER_CALL
        const shouldShow = currentRound &&
                          currentRound.dealerId === 'player_0' &&
                          gameState === 'dealer_call';

        console.log('[TheDecreeUI]   shouldShow:', shouldShow);

        if (shouldShow) {
            this.showCallButtons();
            console.log('[TheDecreeUI] Showing call buttons - player_0 is the dealer');
        } else {
            this.hideCallButtons();
        }
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
        // Find play button
        if (!this.playButton) {
            const playButtonNode = this.node.getChildByName('PlayButton');
            this.playButton = playButtonNode?.getComponent(Button) || null;
        }

        // Auto-find auto-play toggle button
        if (!this.autoPlayToggleButton) {
            const toggleNode = this.node.getChildByName('AutoPlayToggleButton');
            this.autoPlayToggleButton = toggleNode?.getComponent(Button) || null;
            if (this.autoPlayToggleButton) {
                const labelNode = toggleNode?.getChildByName('Label');
                this.autoPlayToggleLabel = labelNode?.getComponent(Label) || null;
            }
        }

        // Auto-find Btn_Call123 container node if not assigned
        if (!this.btnCall123Node) {
            this.btnCall123Node = this.node.getChildByName('Btn_Call123');
        }

        // Auto-find call buttons from Btn_Call123 container
        if (this.btnCall123Node) {
            // Find buttons inside the container
            const callOneNode = this.btnCall123Node.getChildByName('CallOneButton');
            this.callOneButton = callOneNode?.getComponent(Button) || null;

            const callTwoNode = this.btnCall123Node.getChildByName('CallTwoButton');
            this.callTwoButton = callTwoNode?.getComponent(Button) || null;

            const callThreeNode = this.btnCall123Node.getChildByName('CallThreeButton');
            this.callThreeButton = callThreeNode?.getComponent(Button) || null;
        } else {
            // Fallback: try to find call buttons at root level
            const callOneNode = this.node.getChildByName('CallOneButton');
            this.callOneButton = callOneNode?.getComponent(Button) || null;

            const callTwoNode = this.node.getChildByName('CallTwoButton');
            this.callTwoButton = callTwoNode?.getComponent(Button) || null;

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
            autoPlayToggleButton: !!this.autoPlayToggleButton,
            btnCall123Node: !!this.btnCall123Node,
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

        if (this.autoPlayToggleButton) {
            this.autoPlayToggleButton.node.on(Button.EventType.CLICK, this.onAutoPlayToggleClicked, this);
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
     * Can be called externally by TheDecreeMode
     */
    public enableCardSelection(): void {
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

            // Hide call buttons immediately after calling
            this.hideCallButtons();

            // Enable card selection for all players
            this.enableCardSelection();
        } else {
            console.error(`[TheDecreeUI] Failed to call ${cardsCount} cards`);
            // this.updateStatusLabel('叫牌失败！', 'error');
        }
    }

    /**
     * Handle auto-play toggle button clicked
     */
    private onAutoPlayToggleClicked(): void {
        if (!this._game || !this._game.theDecreeMode) {
            console.error('[TheDecreeUI] Cannot toggle auto-play - game not ready');
            return;
        }

        const theDecreeMode = this._game.theDecreeMode;
        const currentState = theDecreeMode.isPlayer0AutoPlayEnabled();
        const newState = !currentState;

        theDecreeMode.setPlayer0AutoPlay(newState);
        this.updateAutoPlayToggleUI(newState);

        console.log(`[TheDecreeUI] Auto-play toggled to: ${newState ? 'ON' : 'OFF'}`);
    }

    /**
     * Update auto-play toggle button visual state
     */
    private updateAutoPlayToggleUI(isEnabled: boolean): void {
        if (!this.autoPlayToggleButton || !this.autoPlayToggleLabel) {
            return;
        }

        // Update label text
        this.autoPlayToggleLabel.string = isEnabled ? '自动出牌: 开' : '自动出牌: 关';

        // Update button color
        const targetNode = this.autoPlayToggleButton.node.getChildByName('Background');
        if (targetNode) {
            const sprite = targetNode.getComponent('cc.Sprite');
            if (sprite) {
                // Green when enabled, red when disabled
                (sprite as any).color = isEnabled ? new Color(100, 200, 100) : new Color(200, 100, 100);
            }
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
        console.log('[TheDecreeUI] hideCallButtons() called, btnCall123Node:', !!this.btnCall123Node);

        if (this.btnCall123Node) {
            this.btnCall123Node.active = false;
            console.log('[TheDecreeUI] Set btnCall123Node.active = false');
        } else {
            // Fallback: hide individual buttons if container not found
            console.log('[TheDecreeUI] No container found, hiding individual buttons');
            if (this.callOneButton) {
                this.callOneButton.node.active = false;
                console.log('[TheDecreeUI] Set callOneButton.active = false');
            }
            if (this.callTwoButton) {
                this.callTwoButton.node.active = false;
                console.log('[TheDecreeUI] Set callTwoButton.active = false');
            }
            if (this.callThreeButton) {
                this.callThreeButton.node.active = false;
                console.log('[TheDecreeUI] Set callThreeButton.active = false');
            }
        }
    }

    /**
     * Show call buttons (when starting new round)
     */
    private showCallButtons(): void {
        console.log('[TheDecreeUI] showCallButtons() called, btnCall123Node:', !!this.btnCall123Node);

        if (this.btnCall123Node) {
            this.btnCall123Node.active = true;
            console.log('[TheDecreeUI] Set btnCall123Node.active = true');
        } else {
            // Fallback: show individual buttons if container not found
            console.log('[TheDecreeUI] No container found, showing individual buttons');
            if (this.callOneButton) {
                this.callOneButton.node.active = true;
                console.log('[TheDecreeUI] Set callOneButton.active = true');
            }
            if (this.callTwoButton) {
                this.callTwoButton.node.active = true;
                console.log('[TheDecreeUI] Set callTwoButton.active = true');
            }
            if (this.callThreeButton) {
                this.callThreeButton.node.active = true;
                console.log('[TheDecreeUI] Set callThreeButton.active = true');
            }
        }
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
