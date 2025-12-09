import { _decorator, Component, Node, Prefab, SpriteFrame } from 'cc';
import { PlayerHandDisplay, HandDisplayMode } from './PlayerHandDisplay';
import { GameController } from '../Core/GameController';
const { ccclass, property } = _decorator;

/**
 * Manages all players' hand displays
 * Layout: Bottom = Main player, Left/Right = 2 players each, Top = 2 players
 */
@ccclass('GameHandsManager')
export class GameHandsManager extends Component {

    @property(Node)
    public bottomHandNode: Node = null!;  // Main player (you)

    @property(Node)
    public leftHandNode: Node = null!;    // Left player

    @property(Node)
    public rightHandNode: Node = null!;   // Right player

    @property(Node)
    public topLeftHandNode: Node = null!;  // Top left player

    @property(Node)
    public topRightHandNode: Node = null!; // Top right player

    private _handDisplays: PlayerHandDisplay[] = [];
    private _gameController: GameController = null!;
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    /**
     * Initialize the hands manager
     */
    public init(gameController: GameController, pokerSprites: Map<string, SpriteFrame>, pokerPrefab: Prefab): void {
        this._gameController = gameController;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

        this.setupHandDisplays();
    }

    /**
     * Setup hand displays for all players
     */
    private setupHandDisplays(): void {
        const players = this._gameController.players;

        // Auto-find hand nodes if not assigned
        if (!this.bottomHandNode) {
            this.bottomHandNode = this.node.getChildByName("BottomHand");
        }
        if (!this.leftHandNode) {
            this.leftHandNode = this.node.getChildByName("LeftHand");
        }
        if (!this.topLeftHandNode) {
            this.topLeftHandNode = this.node.getChildByName("TopLeftHand");
        }
        if (!this.topRightHandNode) {
            this.topRightHandNode = this.node.getChildByName("TopRightHand");
        }
        if (!this.rightHandNode) {
            this.rightHandNode = this.node.getChildByName("RightHand");
        }

        // Map players to display positions
        // Player 0 (main player/boss) -> Bottom
        // Player 1 -> Left
        // Player 2 -> Top Left
        // Player 3 -> Top Right
        // Player 4 -> Right

        const displayNodes = [
            this.bottomHandNode,      // Player 0 (You)
            this.leftHandNode,        // Player 1
            this.topLeftHandNode,     // Player 2
            this.topRightHandNode,    // Player 3
            this.rightHandNode        // Player 4
        ];

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const displayNode = displayNodes[i];

            if (!displayNode) {
                console.warn(`Display node not assigned for player ${i}`);
                continue;
            }

            // Get or create container
            let container = displayNode.getChildByName("Container");
            if (!container) {
                container = displayNode;
            }

            // Main player shows spread cards, others show stack
            const displayMode = (i === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

            const handDisplay = container.addComponent(PlayerHandDisplay);
            handDisplay.handContainer = container;
            const levelRank = this._gameController.config?.levelRank || 0;
            handDisplay.init(player, displayMode, this._pokerSprites, this._pokerPrefab, levelRank);

            this._handDisplays.push(handDisplay);
        }

        console.log(`Setup ${this._handDisplays.length} hand displays`);
    }

    /**
     * Update all hand displays
     */
    public updateAllHands(): void {
        this._handDisplays.forEach(display => {
            display.updateDisplay();
        });
    }

    /**
     * Update a specific player's hand
     */
    public updatePlayerHand(playerIndex: number): void {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            this._handDisplays[playerIndex].updateDisplay();
        }
    }
}
