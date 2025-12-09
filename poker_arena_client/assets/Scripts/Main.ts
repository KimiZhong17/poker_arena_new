import { _decorator, AssetManager, assetManager, Component, Node, Prefab, SpriteAtlas, SpriteFrame } from 'cc';
import { PokerFactory } from './UI/PokerFactory';
import { GameController } from './Core/GameController';
import { GameHandsManager } from './UI/GameHandsManager';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {

    @property(Node)
    public gameControllerNode: Node = null!;

    @property(Node)
    public handsManagerNode: Node = null!;

    private _gameController: GameController = null!;
    private _handsManager: GameHandsManager = null!;
    private _pokerBundle: AssetManager.Bundle = null;
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    public onLoad(): void {
        console.log("Main onLoad");

        // Initialize GameController
        if (this.gameControllerNode) {
            this._gameController = this.gameControllerNode.getComponent(GameController);
            if (!this._gameController) {
                this._gameController = this.gameControllerNode.addComponent(GameController);
            }
        } else {
            // If no node assigned, add to current node
            this._gameController = this.node.addComponent(GameController);
        }

        assetManager.loadBundle("Pokers", (err, bundle) => {
            if (err) {
                console.error(err);
                return;
            }
            this._pokerBundle = bundle;
            console.log("Poker bundle loaded.");

            this._onLoadPokerAtlas();
            this._onLoadPokerPrefab();
        });
    }

    start() {

    }

    update(deltaTime: number) {

    }

    private _onLoadPokerAtlas(): void {
        this._pokerBundle.loadDir("", SpriteFrame, (err, sprites) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("所有扑克牌 SpriteFrame 加载完毕", sprites);
            sprites.forEach((sprite) => {
                this._pokerSprites.set(sprite.name, sprite);
            });
            this._checkAllLoaded();
        });
    }

    private _onLoadPokerPrefab(): void {
        this._pokerBundle.load("PokerPrefab", Prefab, (err, prefab) => {
            if (err) {
                console.error(err);
                return;
            }
            this._pokerPrefab = prefab;
            console.log("Poker prefab loaded.");
            this._checkAllLoaded();
        });
    }

    private _checkAllLoaded(): void {
        console.log(this._pokerBundle, this._pokerSprites.size, this._pokerPrefab);
        if (this._pokerBundle && this._pokerSprites.size > 0 && this._pokerPrefab) {
            this._enterGame();
        }
    }

    private _enterGame(): void {
        console.log("Entering game...");
        this.node.addComponent(PokerFactory).init(this._pokerSprites, this._pokerPrefab);

        // Initialize hands manager - create if not exists
        if (!this.handsManagerNode) {
            // Create HandsManager node structure automatically
            this.handsManagerNode = this.createHandsManagerStructure();
        }

        this._handsManager = this.handsManagerNode.getComponent(GameHandsManager);
        if (!this._handsManager) {
            this._handsManager = this.handsManagerNode.addComponent(GameHandsManager);
        }

        // Start the game flow
        this.startGameFlow();
    }

    /**
     * Create hands manager node structure automatically
     */
    private createHandsManagerStructure(): Node {
        // Find existing PokerRoot - it should be under the Main node (this.node)
        let pokerRoot = this.node.getChildByName("PokerRoot");

        if (!pokerRoot) {
            console.warn("PokerRoot not found under Main node, creating new one");
            pokerRoot = new Node("PokerRoot");
            this.node.addChild(pokerRoot);
        }

        console.log("PokerRoot found, current sibling index:", pokerRoot.getSiblingIndex());
        console.log("PokerRoot parent:", pokerRoot.parent?.name);
        console.log("PokerRoot siblings:", pokerRoot.parent?.children.map(c => c.name));

        // Create HandsManager node
        const handsManagerNode = new Node("HandsManager");
        pokerRoot.addChild(handsManagerNode);

        console.log("HandsManager added to PokerRoot");

        // Make sure PokerRoot is the last child of Main (rendered on top)
        const siblingCount = this.node.children.length;
        pokerRoot.setSiblingIndex(siblingCount - 1);
        console.log("PokerRoot moved to index:", pokerRoot.getSiblingIndex(), "out of", siblingCount);

        // Create hand container nodes with positions
        const handNodes = [
            { name: "BottomHand", x: 0, y: -280 },      // Main player
            { name: "LeftHand", x: -550, y: 50 },        // Left player
            { name: "TopLeftHand", x: -300, y: 280 },   // Top left
            { name: "TopRightHand", x: 300, y: 280 },   // Top right
            { name: "RightHand", x: 550, y: 50 }         // Right player
        ];

        handNodes.forEach(config => {
            const handNode = new Node(config.name);
            handNode.setPosition(config.x, config.y, 0);

            // Create container child node
            const container = new Node("Container");
            handNode.addChild(container);

            handsManagerNode.addChild(handNode);
        });

        console.log("HandsManager structure created automatically");
        return handsManagerNode;
    }

    /**
     * Start game flow: Initialize -> Deal -> Boss Collect -> Play
     */
    private startGameFlow(): void {
        console.log("=== Starting Game Flow ===");

        // Step 1: Initialize game
        this._gameController.init({
            playerCount: 5,
            deckCount: 3,
            cardsPerPlayer: 31,
            levelRank: 15  // 15 represents card "2" (P_2 = 15 in CardPoint enum)
        });

        // Step 2: Create players
        const playerNames = [
            'You (Boss)',  // Player 0 is the main player (Boss)
            'Player 2',
            'Player 3',
            'Player 4',
            'Player 5'
        ];
        this._gameController.createPlayers(playerNames);

        // Step 3: Start game (deals cards automatically)
        this._gameController.startGame();

        // Initialize hands manager with game controller
        this._handsManager.init(this._gameController, this._pokerSprites, this._pokerPrefab);

        // Display all players' initial hands
        this._handsManager.updateAllHands();

        // At this point, game is in BOSS_COLLECT phase
        console.log(`Game Phase: BOSS_COLLECT`);
        console.log(`Remaining cards: ${this._gameController.remainingCards.length}`);
        console.log(`Boss: ${this._gameController.bossPlayer.name}`);

        // Step 4: Boss collects cards (you can trigger this with a button later)
        // For now, let's do it automatically after a delay
        this.scheduleOnce(() => {
            this.bossCollectCards();
        }, 2);
    }

    /**
     * Boss collects cards (can be called by UI button)
     */
    public bossCollectCards(): void {
        console.log("=== Boss Collecting Cards ===");

        this._gameController.bossCollectCards();

        // Update boss's hand display (player 0)
        this._handsManager.updatePlayerHand(0);

        // Game is now in PLAYING phase
        console.log(`Game Phase: PLAYING`);
        console.log(`Boss has ${this._gameController.bossPlayer.handCards.length} cards`);
        console.log(`Burned cards: ${this._gameController.burnedCards.length}`);
        console.log(`Current player: ${this._gameController.currentPlayer.name}`);

        // Now you can start playing
        // Players can call: this._gameController.playCards() or this._gameController.pass()
    }

    /**
     * Get game controller (for external access)
     */
    public get gameController(): GameController {
        return this._gameController;
    }

}
