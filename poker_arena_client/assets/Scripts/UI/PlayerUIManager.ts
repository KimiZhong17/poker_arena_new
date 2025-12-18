import { _decorator, Component, Node, Prefab, SpriteFrame, Label, Sprite } from 'cc';
import { PlayerHandDisplay, HandDisplayMode, SelectionChangedCallback } from './PlayerHandDisplay';
import { GameController } from '../Core/GameController';
const { ccclass, property } = _decorator;

/**
 * PlayerUIManager - 统一管理所有玩家的UI
 *
 * 核心功能：
 * - 手牌显示 (PlayerHandDisplay)
 * - 玩家信息 (头像、名字、分数)
 * - Dealer 标识
 * - 倒计时显示（可选）
 *
 * 节点结构（每个手牌节点下）：
 * - BottomHand/LeftHand/TopLeftHand/TopRightHand/RightHand
 *   ├── Cards (手牌容器)
 *   ├── PlayerInfo (玩家信息容器)
 *   │   ├── NameLabel
 *   │   ├── ScoreLabel
 *   │   └── Avatar (optional)
 *   └── DealerIndicator (Dealer标识)
 */
@ccclass('PlayerUIManager')
export class PlayerUIManager extends Component {

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

    // Hand displays
    private _handDisplays: PlayerHandDisplay[] = [];
    private _gameController: GameController = null!;
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    // Player info UI nodes
    private _playerInfoNodes: Node[] = [];
    private _nameLabels: Label[] = [];
    private _scoreLabels: Label[] = [];
    private _avatarSprites: Sprite[] = [];

    // Dealer indicators
    private _dealerIndicators: Node[] = [];

    /**
     * Initialize the PlayerUIManager
     */
    public init(gameController: GameController, pokerSprites: Map<string, SpriteFrame>, pokerPrefab: Prefab): void {
        this._gameController = gameController;
        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

        this.setupHandDisplays();
        this.setupPlayerUINodes();
    }

    /**
     * Setup hand displays for all players
     */
    private setupHandDisplays(): void {
        const players = this._gameController.players;

        // Auto-find hand nodes if not assigned
        if (!this.bottomHandNode) {
            this.bottomHandNode = this.node.getChildByName("BottomHand")!;
        }
        if (!this.leftHandNode) {
            this.leftHandNode = this.node.getChildByName("LeftHand")!;
        }
        if (!this.topLeftHandNode) {
            this.topLeftHandNode = this.node.getChildByName("TopLeftHand")!;
        }
        if (!this.topRightHandNode) {
            this.topRightHandNode = this.node.getChildByName("TopRightHand")!;
        }
        if (!this.rightHandNode) {
            this.rightHandNode = this.node.getChildByName("RightHand")!;
        }

        // Map players to display positions
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
                console.warn(`[PlayerUIManager] Display node not assigned for player ${i}`);
                continue;
            }

            // Get or create container for cards
            let container = displayNode.getChildByName("Cards");
            if (!container) {
                container = displayNode.getChildByName("Container");
                if (!container) {
                    container = displayNode;
                }
            }

            // Main player shows spread cards, others show stack
            const displayMode = (i === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

            const handDisplay = container.addComponent(PlayerHandDisplay);
            handDisplay.handContainer = container;
            const levelRank = this._gameController.config?.levelRank || 0;
            handDisplay.init(player, displayMode, this._pokerSprites, this._pokerPrefab, levelRank, i);

            this._handDisplays.push(handDisplay);
        }

        console.log(`[PlayerUIManager] Setup ${this._handDisplays.length} hand displays`);
    }

    /**
     * Setup player UI nodes (name, score, avatar, dealer indicator)
     */
    private setupPlayerUINodes(): void {
        const displayNodes = [
            this.bottomHandNode,
            this.leftHandNode,
            this.topLeftHandNode,
            this.topRightHandNode,
            this.rightHandNode
        ];

        for (let i = 0; i < displayNodes.length; i++) {
            const handNode = displayNodes[i];
            if (!handNode) continue;

            // Find PlayerInfo container
            const playerInfo = handNode.getChildByName("PlayerInfo");
            if (playerInfo) {
                this._playerInfoNodes[i] = playerInfo;

                // Find child components
                const nameLabel = playerInfo.getChildByName("NameLabel")?.getComponent(Label);
                const scoreLabel = playerInfo.getChildByName("ScoreLabel")?.getComponent(Label);
                const avatar = playerInfo.getChildByName("Avatar")?.getComponent(Sprite);

                if (nameLabel) this._nameLabels[i] = nameLabel;
                if (scoreLabel) this._scoreLabels[i] = scoreLabel;
                if (avatar) this._avatarSprites[i] = avatar;
            }

            // Find DealerIndicator
            const dealerIndicator = handNode.getChildByName("DealerIndicator");
            if (dealerIndicator) {
                this._dealerIndicators[i] = dealerIndicator;
                dealerIndicator.active = false; // Hide by default
            }
        }

        console.log(`[PlayerUIManager] Setup UI nodes for ${this._playerInfoNodes.length} players`);
    }

    // ==================== Hand Display Methods ====================

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
    public updatePlayerHand(playerIndex: number, playedCards: number[] = []): void {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            this._handDisplays[playerIndex].updateDisplay(playedCards);
        }
    }

    /**
     * Get player hand display component
     */
    public getPlayerHandDisplay(playerIndex: number): PlayerHandDisplay | null {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            return this._handDisplays[playerIndex];
        }
        return null;
    }

    // ==================== Card Selection ====================

    /**
     * Enable card selection for a player
     */
    public enableCardSelection(playerIndex: number, callback: SelectionChangedCallback | null = null): void {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            this._handDisplays[playerIndex].enableCardSelection(callback);
        }
    }

    /**
     * Disable card selection for a player
     */
    public disableCardSelection(playerIndex: number): void {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            this._handDisplays[playerIndex].disableCardSelection();
        }
    }

    /**
     * Get selected card indices for a player
     */
    public getSelectedIndices(playerIndex: number): number[] {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            return this._handDisplays[playerIndex].getSelectedIndices();
        }
        return [];
    }

    /**
     * Clear selection for a player
     */
    public clearSelection(playerIndex: number): void {
        if (playerIndex >= 0 && playerIndex < this._handDisplays.length) {
            this._handDisplays[playerIndex].clearSelection();
        }
    }

    // ==================== Player Info Management ====================

    /**
     * Set player info (name, score)
     * @param playerIndex Player index
     * @param name Player name
     * @param score Player score (default: 0)
     */
    public setPlayerInfo(playerIndex: number, name: string, score: number = 0): void {
        if (playerIndex < 0 || playerIndex >= this._nameLabels.length) return;

        // Update name
        if (this._nameLabels[playerIndex]) {
            this._nameLabels[playerIndex].string = name;
        }

        // Update score
        if (this._scoreLabels[playerIndex]) {
            this._scoreLabels[playerIndex].string = `分数: ${score}`;
        }

        console.log(`[PlayerUIManager] Set player info for index ${playerIndex}: ${name}, score: ${score}`);
    }

    /**
     * Update player score
     */
    public updatePlayerScore(playerIndex: number, score: number): void {
        if (playerIndex < 0 || playerIndex >= this._scoreLabels.length) return;

        if (this._scoreLabels[playerIndex]) {
            this._scoreLabels[playerIndex].string = `分数: ${score}`;
        }
    }

    /**
     * Batch update all player scores
     */
    public updateAllScores(scores: number[]): void {
        for (let i = 0; i < scores.length && i < this._scoreLabels.length; i++) {
            this.updatePlayerScore(i, scores[i]);
        }
    }

    // ==================== Dealer Indicator Management ====================

    /**
     * Show dealer indicator for a specific player
     */
    public showDealer(dealerIndex: number): void {
        // Hide all dealers first
        this.hideAllDealers();

        // Show the specified dealer
        if (dealerIndex >= 0 && dealerIndex < this._dealerIndicators.length) {
            const indicator = this._dealerIndicators[dealerIndex];
            if (indicator) {
                indicator.active = true;
                console.log(`[PlayerUIManager] Showing dealer for player ${dealerIndex}`);
            }
        }
    }

    /**
     * Hide all dealer indicators
     */
    public hideAllDealers(): void {
        this._dealerIndicators.forEach(indicator => {
            if (indicator) {
                indicator.active = false;
            }
        });
    }

    // ==================== Utility Methods ====================

    /**
     * Get hand node by player index
     */
    public getHandNode(playerIndex: number): Node | null {
        const nodes = [
            this.bottomHandNode,
            this.leftHandNode,
            this.topLeftHandNode,
            this.topRightHandNode,
            this.rightHandNode
        ];
        return nodes[playerIndex] || null;
    }

    /**
     * Get world position of a player's hand node (useful for animations)
     */
    public getHandWorldPosition(playerIndex: number): { x: number, y: number } | null {
        const handNode = this.getHandNode(playerIndex);
        if (!handNode) return null;

        const worldPos = handNode.getWorldPosition();
        return { x: worldPos.x, y: worldPos.y };
    }

    /**
     * Get all hand nodes (useful for batch operations)
     */
    public getAllHandNodes(): Node[] {
        return [
            this.bottomHandNode,
            this.leftHandNode,
            this.topLeftHandNode,
            this.topRightHandNode,
            this.rightHandNode
        ].filter(node => node !== null);
    }

    /**
     * Get player count (number of active player UIs)
     */
    public getPlayerCount(): number {
        return this._handDisplays.length;
    }

    /**
     * Check if player UI is set up for a specific index
     */
    public hasPlayerUI(playerIndex: number): boolean {
        return playerIndex >= 0 &&
               playerIndex < this._handDisplays.length &&
               this._handDisplays[playerIndex] !== null;
    }

    /**
     * Clear all player UI
     */
    public clearAll(): void {
        // Clear name labels
        this._nameLabels.forEach(label => {
            if (label) label.string = "";
        });

        // Clear score labels
        this._scoreLabels.forEach(label => {
            if (label) label.string = "";
        });

        // Hide all dealers
        this.hideAllDealers();
    }
}
