import { _decorator, Component, Node, instantiate, Prefab, UITransform, Vec3 } from 'cc';
import { Poker, CardClickCallback } from './Poker';
import { PokerFactory } from './PokerFactory';
import { Player } from '../Core/Player';
const { ccclass, property } = _decorator;

/**
 * Callback for selected cards changed
 * @param selectedIndices Array of selected card indices
 */
export type SelectionChangedCallback = (selectedIndices: number[]) => void;

/**
 * Display mode for player hands
 */
export enum HandDisplayMode {
    SPREAD = 0,     // Cards spread out horizontally (for main player)
    STACK = 1       // Cards stacked (for other players, showing back)
}

/**
 * Manages the display of a single player's hand
 */
@ccclass('PlayerHandDisplay')
export class PlayerHandDisplay extends Component {

    @property(Node)
    public handContainer: Node = null!;

    private _player: Player = null!;
    private _displayMode: HandDisplayMode = HandDisplayMode.STACK;
    private _pokerNodes: Node[] = [];
    private _pokerComponents: Poker[] = [];
    private _pokerSprites: Map<string, any> = new Map();
    private _pokerPrefab: Prefab = null!;

    private _levelRank: number = 0;

    // Click handling
    private _isInteractive: boolean = false;
    private _selectedIndices: Set<number> = new Set();
    private _selectionChangedCallback: SelectionChangedCallback | null = null;

    /**
     * Initialize the hand display
     */
    public init(player: Player, displayMode: HandDisplayMode, pokerSprites: Map<string, any>, pokerPrefab: Prefab, levelRank: number = 0): void {
        this._player = player;
        this._displayMode = displayMode;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;

        // If handContainer not set, use current node
        if (!this.handContainer) {
            this.handContainer = this.node;
        }

        console.log(`PlayerHandDisplay initialized for ${player.name}, mode: ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'}, cards: ${player.handCards.length}, levelRank: ${levelRank}`);
    }

    /**
     * Update the display with current player's cards
     */
    public updateDisplay(): void {
        console.log(`Updating display for ${this._player.name}, cards: ${this._player.handCards.length}, container: ${this.handContainer ? 'exists' : 'NULL'}`);

        // Clear existing cards
        this.clearCards();

        const cards = this._player.handCards;

        if (this._displayMode === HandDisplayMode.SPREAD) {
            console.log(`Displaying ${cards.length} cards in SPREAD mode`);
            this.displaySpread(cards);
        } else {
            console.log(`Displaying ${cards.length} cards in STACK mode`);
            this.displayStack(cards.length);
        }

        // Re-enable click if was interactive
        if (this._isInteractive && this._displayMode === HandDisplayMode.SPREAD) {
            this.enableCardSelection(this._selectionChangedCallback);
        }
    }

    /**
     * Display cards spread out horizontally (for main player)
     * Cards with the same point value are stacked vertically
     * Heart level cards (wild cards) are displayed separately on the right
     */
    private displaySpread(cards: number[]): void {
        const cardCount = cards.length;
        const cardWidth = 140;  // Adjust based on your card sprite size
        const cardSpacing = 50; // Spacing between card groups
        const verticalOffset = 30; // Vertical offset for stacked cards
        const wildCardGap = 10; // Extra gap before wild cards (red heart level cards)

        // Separate wild cards (Heart level cards) from normal cards
        const normalCards: number[] = [];
        const wildCards: number[] = [];

        for (const card of cards) {
            const suit = card & 0xF0;
            const point = card & 0x0F;

            // Check if it's a Heart level card (wild card)
            if (suit === 0x20 && point === this._levelRank) {
                wildCards.push(card);
            } else {
                normalCards.push(card);
            }
        }

        // Group normal cards by point value
        const cardGroups: number[][] = [];
        let currentGroup: number[] = [];
        let lastPoint = -1;

        for (let i = 0; i < normalCards.length; i++) {
            const point = normalCards[i] & 0x0F;

            if (point !== lastPoint) {
                if (currentGroup.length > 0) {
                    cardGroups.push(currentGroup);
                }
                currentGroup = [normalCards[i]];
                lastPoint = point;
            } else {
                currentGroup.push(normalCards[i]);
            }
        }
        if (currentGroup.length > 0) {
            cardGroups.push(currentGroup);
        }

        // Calculate width for normal cards only
        const normalGroupCount = cardGroups.length;
        const hasWildCards = wildCards.length > 0;

        let normalCardsWidth = 0;
        if (normalGroupCount > 0) {
            normalCardsWidth = (normalGroupCount - 1) * cardSpacing + cardWidth;
        }

        // Normal cards are centered independently
        let normalStartX = -normalCardsWidth / 2 + cardWidth / 2;

        const totalGroupCount = normalGroupCount + (hasWildCards ? 1 : 0);
        console.log(`Display spread: ${cardCount} cards (${normalCards.length} normal, ${wildCards.length} wild) in ${totalGroupCount} groups`);
        console.log(`Normal cards width: ${normalCardsWidth}, centered at 0`);

        // Display normal card groups (centered)
        let groupIndex = 0;
        for (const group of cardGroups) {
            const x = normalStartX + groupIndex * cardSpacing;

            // Stack cards in this group vertically
            // Reverse order so top cards are added last (rendered on top)
            for (let i = group.length - 1; i >= 0; i--) {
                const cardNode = this.createCardNode(group[i], true);

                // Position: same x for all cards in group, offset y for stacking
                const y = i * verticalOffset;
                cardNode.setPosition(x, y, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);

                // Log first card details
                if (groupIndex === 0 && i === group.length - 1) {
                    console.log(`First normal card position: (${x}, ${y})`);
                }
            }

            groupIndex++;
        }

        // Display wild cards (Heart level cards) separately on the right
        // Position them to the right of the centered normal cards
        if (hasWildCards) {
            const normalRightEdge = normalCardsWidth / 2;
            const wildX = normalRightEdge + wildCardGap + cardWidth / 2;

            for (let i = wildCards.length - 1; i >= 0; i--) {
                const cardNode = this.createCardNode(wildCards[i], true);

                const y = i * verticalOffset;
                cardNode.setPosition(wildX, y, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);

                if (i === wildCards.length - 1) {
                    console.log(`First wild card position: (${wildX}, ${y})`);
                }
            }
        }

        console.log(`Added ${this._pokerNodes.length} card nodes to container`);
    }

    /**
     * Display cards as a stack (for other players, showing backs)
     */
    private displayStack(cardCount: number): void {
        // Show a few stacked cards to indicate card count
        const maxStackDisplay = Math.min(5, cardCount); // Show max 5 cards in stack
        const stackOffset = 3; // Pixel offset for stacking effect

        for (let i = 0; i < maxStackDisplay; i++) {
            const cardNode = this.createCardNode(0, false); // 0 = back only

            // Slight offset for stacking effect
            const x = i * stackOffset;
            const y = i * stackOffset;
            cardNode.setPosition(x, y, 0);

            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);
        }

        // Optionally add a label to show exact card count
        // TODO: Add label component if needed
    }

    /**
     * Create a poker card node
     */
    private createCardNode(cardValue: number, showFront: boolean): Node {
        const pokerNode = instantiate(this._pokerPrefab);
        const pokerCtrl = pokerNode.addComponent(Poker);

        const pokerBack = this._pokerSprites.get("CardBack3");

        if (showFront) {
            // Get sprite name for this card
            const spriteName = PokerFactory.getCardSpriteName(cardValue);
            const pokerFront = this._pokerSprites.get(spriteName);

            console.log(`Creating card: ${spriteName}, found: ${pokerFront ? 'YES' : 'NO'}`);

            if (pokerFront) {
                pokerCtrl.init(cardValue, pokerBack, pokerFront);
                pokerCtrl.showFront();
            } else {
                console.warn(`Sprite not found: ${spriteName}`);
            }
        } else {
            // Just show back
            pokerCtrl.init(0, pokerBack, pokerBack);
            pokerCtrl.showBack();
        }

        // Store poker component reference
        this._pokerComponents.push(pokerCtrl);

        return pokerNode;
    }

    /**
     * Clear all displayed cards
     */
    private clearCards(): void {
        // Disable click on all cards before destroying
        this._pokerComponents.forEach(poker => poker.disableClick());

        this._pokerNodes.forEach(node => node.destroy());
        this._pokerNodes = [];
        this._pokerComponents = [];
        this._selectedIndices.clear();
    }

    // ==================== Card Selection (Click Handling) ====================

    /**
     * Enable card selection (for player interaction)
     * @param callback Callback when selection changes
     */
    public enableCardSelection(callback: SelectionChangedCallback | null = null): void {
        if (this._displayMode !== HandDisplayMode.SPREAD) {
            console.warn('Card selection only available in SPREAD mode');
            return;
        }

        this._isInteractive = true;
        this._selectionChangedCallback = callback;

        // Enable click on all cards
        this._pokerComponents.forEach((poker, index) => {
            poker.enableClick(index, this.onCardClicked.bind(this));
        });

        console.log(`Card selection enabled for ${this._player.name}`);
    }

    /**
     * Disable card selection
     */
    public disableCardSelection(): void {
        this._isInteractive = false;

        // Disable click on all cards
        this._pokerComponents.forEach(poker => poker.disableClick());

        this._selectedIndices.clear();
        console.log(`Card selection disabled for ${this._player.name}`);
    }

    /**
     * Handle card click event
     */
    private onCardClicked(card: Poker, cardValue: number, cardIndex: number): void {
        console.log(`Card clicked: index=${cardIndex}, value=${cardValue}, selected=${card.isSelected()}`);

        // Update selected indices
        if (card.isSelected()) {
            this._selectedIndices.add(cardIndex);
        } else {
            this._selectedIndices.delete(cardIndex);
        }

        // Call callback if set
        if (this._selectionChangedCallback) {
            const selectedArray = Array.from(this._selectedIndices).sort((a, b) => a - b);
            this._selectionChangedCallback(selectedArray);
        }

        console.log(`Selected cards: [${Array.from(this._selectedIndices).join(', ')}]`);
    }

    /**
     * Get currently selected card indices
     */
    public getSelectedIndices(): number[] {
        return Array.from(this._selectedIndices).sort((a, b) => a - b);
    }

    /**
     * Clear all card selections
     */
    public clearSelection(): void {
        this._pokerComponents.forEach(poker => {
            if (poker.isSelected()) {
                poker.setSelected(false);
            }
        });
        this._selectedIndices.clear();

        // Notify callback
        if (this._selectionChangedCallback) {
            this._selectionChangedCallback([]);
        }
    }

    /**
     * Programmatically select cards by indices
     * @param indices Array of card indices to select
     */
    public selectCards(indices: number[]): void {
        // Clear existing selection
        this.clearSelection();

        // Select specified cards
        indices.forEach(index => {
            if (index >= 0 && index < this._pokerComponents.length) {
                const poker = this._pokerComponents[index];
                poker.setSelected(true);
                this._selectedIndices.add(index);
            }
        });

        // Notify callback
        if (this._selectionChangedCallback) {
            this._selectionChangedCallback(this.getSelectedIndices());
        }
    }

    /**
     * Get card count
     */
    public get cardCount(): number {
        return this._player.handCards.length;
    }
}
