import { _decorator, Component, Node, Button, Label } from 'cc';
import { Game } from '../Game';
import { logger } from '../Utils/Logger';
const log = logger('GuandanUI');

const { ccclass, property } = _decorator;

/**
 * Guandan UI Controller
 * Manages all UI interactions for Guandan game mode
 *
 * Usage:
 * 1. Attach this component to ObjectGuandanNode
 * 2. UI buttons will be automatically found by name, or you can manually assign them in the editor
 */
@ccclass('GuandanUIController')
export class GuandanUIController extends Component {

    // Manually assign in editor (recommended)
    @property(Button)
    public playButton: Button | null = null;

    @property(Button)
    public passButton: Button | null = null;

    @property(Button)
    public clearSelectionButton: Button | null = null;

    @property(Label)
    public statusLabel: Label | null = null;

    // Private
    private _game: Game = null!;
    private _selectedCardIndices: number[] = [];

    onLoad() {
        // Find Game component
        this._game = this.findGameComponent();

        if (!this._game) {
            log.error('Game component not found!');
            return;
        }

        // Auto-find buttons by name (if not manually assigned)
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
        let node = this.node.parent;
        while (node) {
            const game = node.getComponent(Game);
            if (game) {
                return game;
            }
            node = node.parent;
        }

        log.error('Could not find Game component');
        return null!;
    }

    /**
     * Auto-find UI elements by name
     */
    private autoFindUIElements(): void {
        if (!this.playButton) {
            const playButtonNode = this.node.getChildByName('PlayButton');
            this.playButton = playButtonNode?.getComponent(Button) || null;
        }

        if (!this.passButton) {
            const passButtonNode = this.node.getChildByName('PassButton');
            this.passButton = passButtonNode?.getComponent(Button) || null;
        }

        if (!this.clearSelectionButton) {
            const clearNode = this.node.getChildByName('ClearSelectionButton');
            this.clearSelectionButton = clearNode?.getComponent(Button) || null;
        }

        if (!this.statusLabel) {
            const labelNode = this.node.getChildByName('StatusLabel');
            this.statusLabel = labelNode?.getComponent(Label) || null;
        }

        log.debug('UI elements found:', {
            playButton: !!this.playButton,
            passButton: !!this.passButton,
            clearSelectionButton: !!this.clearSelectionButton,
            statusLabel: !!this.statusLabel
        });
    }

    /**
     * Register button click events
     */
    private registerButtonEvents(): void {
        if (this.playButton) {
            this.playButton.node.on(Button.EventType.CLICK, this.onPlayButtonClicked, this);
        }

        if (this.passButton) {
            this.passButton.node.on(Button.EventType.CLICK, this.onPassButtonClicked, this);
        }

        if (this.clearSelectionButton) {
            this.clearSelectionButton.node.on(Button.EventType.CLICK, this.onClearSelectionClicked, this);
        }
    }

    /**
     * Enable card selection for player 0
     */
    private enableCardSelection(): void {
        if (!this._game || !this._game.handsManager) {
            log.error('Cannot enable card selection - game not ready');
            return;
        }

        this._game.handsManager.enableCardSelection(0, (selectedIndices: number[]) => {
            this._selectedCardIndices = selectedIndices;
            this.onSelectionChanged(selectedIndices);
        });

        log.debug('Card selection enabled');
    }

    /**
     * Handle card selection changes
     */
    private onSelectionChanged(selectedIndices: number[]): void {
        log.debug(`Selected cards: [${selectedIndices.join(', ')}]`);

        // Update UI based on selection
        this.updateUIState();

        // Update status label
        if (this.statusLabel) {
            if (selectedIndices.length > 0) {
                this.statusLabel.string = `已选择 ${selectedIndices.length} 张牌`;
            } else {
                this.statusLabel.string = '请选择牌或不出';
            }
        }
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

        // Pass button is always enabled (game controller will validate)
        if (this.passButton) {
            this.passButton.interactable = true;
        }

        // Enable/disable clear button based on selection
        if (this.clearSelectionButton) {
            this.clearSelectionButton.interactable = hasSelection;
        }
    }

    // ==================== Button Event Handlers ====================

    /**
     * Handle "Play" button clicked
     */
    private onPlayButtonClicked(): void {
        log.debug('Play button clicked');

        if (this._selectedCardIndices.length === 0) {
            log.warn('No cards selected');
            this.updateStatusLabel('请先选择牌！', 'warning');
            return;
        }

        // Call game interface to play cards
        const success = this._game.playerSelectCards('0', this._selectedCardIndices);

        if (success) {
            log.debug('Cards played successfully');
            this.updateStatusLabel('出牌成功！', 'success');

            // Clear selection
            this._game.handsManager.clearSelection(0);
            this._selectedCardIndices = [];
            this.updateUIState();
        } else {
            log.error('Failed to play cards');
            this.updateStatusLabel('出牌失败！无法压过上家', 'error');
        }
    }

    /**
     * Handle "Pass" button clicked
     */
    private onPassButtonClicked(): void {
        log.debug('Pass button clicked');

        // Call game interface to pass
        const success = this._game.playerPass('0');

        if (success) {
            log.debug('Passed successfully');
            this.updateStatusLabel('不出', 'info');

            // Clear selection
            this._game.handsManager.clearSelection(0);
            this._selectedCardIndices = [];
            this.updateUIState();
        } else {
            log.error('Cannot pass');
            this.updateStatusLabel('不能不出！', 'error');
        }
    }

    /**
     * Handle "Clear Selection" button clicked
     */
    private onClearSelectionClicked(): void {
        log.debug('Clear selection button clicked');

        this._game.handsManager.clearSelection(0);
        this._selectedCardIndices = [];
        this.updateUIState();

        this.updateStatusLabel('已清除选择', 'info');
    }

    // ==================== Helper Methods ====================

    /**
     * Update status label
     */
    private updateStatusLabel(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
        if (!this.statusLabel) return;

        this.statusLabel.string = message;

        // You can change color based on type
    }

    /**
     * Disable all UI interactions
     */
    public disableAllButtons(): void {
        if (this.playButton) this.playButton.interactable = false;
        if (this.passButton) this.passButton.interactable = false;
        if (this.clearSelectionButton) this.clearSelectionButton.interactable = false;

        // Disable card selection
        this._game?.handsManager?.disableCardSelection(0);
    }

    /**
     * Enable all UI interactions
     */
    public enableAllButtons(): void {
        this.updateUIState();
    }

    /**
     * Clean up
     */
    onDestroy() {
        if (this.playButton && this.playButton.node) {
            this.playButton.node.off(Button.EventType.CLICK, this.onPlayButtonClicked, this);
        }
        if (this.passButton && this.passButton.node) {
            this.passButton.node.off(Button.EventType.CLICK, this.onPassButtonClicked, this);
        }
        if (this.clearSelectionButton && this.clearSelectionButton.node) {
            this.clearSelectionButton.node.off(Button.EventType.CLICK, this.onClearSelectionClicked, this);
        }
    }
}
