import { _decorator, Component, Node, instantiate, Prefab, UITransform, Vec3, Label, Sprite, SpriteFrame, Material } from 'cc';
import { Poker, CardClickCallback } from './Poker';
import { PokerFactory } from './PokerFactory';
import { Player } from '../LocalStore/LocalPlayerStore';
import {
    CardDimensions,
    CardSpacing,
    CardScale,
    CardOpacity,
    CardSpriteNames,
    getCardSpacing,
} from '../Config/CardDisplayConfig';
import { SeatPosition, PlayedCardLayout } from '../Config/SeatConfig';
import { UIColors, UIFonts, UISizes } from '../Config/UIConfig';
import { logger } from '../Utils/Logger';
const log = logger('HandDisplay');

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
    private _positionConfig: SeatPosition | null = null; // Position config for offsets

    // Card count display (for STACK mode)
    private _showCardCount: boolean = false; // Whether to show card count label
    private _cardCountLabel: Node | null = null; // Label node for displaying card count

    // Glow effect (for main player)
    private _glowMaterial: Material | null = null; // Material for rim light effect

    /**
     * Initialize the hand display
     */
    public init(player: Player, displayMode: HandDisplayMode, pokerSprites: Map<string, any>, pokerPrefab: Prefab, levelRank: number = 0, playerIndex: number = 0, enableGrouping: boolean = true, showCardCount: boolean = false, positionConfig?: SeatPosition, glowMaterial?: Material): void {
        this._player = player;
        this._displayMode = displayMode;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;
        this._playerIndex = playerIndex;
        this._enableGrouping = enableGrouping;
        this._positionConfig = positionConfig || null;
        this._glowMaterial = glowMaterial || null;

        // Auto-enable card count display for STACK mode if not explicitly set
        this._showCardCount = displayMode === HandDisplayMode.STACK ? true : showCardCount;

        // If handContainer not set, use current node
        if (!this.handContainer) {
            this.handContainer = this.node;
        }

        log.debug(`PlayerHandDisplay initialized for ${player.name}, mode: ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'}, cards: ${player.handCards.length}, levelRank: ${levelRank}, playerIndex: ${playerIndex}, grouping: ${enableGrouping}, showCardCount: ${this._showCardCount}`);
    }

    /**
     * Update the display with current player's cards
     * @param playedCards Optional array of cards that have been played (for TheDecree mode)
     */
    public updateDisplay(playedCards: number[] = []): void {
        log.debug(`Updating display for ${this._player.name}, cards: ${this._player.handCards.length}, played: ${playedCards.length}, container: ${this.handContainer ? 'exists' : 'NULL'}`);

        this._playedCards = playedCards;

        // Clear existing cards
        this.clearCards();

        const cards = this._player.handCards;

        // Dynamically adjust card spacing based on hand size and game mode
        this._cardSpacing = getCardSpacing(cards.length, !this._enableGrouping);

        if (this._displayMode === HandDisplayMode.SPREAD) {
            log.debug(`Displaying ${cards.length} cards in SPREAD mode with spacing: ${this._cardSpacing}`);
            this.displaySpread(cards);
        } else {
            log.debug(`Displaying ${cards.length} cards in STACK mode`);
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
        const cardWidth = CardDimensions.width;
        const cardSpacing = this._cardSpacing;
        const verticalOffset = CardSpacing.stack.verticalOffset;
        const wildCardGap = CardSpacing.stack.wildCardGap;

        log.debug(`[PlayerHandDisplay] displaySpread: enableGrouping=${this._enableGrouping}, cards=${cards.map(c => '0x' + c.toString(16)).join(',')}`);

        // If grouping is disabled (TheDecree mode), display cards in order received from server
        // Server has already sorted the cards, so we don't need to sort again
        if (!this._enableGrouping) {
            this.displaySpreadSimple(cards, cardWidth, cardSpacing);
            return;
        }

        // === Guandan mode: Sort and group cards by point value ===

        // Sort cards by point value first (ascending order)
        const sortedCards = [...cards].sort((a, b) => {
            const pointA = a & 0x0F;
            const pointB = b & 0x0F;
            return pointA - pointB;
        });

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
        log.debug(`Display spread: ${cardCount} cards (${normalCards.length} normal, ${wildCards.length} wild) in ${totalGroupCount} groups`);
        log.debug(`Normal cards width: ${normalCardsWidth}, centered at 0`);

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
                    log.debug(`First normal card position: (${finalX}, ${finalY})`);
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
                    log.debug(`First wild card position: (${finalX}, ${finalY})`);
                }
            }
        }

        log.debug(`Added ${this._pokerNodes.length} card nodes to container`);
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

        log.debug(`Display spread simple: ${cardCount} cards with overlap, spacing: ${cardSpacing}`);

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
                log.debug(`First card position: (${finalX}, ${finalY}), card width: ${cardWidth}, spacing: ${cardSpacing}`);
            }
        }

        log.debug(`Added ${this._pokerNodes.length} card nodes to container`);
    }

    /**
     * Get offset for played cards based on player position
     * @returns offset to apply to played cards
     */
    private getPlayedCardOffset(): { x: number; y: number } {
        return this._positionConfig?.playedCardOffset || { x: 0, y: 0 };
    }

    /**
     * Get base offset for hand pile based on player position
     * This allows positioning the hand pile differently for each player
     * @returns Base offset to apply to all cards in the hand pile
     */
    private getHandPileBaseOffset(): { x: number; y: number } {
        return this._positionConfig?.handPileOffset || { x: 0, y: 0 };
    }

    /**
     * Display cards as a stack (for other players, showing backs)
     * If there are played cards, also display them face-up in a spread or vertical stack
     */
    private displayStack(cardCount: number): void {
        log.debug(`[displayStack] Displaying ${cardCount} cards, played: ${this._playedCards.length}`);

        // Calculate remaining cards (cards in hand that haven't been played yet)
        // In TheDecree mode, cardCount includes played cards, so we need to subtract them
        const remainingCards = Math.max(0, cardCount - this._playedCards.length);

        // Get base offset for hand pile positioning
        const baseOffset = this.getHandPileBaseOffset();

        // 1. Show stacked card backs (representing the remaining hand cards)
        // Only show card backs if there are remaining cards
        if (remainingCards > 0) {
            const maxStackDisplay = Math.min(CardScale.stackDisplay.maxCards, remainingCards);
            const stackOffset = CardScale.stackDisplay.offset;

            for (let i = 0; i < maxStackDisplay; i++) {
                const cardNode = this.createCardNode(0, false); // 0 = back only

                // Apply base offset + slight offset for stacking effect
                const x = baseOffset.x + i * stackOffset;
                const y = baseOffset.y + i * stackOffset;
                cardNode.setPosition(x, y, 0);

                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);
            }

            log.debug(`[displayStack] Added ${maxStackDisplay} card backs (remaining: ${remainingCards}) at base offset (${baseOffset.x}, ${baseOffset.y})`);

            // 2. Create card count label if enabled
            if (this._showCardCount) {
                this.createCardCountLabel(remainingCards, baseOffset);
            }
        } else {
            log.debug(`[displayStack] No remaining cards to display (all ${cardCount} cards have been played)`);
        }

        // 3. If there are played cards, display them based on layout configuration
        if (this._playedCards.length > 0) {
            const layout = this._positionConfig?.playedCardLayout || PlayedCardLayout.HORIZONTAL;

            if (layout === PlayedCardLayout.VERTICAL) {
                this.displayPlayedCardsVertical();
            } else {
                this.displayPlayedCardsHorizontal();
            }
        }

        log.debug(`[displayStack] Total nodes: ${this._pokerNodes.length}`);
    }

    /**
     * Display played cards horizontally with overlap
     */
    private displayPlayedCardsHorizontal(): void {
        const playedCardSpacing = CardSpacing.playedCards.spacing;
        const playedCardWidth = CardDimensions.width;
        // 重叠显示：总宽度 = (卡片数-1) * 间距 + 卡片宽度
        const playedCardsWidth = (this._playedCards.length - 1) * playedCardSpacing + playedCardWidth;
        const playedStartX = -playedCardsWidth / 2 + playedCardWidth / 2;

        // Get the offset for played cards based on player position
        const offset = this.getPlayedCardOffset();

        log.debug(`[displayPlayedCardsHorizontal] Player ${this._player.name} (index ${this._playerIndex})`);
        log.debug(`[displayPlayedCardsHorizontal] Displaying ${this._playedCards.length} played cards:`, this._playedCards.map(c => '0x' + c.toString(16)));
        log.debug(`[displayPlayedCardsHorizontal] Offset: (${offset.x}, ${offset.y}), spacing: ${playedCardSpacing}`);

        for (let i = 0; i < this._playedCards.length; i++) {
            const cardValue = this._playedCards[i];
            log.debug(`[displayPlayedCardsHorizontal] Creating card ${i}: 0x${cardValue.toString(16)}`);
            const cardNode = this.createCardNode(cardValue, true, true); // Show front, is played card

            // 重叠显示：每张卡只偏移 playedCardSpacing 的距离
            const x = playedStartX + playedCardSpacing * i;
            const finalX = x + offset.x;
            const finalY = offset.y;

            cardNode.setPosition(finalX, finalY, 0);

            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);

            log.debug(`[displayPlayedCardsHorizontal] Card ${i} (0x${cardValue.toString(16)}): position (${finalX}, ${finalY})`);
        }
    }

    /**
     * Display played cards vertically stacked
     */
    private displayPlayedCardsVertical(): void {
        const verticalSpacing = CardSpacing.playedCards.spacing;
        const playedCardHeight = CardDimensions.height;
        // 竖向堆叠：总高度 = (卡片数-1) * 间距 + 卡片高度
        const playedCardsHeight = (this._playedCards.length - 1) * verticalSpacing + playedCardHeight;
        const playedStartY = playedCardsHeight / 2 - playedCardHeight / 2;

        // Get the offset for played cards based on player position
        const offset = this.getPlayedCardOffset();

        log.debug(`[displayPlayedCardsVertical] Player ${this._player.name} (index ${this._playerIndex})`);
        log.debug(`[displayPlayedCardsVertical] Displaying ${this._playedCards.length} played cards:`, this._playedCards.map(c => '0x' + c.toString(16)));
        log.debug(`[displayPlayedCardsVertical] Offset: (${offset.x}, ${offset.y}), spacing: ${verticalSpacing}`);

        for (let i = 0; i < this._playedCards.length; i++) {
            const cardValue = this._playedCards[i];
            log.debug(`[displayPlayedCardsVertical] Creating card ${i}: 0x${cardValue.toString(16)}`);
            const cardNode = this.createCardNode(cardValue, true, true); // Show front, is played card

            // 竖向堆叠：每张卡向下偏移 verticalSpacing 的距离
            const y = playedStartY - verticalSpacing * i;
            const finalX = offset.x;
            const finalY = y + offset.y;

            cardNode.setPosition(finalX, finalY, 0);

            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);

            log.debug(`[displayPlayedCardsVertical] Card ${i} (0x${cardValue.toString(16)}): position (${finalX}, ${finalY})`);
        }
    }

    /**
     * Create and display card count label at the top of the stack
     * @param cardCount Number of cards to display
     * @param baseOffset Base offset for positioning
     */
    private createCardCountLabel(cardCount: number, baseOffset: { x: number; y: number }): void {
        // Remove existing label if any
        if (this._cardCountLabel) {
            this._cardCountLabel.destroy();
            this._cardCountLabel = null;
        }

        // Create a new node for the label
        const labelNode = new Node('CardCountLabel');
        labelNode.layer = this.handContainer.layer;

        // Add UITransform first for proper sizing
        const uiTransform = labelNode.addComponent(UITransform);
        uiTransform.setContentSize(UISizes.cardCountLabel.width, UISizes.cardCountLabel.height);
        uiTransform.setAnchorPoint(0.5, 0.5);

        // Add Label component
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.string = cardCount.toString();
        label.fontSize = UIFonts.cardCount.fontSize;
        label.lineHeight = UIFonts.cardCount.lineHeight;
        label.color = UIColors.cardCount.text;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // Enable outline for better visibility
        label.enableOutline = true;
        label.outlineColor = UIColors.cardCount.outline;
        label.outlineWidth = UIFonts.cardCount.outlineWidth;

        // Position the label above the card stack
        const maxStackDisplay = Math.min(CardScale.stackDisplay.maxCards, cardCount);
        const stackOffset = CardScale.stackDisplay.offset;
        const topCardX = baseOffset.x + (maxStackDisplay - 1) * stackOffset;
        const topCardY = baseOffset.y + (maxStackDisplay - 1) * stackOffset;

        labelNode.setPosition(topCardX, topCardY, 0);

        // Add to container
        this.handContainer.addChild(labelNode);
        this._cardCountLabel = labelNode;

        log.debug(`[createCardCountLabel] Created label "${cardCount}" at position (${topCardX}, ${topCardY})`);
    }

    /**
     * 初始化手牌堆显示用于发牌动画（STACK模式）
     * 在发牌动画开始前调用，创建数字标签以便动画过程中逐张递增
     * startCount > 0 时立即显示牌背和数字；startCount === 0 时只创建标签（不显示牌背）
     * @param startCount 初始显示的手牌数量
     */
    public initStackForDealing(startCount: number): void {
        if (this._displayMode !== HandDisplayMode.STACK) return;

        this.clearCards();

        const baseOffset = this.getHandPileBaseOffset();
        const stackOffset = CardScale.stackDisplay.offset;

        if (startCount > 0) {
            // 补牌场景：创建与 displayStack 一致的堆叠牌背
            const maxStackDisplay = Math.min(CardScale.stackDisplay.maxCards, startCount);
            for (let i = 0; i < maxStackDisplay; i++) {
                const cardNode = this.createCardNode(0, false);
                cardNode.setPosition(baseOffset.x + i * stackOffset, baseOffset.y + i * stackOffset, 0);
                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);
            }
        } else {
            // 初始发牌：创建一张隐藏的牌背，等第一张牌到达时再显示
            const cardNode = this.createCardNode(0, false);
            cardNode.setPosition(baseOffset.x, baseOffset.y, 0);
            cardNode.active = false;
            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);
        }

        // 创建数字标签（startCount > 0 时显示数字，0 时创建但不可见）
        if (this._showCardCount) {
            this.createCardCountLabel(startCount > 0 ? startCount : 1, baseOffset);
            if (startCount === 0 && this._cardCountLabel) {
                this._cardCountLabel.active = false;
            }
        }

        log.debug(`[PlayerHandDisplay] initStackForDealing: startCount=${startCount}`);
    }

    /**
     * Update the card count label without re-rendering the entire display
     * Used during dealing animation to increment the count
     * Also grows the visual stack thickness
     * @param newCount New card count to display
     */
    public updateCardCountLabel(newCount: number): void {
        if (this._cardCountLabel) {
            // 首次更新时激活隐藏的标签和牌背（初始发牌 startCount=0 的场景）
            if (!this._cardCountLabel.active) {
                this._cardCountLabel.active = true;
                for (const node of this._pokerNodes) {
                    if (!node.active) {
                        node.active = true;
                    }
                }
            }
            const label = this._cardCountLabel.getComponent(Label);
            if (label) {
                label.string = newCount.toString();
            }
        }

        // 增加堆叠牌背节点以体现厚度变化
        const maxStackDisplay = CardScale.stackDisplay.maxCards;
        const currentStackNodes = this._pokerNodes.length;
        const targetStackNodes = Math.min(maxStackDisplay, newCount);
        if (targetStackNodes > currentStackNodes) {
            const baseOffset = this.getHandPileBaseOffset();
            const stackOffset = CardScale.stackDisplay.offset;
            for (let i = currentStackNodes; i < targetStackNodes; i++) {
                const cardNode = this.createCardNode(0, false);
                cardNode.setPosition(baseOffset.x + i * stackOffset, baseOffset.y + i * stackOffset, 0);
                this.handContainer.addChild(cardNode);
                this._pokerNodes.push(cardNode);
            }

            // 确保数字标签始终在最上层（牌背节点之上）
            if (this._cardCountLabel && this._cardCountLabel.parent) {
                this._cardCountLabel.setSiblingIndex(this._cardCountLabel.parent.children.length - 1);
            }
        }
    }

    /**
     * Create a poker card node
     * @param cardValue Card value
     * @param showFront Whether to show front or back
     * @param isPlayedCard Whether this is a played card (for separate scaling)
     */
    private createCardNode(cardValue: number, showFront: boolean, isPlayedCard: boolean = false): Node {
        const pokerNode = instantiate(this._pokerPrefab);
        const pokerCtrl = pokerNode.addComponent(Poker);

        // 如果是其他玩家（STACK模式），缩小卡牌（基于预制体原本缩放进行调整）
        if (this._displayMode === HandDisplayMode.STACK) {
            if (isPlayedCard) {
                // 出牌的缩放比例
                const scale = CardScale.stack.playedCards;
                pokerNode.setScale(pokerNode.scale.x * scale, pokerNode.scale.y * scale, 1);
            } else {
                // 手牌的缩放比例
                const scale = CardScale.stack.handCards;
                pokerNode.setScale(pokerNode.scale.x * scale, pokerNode.scale.y * scale, 1);
            }
        }

        // CRITICAL: Set the same layer as container for proper rendering
        // Must set layer for node AND all children recursively
        this.setNodeLayerRecursive(pokerNode, this.handContainer.layer);

        const pokerBack = this._pokerSprites.get(CardSpriteNames.back);

        if (showFront) {
            // Get sprite name for this card
            const spriteName = PokerFactory.getCardSpriteName(cardValue);
            const pokerFront = this._pokerSprites.get(spriteName);

            log.debug(`Creating card: ${spriteName}, found: ${pokerFront ? 'YES' : 'NO'}`);

            if (pokerFront) {
                pokerCtrl.init(cardValue, pokerBack, pokerFront);
                pokerCtrl.showFront();

                // Apply glow effect for main player (SPREAD mode)
                if (this._displayMode === HandDisplayMode.SPREAD && this._glowMaterial) {
                    pokerCtrl.setGlowMaterial(this._glowMaterial);
                    pokerCtrl.setGlowEnabled(true);
                }
            } else {
                log.warn(`Sprite not found: ${spriteName}`);
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

        // Clear card count label if exists
        if (this._cardCountLabel) {
            this._cardCountLabel.destroy();
            this._cardCountLabel = null;
        }
    }

    // ==================== Card Selection (Click Handling) ====================

    /**
     * Enable card selection (for player interaction)
     * @param callback Callback when selection changes
     */
    public enableCardSelection(callback: SelectionChangedCallback | null = null): void {
        if (this._displayMode !== HandDisplayMode.SPREAD) {
            log.warn('Card selection only available in SPREAD mode');
            return;
        }

        this._isInteractive = true;
        this._selectionChangedCallback = callback;

        // Enable click on all cards
        this._pokerComponents.forEach((poker, index) => {
            poker.enableClick(index, this.onCardClicked.bind(this));
        });

        log.debug(`Card selection enabled for ${this._player.name}`);
    }

    /**
     * Disable card selection
     */
    public disableCardSelection(): void {
        this._isInteractive = false;

        // Disable click on all cards
        this._pokerComponents.forEach(poker => poker.disableClick());

        this._selectedIndices.clear();
        log.debug(`Card selection disabled for ${this._player.name}`);
    }

    /**
     * Handle card click event
     */
    private onCardClicked(card: Poker, cardValue: number, cardIndex: number): void {
        log.debug(`Card clicked: index=${cardIndex}, value=${cardValue}, selected=${card.isSelected()}`);

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

        log.debug(`Selected cards: [${Array.from(this._selectedIndices).join(', ')}]`);
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

    /**
     * Lock unselected cards (dim them and disable interaction)
     * Call this after player has played their cards
     */
    public lockUnselectedCards(): void {
        log.debug(`[PlayerHandDisplay] Locking unselected cards for ${this._player.name}`);
        log.debug(`[PlayerHandDisplay] Selected indices: [${Array.from(this._selectedIndices).join(', ')}]`);

        // Disable all card interactions first
        this._isInteractive = false;

        // Dim unselected cards and disable their click handlers
        this._pokerComponents.forEach((poker, index) => {
            // Disable click on all cards
            poker.disableClick();

            // If card is NOT selected, dim it
            if (!this._selectedIndices.has(index)) {
                poker.setOpacity(CardOpacity.dimmed);
                log.debug(`[PlayerHandDisplay] Dimmed card at index ${index}`);
            } else {
                // Keep selected cards at full opacity
                poker.setOpacity(CardOpacity.normal);
                log.debug(`[PlayerHandDisplay] Kept card at index ${index} at full opacity`);
            }
        });

        log.debug(`[PlayerHandDisplay] Locked ${this._pokerComponents.length} cards`);
    }

    /**
     * Unlock all cards: restore normal opacity and clear selection
     */
    public unlockCards(): void {
        this._pokerComponents.forEach(poker => {
            poker.setOpacity(CardOpacity.normal);
        });
        this._selectedIndices.clear();
    }

    // ==================== Sorting Animation Support ====================

    /**
     * Get the world positions for sorted cards
     * @param sortedCards Array of sorted card values
     * @returns Array of world positions for each card
     */
    public getSortedCardPositions(sortedCards: number[]): Vec3[] {
        const positions: Vec3[] = [];
        const cardCount = sortedCards.length;
        const cardSpacing = this._cardSpacing;
        const cardWidth = CardDimensions.width;

        // Calculate positions same as displaySpreadSimple
        const totalWidth = (cardCount - 1) * cardSpacing + cardWidth;
        const startX = -totalWidth / 2 + cardWidth / 2;

        // Get container world position
        const containerWorldPos = new Vec3();
        this.handContainer.getWorldPosition(containerWorldPos);

        for (let i = 0; i < cardCount; i++) {
            const localX = startX + cardSpacing * i;
            const worldPos = new Vec3(
                containerWorldPos.x + localX,
                containerWorldPos.y,
                containerWorldPos.z
            );
            positions.push(worldPos);
        }

        return positions;
    }

    /**
     * Sort cards by value (for TheDecree mode)
     * Uses Ace-high ordering: 2, 3, 4, ..., K, A
     * Handles Guandan encoding where A=14, 2=15
     * @param cards Array of card values
     * @returns Sorted array of card values (ascending by point with Ace high, then by suit)
     */
    public static sortCards(cards: number[]): number[] {
        return [...cards].sort((a, b) => {
            let pointA = a & 0x0F;
            let pointB = b & 0x0F;

            // Convert Guandan encoding to Ace-high ranking
            // Guandan: A=14, 2=15 -> Ace-high: 2=2, A=14
            const rankA = PlayerHandDisplay.getAceHighRank(pointA);
            const rankB = PlayerHandDisplay.getAceHighRank(pointB);

            if (rankA !== rankB) {
                return rankA - rankB;
            }
            // Same point, sort by suit
            const suitA = (a & 0xF0) >> 4;
            const suitB = (b & 0xF0) >> 4;
            return suitA - suitB;
        });
    }

    /**
     * Convert card point to Ace-high rank for sorting
     * Handles both standard encoding (A=1) and Guandan encoding (A=14, 2=15)
     * @param point Card point value
     * @returns Rank value for Ace-high sorting (2=2, 3=3, ..., K=13, A=14)
     */
    private static getAceHighRank(point: number): number {
        // Guandan encoding: A=14, 2=15
        if (point === 14) return 14;  // A -> 14 (highest)
        if (point === 15) return 2;   // 2 -> 2 (lowest)
        // Standard encoding: A=1
        if (point === 1) return 14;   // A -> 14 (highest)
        // 3-13 stay the same
        return point;
    }

    /**
     * Get the hand container node (for animation positioning)
     */
    public getHandContainer(): Node {
        return this.handContainer;
    }

    /**
     * Get the current card spacing
     */
    public getCardSpacing(): number {
        return this._cardSpacing;
    }

    /**
     * Hide specific cards without re-layout (for refill animation)
     * Cards are hidden but their positions are preserved
     * @param cardsToHide Array of card values to hide
     * @returns Array of positions where cards were hidden (world coordinates)
     */
    public hideCardsWithoutRelayout(cardsToHide: number[]): Vec3[] {
        const hiddenPositions: Vec3[] = [];
        const cardsToHideCopy = [...cardsToHide];

        log.debug(`[PlayerHandDisplay] hideCardsWithoutRelayout: looking for ${cardsToHide.map(c => '0x' + c.toString(16)).join(',')}`);
        log.debug(`[PlayerHandDisplay] Current display has ${this._pokerNodes.length} nodes`);

        // Log all card values in the display
        const displayedCards: string[] = [];
        for (let i = 0; i < this._pokerNodes.length; i++) {
            const poker = this._pokerComponents[i];
            if (poker) {
                displayedCards.push('0x' + poker.getValue().toString(16));
            }
        }
        log.debug(`[PlayerHandDisplay] Displayed cards: ${displayedCards.join(',')}`);

        for (let i = 0; i < this._pokerNodes.length && cardsToHideCopy.length > 0; i++) {
            const poker = this._pokerComponents[i];
            if (poker) {
                const cardValue = poker.getValue();
                const idx = cardsToHideCopy.indexOf(cardValue);
                if (idx !== -1) {
                    // Record the world position before hiding
                    const worldPos = new Vec3();
                    this._pokerNodes[i].getWorldPosition(worldPos);
                    hiddenPositions.push(worldPos);

                    // Hide the card node
                    this._pokerNodes[i].active = false;

                    // Remove from the list to avoid duplicate matching
                    cardsToHideCopy.splice(idx, 1);
                }
            }
        }

        log.debug(`[PlayerHandDisplay] Hidden ${hiddenPositions.length} cards without relayout`);
        return hiddenPositions;
    }

    /**
     * Get the card values currently displayed
     * @returns Array of card values from the displayed poker nodes
     */
    public getDisplayedCardValues(): number[] {
        const values: number[] = [];
        for (let i = 0; i < this._pokerNodes.length; i++) {
            const poker = this._pokerComponents[i];
            if (poker) {
                values.push(poker.getValue());
            }
        }
        return values;
    }

    /**
     * Get positions of remaining visible cards (world coordinates)
     * @returns Array of world positions for visible cards
     */
    public getVisibleCardPositions(): Vec3[] {
        const positions: Vec3[] = [];
        for (const node of this._pokerNodes) {
            if (node.active) {
                const worldPos = new Vec3();
                node.getWorldPosition(worldPos);
                positions.push(worldPos);
            }
        }
        return positions;
    }

    /**
     * Get the poker nodes array (for animation)
     */
    public getPokerNodes(): Node[] {
        return this._pokerNodes;
    }

    /**
     * Set glow material and apply to all existing cards
     * Used for reconnect scenario where glow material may be loaded after cards are created
     * @param material The glow material to use
     */
    public setGlowMaterialAndApply(material: Material): void {
        if (!material) return;

        this._glowMaterial = material;

        // Only apply glow for main player (SPREAD mode)
        if (this._displayMode !== HandDisplayMode.SPREAD) return;

        // Apply glow to all existing poker components
        for (const poker of this._pokerComponents) {
            poker.setGlowMaterial(material);
            poker.setGlowEnabled(true);
        }

        log.debug(`[PlayerHandDisplay] Applied glow material to ${this._pokerComponents.length} cards`);
    }
}
