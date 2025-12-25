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
    private _cardSpacing: number = 50; // Default spacing for Guandan

    // Click handling
    private _isInteractive: boolean = false;
    private _selectedIndices: Set<number> = new Set();
    private _selectionChangedCallback: SelectionChangedCallback | null = null;

    // Played cards tracking (for TheDecree mode)
    private _playedCards: number[] = [];  // Cards that have been played this round
    private _playerIndex: number = 0;     // Player index (0-3) for positioning
    private _enableGrouping: boolean = true; // Whether to group cards by point value (true for Guandan, false for TheDecree)

    /**
     * Initialize the hand display
     */
    public init(player: Player, displayMode: HandDisplayMode, pokerSprites: Map<string, any>, pokerPrefab: Prefab, levelRank: number = 0, playerIndex: number = 0, enableGrouping: boolean = true): void {
        this._player = player;
        this._displayMode = displayMode;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;
        this._playerIndex = playerIndex;
        this._enableGrouping = enableGrouping;

        // If handContainer not set, use current node
        if (!this.handContainer) {
            this.handContainer = this.node;
        }

        console.log(`PlayerHandDisplay initialized for ${player.name}, mode: ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'}, cards: ${player.handCards.length}, levelRank: ${levelRank}, playerIndex: ${playerIndex}, grouping: ${enableGrouping}`);
    }

    /**
     * Update the display with current player's cards
     * @param playedCards Optional array of cards that have been played (for TheDecree mode)
     */
    public updateDisplay(playedCards: number[] = []): void {
        console.log(`Updating display for ${this._player.name}, cards: ${this._player.handCards.length}, played: ${playedCards.length}, container: ${this.handContainer ? 'exists' : 'NULL'}`);

        this._playedCards = playedCards;

        // Clear existing cards
        this.clearCards();

        const cards = this._player.handCards;

        // Dynamically adjust card spacing based on hand size and game mode
        if (!this._enableGrouping) {
            // TheDecree mode: 5 cards with overlap, smaller spacing for overlapping effect
            this._cardSpacing = 100; // 50px offset per card (cards will overlap since width is 140px)
        } else if (cards.length <= 7) {
            this._cardSpacing = 100; // Wider spacing for few cards (Guandan)
        } else if (cards.length <= 15) {
            this._cardSpacing = 70;  // Medium spacing
        } else {
            this._cardSpacing = 50;  // Tight spacing for many cards (Guandan)
        }

        if (this._displayMode === HandDisplayMode.SPREAD) {
            console.log(`Displaying ${cards.length} cards in SPREAD mode with spacing: ${this._cardSpacing}`);
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
     * If enableGrouping is true: Cards with the same point value are stacked vertically (Guandan mode)
     * If enableGrouping is false: All cards are displayed in a simple horizontal line (TheDecree mode)
     * Heart level cards (wild cards) are displayed separately on the right (only for Guandan)
     */
    private displaySpread(cards: number[]): void {
        const cardCount = cards.length;
        const cardWidth = 140;  // Adjust based on your card sprite size
        const cardSpacing = this._cardSpacing; // Use dynamic spacing
        const verticalOffset = 30; // Vertical offset for stacked cards
        const wildCardGap = 10; // Extra gap before wild cards (red heart level cards)

        // Sort cards by point value first (ascending order)
        const sortedCards = [...cards].sort((a, b) => {
            const pointA = a & 0x0F;
            const pointB = b & 0x0F;
            return pointA - pointB;
        });

        // If grouping is disabled (TheDecree mode), display cards in a simple horizontal line
        if (!this._enableGrouping) {
            this.displaySpreadSimple(sortedCards, cardWidth, cardSpacing);
            return;
        }

        // === Guandan mode: Group cards by point value ===

        // Separate wild cards (Heart level cards) from normal cards
        const normalCards: number[] = [];
        const wildCards: number[] = [];

        for (const card of sortedCards) {  // Use sorted cards
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
                let y = i * verticalOffset;
                let finalX = x;
                let finalY = y;

                // Check if this card is in the played cards list
                if (this._playedCards.includes(group[i])) {
                    const offset = this.getPlayedCardOffset();
                    finalX += offset.x;
                    finalY += offset.y;

                    // 出牌后只改变位置，保持与其他卡牌相同的大小
                    // 不再改变缩放，确保所有卡牌大小一致
                }

                cardNode.setPosition(finalX, finalY, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);

                // Log first card details
                if (groupIndex === 0 && i === group.length - 1) {
                    console.log(`First normal card position: (${finalX}, ${finalY})`);
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

                let y = i * verticalOffset;
                let finalX = wildX;
                let finalY = y;

                // Check if this card is in the played cards list
                if (this._playedCards.includes(wildCards[i])) {
                    const offset = this.getPlayedCardOffset();
                    finalX += offset.x;
                    finalY += offset.y;

                    // 出牌后只改变位置，保持与其他卡牌相同的大小
                    // 不再改变缩放，确保所有卡牌大小一致
                }

                cardNode.setPosition(finalX, finalY, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);

                if (i === wildCards.length - 1) {
                    console.log(`First wild card position: (${finalX}, ${finalY})`);
                }
            }
        }

        console.log(`Added ${this._pokerNodes.length} card nodes to container`);
    }

    /**
     * Display cards in a simple horizontal line (for TheDecree mode)
     * No grouping, no stacking, just a simple spread with overlapping
     */
    private displaySpreadSimple(cards: number[], cardWidth: number, cardSpacing: number): void {
        const cardCount = cards.length;
        // 重叠显示：总宽度 = 第一张卡的半宽 + 中间卡片的偏移 + 最后一张卡的半宽
        const totalWidth = (cardCount - 1) * cardSpacing + cardWidth;
        const startX = -totalWidth / 2 + cardWidth / 2;

        console.log(`Display spread simple: ${cardCount} cards with overlap, spacing: ${cardSpacing}`);

        // Display all cards in a simple horizontal line with overlap
        for (let i = 0; i < cards.length; i++) {
            const cardNode = this.createCardNode(cards[i], true);

            // 重叠显示：每张卡只偏移 cardSpacing 的距离
            const x = startX + cardSpacing * i;
            let finalX = x;
            let finalY = 0;

            // Check if this card is in the played cards list
            if (this._playedCards.includes(cards[i])) {
                const offset = this.getPlayedCardOffset();
                finalX += offset.x;
                finalY += offset.y;
            }

            cardNode.setPosition(finalX, finalY, 0);
            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);

            if (i === 0) {
                console.log(`First card position: (${finalX}, ${finalY}), card width: ${cardWidth}, spacing: ${cardSpacing}`);
            }
        }

        console.log(`Added ${this._pokerNodes.length} card nodes to container`);
    }

    /**
     * Get offset for played cards based on player position
     * @returns Vec3 offset to apply to played cards
     */
    private getPlayedCardOffset(): { x: number; y: number } {
        // Define offsets based on player index
        // 0: Bottom (player) - move up
        // 1: Left - move right only (no vertical offset)
        // 2: Top - move right (to create symmetry with hand pile on left)
        // 3: Right - move left only (no vertical offset)
        const offsets = [
            { x: 0, y: 40 },      // Player 0 (Bottom): up
            { x: 150, y: 0 },     // Player 1 (Left): right only
            { x: 100, y: 0 },  // Player 2 (Top): right and down (symmetry with hand pile)
            { x: -150, y: 0 }     // Player 3 (Right): left only
        ];

        return offsets[this._playerIndex] || { x: 0, y: 40 };
    }

    /**
     * Get base offset for hand pile based on player position
     * This allows positioning the hand pile differently for each player
     * @returns Base offset to apply to all cards in the hand pile
     */
    private getHandPileBaseOffset(): { x: number; y: number } {
        // Define base offsets for hand pile based on player index
        // 0: Bottom (player) - centered
        // 1: Left - centered
        // 2: Top - slightly left (to create symmetry with played cards on right)
        // 3: Right - centered
        const offsets = [
            { x: 0, y: 0 },       // Player 0 (Bottom): centered
            { x: 0, y: 0 },       // Player 1 (Left): centered
            { x: -100, y: 0 },    // Player 2 (Top): left (symmetry with played cards)
            { x: 0, y: 0 }        // Player 3 (Right): centered
        ];

        return offsets[this._playerIndex] || { x: 0, y: 0 };
    }

    /**
     * Display cards as a stack (for other players, showing backs)
     * If there are played cards, also display them face-up in a spread
     */
    private displayStack(cardCount: number): void {
        console.log(`[displayStack] Displaying ${cardCount} cards, played: ${this._playedCards.length}`);

        // Calculate remaining cards (cards in hand that haven't been played yet)
        const remainingCards = cardCount - this._playedCards.length;

        // Get base offset for hand pile positioning
        const baseOffset = this.getHandPileBaseOffset();

        // 1. Show stacked card backs (representing the remaining hand cards)
        const maxStackDisplay = Math.min(5, remainingCards); // Show max 5 cards in stack
        const stackOffset = 2; // Pixel offset for stacking effect

        for (let i = 0; i < maxStackDisplay; i++) {
            const cardNode = this.createCardNode(0, false); // 0 = back only

            // Apply base offset + slight offset for stacking effect
            const x = baseOffset.x + i * stackOffset;
            const y = baseOffset.y + i * stackOffset;
            cardNode.setPosition(x, y, 0);

            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);
        }

        console.log(`[displayStack] Added ${maxStackDisplay} card backs (remaining: ${remainingCards}) at base offset (${baseOffset.x}, ${baseOffset.y})`);

        // 2. If there are played cards, display them face-up in a spread with overlap
        if (this._playedCards.length > 0) {
            const playedCardSpacing = 30; // Smaller spacing for played cards overlap
            const playedCardWidth = 140;
            // 重叠显示：总宽度 = (卡片数-1) * 间距 + 卡片宽度
            const playedCardsWidth = (this._playedCards.length - 1) * playedCardSpacing + playedCardWidth;
            const playedStartX = -playedCardsWidth / 2 + playedCardWidth / 2;

            // Get the offset for played cards based on player position
            const offset = this.getPlayedCardOffset();

            console.log(`[displayStack] Displaying ${this._playedCards.length} played cards at offset (${offset.x}, ${offset.y}) with spacing ${playedCardSpacing}`);

            for (let i = 0; i < this._playedCards.length; i++) {
                const cardValue = this._playedCards[i];
                const cardNode = this.createCardNode(cardValue, true); // Show front

                // 重叠显示：每张卡只偏移 playedCardSpacing 的距离
                const x = playedStartX + playedCardSpacing * i;
                const finalX = x + offset.x;
                const finalY = offset.y;

                cardNode.setPosition(finalX, finalY, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);

                console.log(`[displayStack] Played card ${i}: position (${finalX}, ${finalY})`);
            }
        }

        console.log(`[displayStack] Total nodes: ${this._pokerNodes.length}`);
    }

    /**
     * Create a poker card node
     */
    private createCardNode(cardValue: number, showFront: boolean): Node {
        const pokerNode = instantiate(this._pokerPrefab);
        const pokerCtrl = pokerNode.addComponent(Poker);

        // 使用预制体的默认缩放（与公牌保持一致）
        // 不再强制设置 setScale，让预制体的缩放生效

        // CRITICAL: Set the same layer as container for proper rendering
        // Must set layer for node AND all children recursively
        this.setNodeLayerRecursive(pokerNode, this.handContainer.layer);

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
     * Recursively set layer for node and all its children
     */
    private setNodeLayerRecursive(node: Node, layer: number): void {
        node.layer = layer;
        node.children.forEach(child => {
            this.setNodeLayerRecursive(child, layer);
        });
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
