import { _decorator, Component, Node, instantiate, Prefab, UITransform, Vec3 } from 'cc';
import { Poker } from './Poker';
import { PokerFactory } from './PokerFactory';
import { Player } from '../Core/Player';
const { ccclass, property } = _decorator;

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
    private _pokerSprites: Map<string, any> = new Map();
    private _pokerPrefab: Prefab = null!;

    /**
     * Initialize the hand display
     */
    public init(player: Player, displayMode: HandDisplayMode, pokerSprites: Map<string, any>, pokerPrefab: Prefab): void {
        this._player = player;
        this._displayMode = displayMode;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

        // If handContainer not set, use current node
        if (!this.handContainer) {
            this.handContainer = this.node;
        }

        console.log(`PlayerHandDisplay initialized for ${player.name}, mode: ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'}, cards: ${player.handCards.length}`);
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
    }

    /**
     * Display cards spread out horizontally (for main player)
     */
    private displaySpread(cards: number[]): void {
        const cardCount = cards.length;
        const cardWidth = 140;  // Adjust based on your card sprite size
        const cardSpacing = 35; // Spacing between cards
        const totalWidth = (cardCount - 1) * cardSpacing + cardWidth;
        const startX = -totalWidth / 2 + cardWidth / 2;

        for (let i = 0; i < cardCount; i++) {
            const cardNode = this.createCardNode(cards[i], true);

            // Position card
            const x = startX + i * cardSpacing;
            cardNode.setPosition(x, 0, 0);

            this.handContainer.addChild(cardNode);
            this._pokerNodes.push(cardNode);
        }
    }

    /**
     * Display cards as a stack (for other players, showing backs)
     */
    private displayStack(cardCount: number): void {
        // Show a few stacked cards to indicate card count
        const maxStackDisplay = Math.min(5, cardCount); // Show max 5 cards in stack
        const stackOffset = 1; // Pixel offset for stacking effect

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

        return pokerNode;
    }

    /**
     * Clear all displayed cards
     */
    private clearCards(): void {
        this._pokerNodes.forEach(node => node.destroy());
        this._pokerNodes = [];
    }

    /**
     * Get card count
     */
    public get cardCount(): number {
        return this._player.handCards.length;
    }
}
