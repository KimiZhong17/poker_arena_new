import { _decorator, AssetManager, assetManager, Component, Node, Prefab, SpriteFrame, instantiate, Vec3, Button } from 'cc';
import { PokerFactory } from './UI/PokerFactory';
import { GameController } from './Core/GameController';
import { GameHandsManager } from './UI/GameHandsManager';
import { SceneManager } from './Manager/SceneManager';
import { GameModeFactory } from './Core/GameMode/GameModeFactory';
import { GameModeBase } from './Core/GameMode/GameModeBase';
import { TheDecreeMode } from './Core/GameMode/TheDecreeMode';
import { Player } from './Core/Player';
import { Poker } from './UI/Poker';
import { GameStage } from './Core/GameStage';
const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {

    @property(Node)
    public gameControllerNode: Node = null!;

    @property(Node)
    public handsManagerNode: Node = null!;

    // Game mode specific containers
    @property(Node)
    public objectsGuandanNode: Node = null!;

    @property(Node)
    public objectsTheDecreeNode: Node = null!;

    @property(Node)
    public nodeReadyStage: Node = null!;

    @property(Button)
    public btnStart: Button = null!;

    // Specific UI/Gameplay nodes (optional - can access via children)
    @property(Node)
    public communityCardsNode: Node = null!;

    // @property(Node)
    // public dealerCallPanelNode: Node = null!;

    private _gameController: GameController = null!;
    private _handsManager: GameHandsManager = null!;
    private _pokerBundle: AssetManager.Bundle = null;
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    // Game configuration from scene transition
    private _gameMode: string = '';
    private _roomId: string = '';
    private _currentStage: GameStage = GameStage.READY;

    // The Decree mode instance (only used when playing The Decree)
    private _theDecreeMode: TheDecreeMode | null = null;

    public onLoad(): void {
        console.log("Main onLoad");

        // Get game configuration from scene transition
        const sceneManager = SceneManager.getInstance();
        const transitionData = sceneManager.getTransitionData<{
            roomId: string;
            gameMode: string;
        }>();

        this._gameMode = transitionData.gameMode || 'guandan';
        this._roomId = transitionData.roomId || 'default_room';

        console.log(`[Game] Game Mode: ${this._gameMode}, Room ID: ${this._roomId}`);

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

        // Auto-find nodes if not manually assigned
        this.autoFindNodes();

        // Initialize hands manager - create if not exists
        if (!this.handsManagerNode) {
            // Create HandsManager node structure automatically
            this.handsManagerNode = this.createHandsManagerStructure();
        }

        this._handsManager = this.handsManagerNode.getComponent(GameHandsManager);
        if (!this._handsManager) {
            this._handsManager = this.handsManagerNode.addComponent(GameHandsManager);
        }

        // Setup button events
        this.setupButtonEvents();

        // Enter ready stage (don't start game yet)
        this.enterReadyStage();
    }

    // ==================== Stage Management ====================

    /**
     * Enter Ready Stage
     */
    private enterReadyStage(): void {
        console.log("=== Entering Ready Stage ===");
        this._currentStage = GameStage.READY;

        // Show ready stage UI
        if (this.nodeReadyStage) {
            this.nodeReadyStage.active = true;
        }

        // Hide game mode specific UI
        if (this.objectsGuandanNode) {
            this.objectsGuandanNode.active = false;
        }
        if (this.objectsTheDecreeNode) {
            this.objectsTheDecreeNode.active = false;
        }

        console.log("[Ready Stage] Waiting for players to ready up...");
    }

    /**
     * Enter Playing Stage
     */
    private enterPlayingStage(): void {
        console.log("=== Entering Playing Stage ===");
        this._currentStage = GameStage.PLAYING;

        // Hide ready stage UI
        if (this.nodeReadyStage) {
            this.nodeReadyStage.active = false;
        }

        // Start the actual game
        this.startGameFlow();
    }

    /**
     * Enter End Stage
     */
    private enterEndStage(): void {
        console.log("=== Entering End Stage ===");
        this._currentStage = GameStage.END;

        // Show end game UI
        // TODO: Add end game UI logic here

        console.log("[End Stage] Game finished!");
    }

    /**
     * Get current stage
     */
    public getCurrentStage(): GameStage {
        return this._currentStage;
    }

    // ==================== Button Event Handlers ====================

    /**
     * Setup button events
     */
    private setupButtonEvents(): void {
        // Auto-find start button if not assigned
        if (!this.btnStart && this.nodeReadyStage) {
            const btnNode = this.nodeReadyStage.getChildByName('btn_start');
            if (btnNode) {
                this.btnStart = btnNode.getComponent(Button);
            }
        }

        // Register start button click event
        if (this.btnStart) {
            this.btnStart.node.on(Button.EventType.CLICK, this.onStartButtonClicked, this);
            console.log('[Game] Start button registered');
        } else {
            console.warn('[Game] Start button not found!');
        }
    }

    /**
     * Handle start button clicked
     * TODO: Add multiplayer ready logic when implementing networking
     */
    private onStartButtonClicked(): void {
        console.log('[Game] Start button clicked');

        if (this._currentStage !== GameStage.READY) {
            console.warn('[Game] Cannot start - not in ready stage');
            return;
        }

        // TODO: In multiplayer, check if all players are ready
        // For now, just start the game immediately
        this.enterPlayingStage();
    }

    // ==================== Node Finding ====================

    /**
     * Auto-find nodes by name if not manually assigned
     */
    private autoFindNodes(): void {
        // Auto-find ReadyStageNode
        if (!this.nodeReadyStage) {
            this.nodeReadyStage = this.findNodeByName(this.node, 'Node_ReadyStage');
        }

        // Auto-find CommunityCardsNode (may be nested deep)
        if (!this.communityCardsNode) {
            this.communityCardsNode = this.findNodeByName(this.node, 'CommunityCardsNode');
            if (this.communityCardsNode) {
                console.log('[Game] Auto-found CommunityCardsNode');
            }
        }

        // Auto-find ObjectTheDecreeNode
        if (!this.objectsTheDecreeNode) {
            this.objectsTheDecreeNode = this.findNodeByName(this.node, 'ObjectTheDecreeNode');
            if (this.objectsTheDecreeNode) {
                console.log('[Game] Auto-found ObjectTheDecreeNode');
            }
        }

        // Auto-find ObjectGuandanNode
        if (!this.objectsGuandanNode) {
            this.objectsGuandanNode = this.findNodeByName(this.node, 'ObjectGuandanNode');
            if (this.objectsGuandanNode) {
                console.log('[Game] Auto-found ObjectGuandanNode');
            }
        }
    }

    /**
     * Recursively find a node by name in the entire tree
     * @param root Root node to start searching from
     * @param name Node name to find
     * @returns Found node or null
     */
    private findNodeByName(root: Node, name: string): Node | null {
        // Check current node
        if (root.name === name) {
            return root;
        }

        // Search in children
        for (const child of root.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * Create hands manager node structure automatically
     */
    private createHandsManagerStructure(): Node {
        // Find existing HoleCards - it should be under the Main node (this.node)
        let holeCards = this.node.getChildByName("HoleCards");

        if (!holeCards) {
            console.warn("HoleCards not found under Main node, creating new one");
            holeCards = new Node("HoleCards");
            this.node.addChild(holeCards);
        }

        console.log("HoleCards found, current sibling index:", holeCards.getSiblingIndex());
        console.log("HoleCards parent:", holeCards.parent?.name);
        console.log("HoleCards siblings:", holeCards.parent?.children.map(c => c.name));

        // Create HandsManager node
        const handsManagerNode = new Node("HandsManager");
        holeCards.addChild(handsManagerNode);

        console.log("HandsManager added to HoleCards");

        // Make sure HoleCards is the last child of Main (rendered on top)
        const siblingCount = this.node.children.length;
        holeCards.setSiblingIndex(siblingCount - 1);
        console.log("HoleCards moved to index:", holeCards.getSiblingIndex(), "out of", siblingCount);

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
     * Start game flow: Initialize -> Deal -> Play
     * Routes to different game modes based on configuration
     */
    private startGameFlow(): void {
        console.log("=== Starting Game Flow ===");
        console.log(`Game Mode: ${this._gameMode}`);

        // Route to appropriate game mode
        if (this._gameMode === 'the_decree') {
            this.startTheDecreeFlow();
        } else {
            this.startGuandanFlow();
        }
    }

    /**
     * Start The Decree game flow
     */
    private startTheDecreeFlow(): void {
        console.log("=== Starting The Decree Flow ===");

        // Hide 5th player position for The Decree (4 players max)
        this.setupTheDecreeUI();

        // Create The Decree mode instance
        this._theDecreeMode = new TheDecreeMode();

        // Initialize with 4 players
        const playerIds = ['player_0', 'player_1', 'player_2', 'player_3'];
        this._theDecreeMode.initGame(playerIds);

        // Deal cards
        this._theDecreeMode.dealCards();

        console.log('[The Decree] Game initialized');
        console.log('[The Decree] Community Cards:', this._theDecreeMode.getCommunityCards());
        console.log('[The Decree] Deck Size:', this._theDecreeMode.getDeckSize());

        // Display player hands
        console.log('\n=== Player Hands ===');
        for (let i = 0; i < 4; i++) {
            const playerId = `player_${i}`;
            const hand = this.getPlayerHand(playerId);
            console.log(`${playerId}: ${hand.length} cards`);
        }

        // Initialize and display hands using adapter
        this.initializeTheDecreeHandsDisplay();

        // Display community cards
        this.displayCommunityCards();

        // Enable card selection for player 0 after a short delay
        this.scheduleOnce(() => {
            console.log('[The Decree] Enabling card selection for player 0');
            this._handsManager.enableCardSelection(0, (selectedIndices) => {
                console.log(`[The Decree] Player 0 selected cards: [${selectedIndices.join(', ')}]`);
            });
        }, 1);
    }

    /**
     * Start Guandan game flow (existing implementation)
     */
    private startGuandanFlow(): void {
        console.log("=== Starting Guandan Flow ===");

        // Ensure all player positions are visible
        this.setupGuandanUI();

        // Guandan configuration: 5 players
        const playerCount = 5;
        const deckCount = 3;
        const cardsPerPlayer = 31;
        const levelRank = 15; // Card "2"
        const playerNames = [
            'You (Boss)',
            'Player 2',
            'Player 3',
            'Player 4',
            'Player 5'
        ];

        console.log('[Game] Initializing Guandan mode');

        // Step 1: Initialize game
        this._gameController.init({
            playerCount: playerCount,
            deckCount: deckCount,
            cardsPerPlayer: cardsPerPlayer,
            levelRank: levelRank
        });

        // Step 2: Create players
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
     * Setup UI for The Decree (hide 5th player, show community cards area)
     */
    private setupTheDecreeUI(): void {
        console.log('[UI] Setting up The Decree UI');

        // Hide Guandan objects
        if (this.objectsGuandanNode) {
            this.objectsGuandanNode.active = false;
            console.log('[UI] Hidden Guandan objects');
        }

        // Show The Decree objects
        if (this.objectsTheDecreeNode) {
            this.objectsTheDecreeNode.active = true;
            console.log('[UI] Showing The Decree objects');
        }

        // Community cards will be shown by TheDecreeCommunityCardsDisplay component
        if (this.communityCardsNode) {
            this.communityCardsNode.active = true;
            console.log('[UI] Showing Community Cards area');
        }

        // Adjust player positions for The Decree (4 players)
        this.adjustPlayerPositionsForTheDecree();
    }

    /**
     * Adjust player hand positions for The Decree layout (4 players)
     */
    private adjustPlayerPositionsForTheDecree(): void {
        if (!this.handsManagerNode) return;

        // The Decree: 4 players in diamond formation
        const positions: Array<{ name: string; x: number; y: number; active: boolean }> = [
            { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
            { name: 'LeftHand', x: -450, y: 0, active: true },        // Player 1 (Left)
            { name: 'TopLeftHand', x: 0, y: 280, active: true },      // Player 2 (Top) - centered
            { name: 'TopRightHand', x: 450, y: 0, active: true },     // Player 3 (Right)
            { name: 'RightHand', x: 550, y: 50, active: false }       // Hidden for The Decree
        ];

        for (const config of positions) {
            const handNode = this.handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                if (config.active) {
                    handNode.setPosition(config.x, config.y, 0);
                }
            }
        }

        console.log('[UI] Adjusted player positions for The Decree (4 players)');
    }

    /**
     * Setup UI for Guandan (show all 5 players)
     */
    private setupGuandanUI(): void {
        console.log('[UI] Setting up Guandan UI');

        // Show Guandan objects
        if (this.objectsGuandanNode) {
            this.objectsGuandanNode.active = true;
            console.log('[UI] Showing Guandan objects');
        }

        // Hide The Decree objects
        if (this.objectsTheDecreeNode) {
            this.objectsTheDecreeNode.active = false;
            console.log('[UI] Hidden The Decree objects');
        }

        // Hide community cards area (The Decree only)
        if (this.communityCardsNode) {
            this.communityCardsNode.active = false;
            console.log('[UI] Hidden Community Cards area');
        }

        // Restore player positions for Guandan (5 players)
        this.adjustPlayerPositionsForGuandan();
    }

    /**
     * Adjust player hand positions for Guandan layout (5 players)
     */
    private adjustPlayerPositionsForGuandan(): void {
        if (!this.handsManagerNode) return;

        // Guandan: 5 players layout
        const positions: Array<{ name: string; x: number; y: number; active: boolean }> = [
            { name: 'BottomHand', x: 0, y: -280, active: true },          // Player 0 (Main player)
            { name: 'LeftHand', x: -550, y: 50, active: true },           // Player 1 (Left)
            { name: 'TopLeftHand', x: -300, y: 280, active: true },       // Player 2 (Top Left)
            { name: 'TopRightHand', x: 300, y: 280, active: true },       // Player 3 (Top Right)
            { name: 'RightHand', x: 550, y: 50, active: true }            // Player 4 (Right)
        ];

        for (const config of positions) {
            const handNode = this.handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                handNode.setPosition(config.x, config.y, 0);
            }
        }

        console.log('[UI] Adjusted player positions for Guandan (5 players)');
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

    /**
     * Get hands manager (for external access)
     */
    public get handsManager(): GameHandsManager {
        return this._handsManager;
    }

    // ==================== The Decree Game Interfaces ====================

    /**
     * Get The Decree mode instance
     */
    public get theDecreeMode(): TheDecreeMode | null {
        return this._theDecreeMode;
    }

    /**
     * Get community cards (4 cards shared by all players)
     */
    public getCommunityCards(): number[] {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return [];
        }
        return this._theDecreeMode.getCommunityCards();
    }

    /**
     * Get a player's hand cards (5 cards)
     * @param playerId Player ID (e.g., 'player_0')
     */
    public getPlayerHand(playerId: string): number[] {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return [];
        }
        const playerState = this._theDecreeMode.getPlayerState(playerId);
        return playerState ? playerState.hand : [];
    }

    /**
     * Get all players' scores
     */
    public getPlayerScores(): Map<string, number> {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return new Map();
        }
        return this._theDecreeMode.getScores();
    }

    /**
     * Get current game state
     */
    public getTheDecreeState(): string {
        if (!this._theDecreeMode) {
            return 'NOT_INITIALIZED';
        }
        return this._theDecreeMode.getState();
    }

    /**
     * Get current round information
     */
    public getCurrentRound(): any {
        if (!this._theDecreeMode) {
            return null;
        }
        return this._theDecreeMode.getCurrentRound();
    }

    /**
     * Phase 1: Select first dealer by revealing one card from each player
     * @param revealedCards Map of playerId -> card index (0-4)
     * @returns The dealer's player ID
     */
    public selectFirstDealer(revealedCards: Map<string, number>): string {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return '';
        }

        // Convert card indices to actual cards
        const cardMap = new Map<string, number>();
        for (const [playerId, cardIndex] of revealedCards) {
            const playerState = this._theDecreeMode.getPlayerState(playerId);
            if (playerState && cardIndex >= 0 && cardIndex < playerState.hand.length) {
                cardMap.set(playerId, playerState.hand[cardIndex]);
            }
        }

        const dealerId = this._theDecreeMode.selectFirstDealer(cardMap);
        console.log(`[The Decree] First dealer selected: ${dealerId}`);

        // Start first round
        this._theDecreeMode.startNewRound(dealerId);

        return dealerId;
    }

    /**
     * Phase 2: Dealer calls how many cards to play (1, 2, or 3)
     * @param cardsToPlay Number of cards (1, 2, or 3)
     * @returns Success status
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): boolean {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return false;
        }

        const success = this._theDecreeMode.dealerCall(cardsToPlay);
        if (success) {
            console.log(`[The Decree] Dealer called: ${cardsToPlay} cards to play`);
        } else {
            console.error('[The Decree] Failed to call. Wrong game state.');
        }

        return success;
    }

    /**
     * Universal interface: Player selects cards to play
     * Routes to appropriate game mode implementation
     * @param playerId Player ID (for The Decree) or player index as string (for Guandan)
     * @param cardIndices Indices of cards in player's hand (e.g., [0, 2] for 1st and 3rd card)
     * @returns Success status
     */
    public playerSelectCards(playerId: string, cardIndices: number[]): boolean {
        if (this._gameMode === 'the_decree') {
            return this._playerSelectCardsTheDecree(playerId, cardIndices);
        } else if (this._gameMode === 'guandan') {
            return this._playerSelectCardsGuandan(playerId, cardIndices);
        } else {
            console.error(`[Game] Unknown game mode: ${this._gameMode}`);
            return false;
        }
    }

    /**
     * The Decree mode: Player selects cards to play
     * @param playerId Player ID (e.g., 'player_0')
     * @param cardIndices Indices of cards in player's hand
     * @returns Success status
     */
    private _playerSelectCardsTheDecree(playerId: string, cardIndices: number[]): boolean {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return false;
        }

        const playerState = this._theDecreeMode.getPlayerState(playerId);
        if (!playerState) {
            console.error(`[The Decree] Player ${playerId} not found`);
            return false;
        }

        // Convert indices to actual cards
        const cards = cardIndices.map(index => playerState.hand[index]).filter(c => c !== undefined);

        const success = this._theDecreeMode.playCards(cards, playerId);
        if (success) {
            console.log(`[The Decree] Player ${playerId} played ${cards.length} cards`);

            // Update hands display
            this.updateTheDecreeHandsDisplay();

            // Check if round is over (all players played)
            const currentRound = this._theDecreeMode.getCurrentRound();
            if (currentRound && currentRound.roundWinnerId) {
                console.log(`[The Decree] Round complete!`);
                console.log(`Winner: ${currentRound.roundWinnerId}`);
                console.log(`Loser: ${currentRound.roundLoserId}`);
            }
        } else {
            console.error('[The Decree] Failed to play cards');
        }

        return success;
    }

    /**
     * Guandan mode: Player selects cards to play
     * @param playerId Player index as string (e.g., '0', '1', '2')
     * @param cardIndices Indices of cards in player's hand
     * @returns Success status
     */
    private _playerSelectCardsGuandan(playerId: string, cardIndices: number[]): boolean {
        if (!this._gameController) {
            console.error('[Guandan] Game controller not initialized');
            return false;
        }

        // Convert playerId string to player index
        const playerIndex = parseInt(playerId, 10);
        if (isNaN(playerIndex) || playerIndex < 0 || playerIndex >= this._gameController.players.length) {
            console.error(`[Guandan] Invalid player index: ${playerId}`);
            return false;
        }

        const player = this._gameController.players[playerIndex];
        if (!player) {
            console.error(`[Guandan] Player ${playerIndex} not found`);
            return false;
        }

        // Convert indices to actual cards
        const cards = cardIndices.map(index => player.handCards[index]).filter(c => c !== undefined);

        if (cards.length === 0) {
            console.error(`[Guandan] No valid cards selected`);
            return false;
        }

        // Call game controller to play cards
        const success = this._gameController.playCards(playerIndex, cards);
        if (success) {
            console.log(`[Guandan] Player ${player.name} (${playerIndex}) played ${cards.length} cards`);

            // Update hand display
            this._handsManager.updatePlayerHand(playerIndex);

            // Check if player finished
            if (player.isFinished()) {
                console.log(`[Guandan] Player ${player.name} finished!`);
            }
        } else {
            console.error(`[Guandan] Failed to play cards for player ${playerIndex}`);
        }

        return success;
    }

    /**
     * Universal interface: Player passes their turn
     * Routes to appropriate game mode implementation (Guandan only, The Decree doesn't support passing)
     * @param playerId Player ID or player index as string
     * @returns Success status
     */
    public playerPass(playerId: string): boolean {
        if (this._gameMode === 'the_decree') {
            console.error('[The Decree] Pass is not supported in The Decree mode');
            return false;
        } else if (this._gameMode === 'guandan') {
            return this._playerPassGuandan(playerId);
        } else {
            console.error(`[Game] Unknown game mode: ${this._gameMode}`);
            return false;
        }
    }

    /**
     * Guandan mode: Player passes their turn
     * @param playerId Player index as string (e.g., '0', '1', '2')
     * @returns Success status
     */
    private _playerPassGuandan(playerId: string): boolean {
        if (!this._gameController) {
            console.error('[Guandan] Game controller not initialized');
            return false;
        }

        // Convert playerId string to player index
        const playerIndex = parseInt(playerId, 10);
        if (isNaN(playerIndex) || playerIndex < 0 || playerIndex >= this._gameController.players.length) {
            console.error(`[Guandan] Invalid player index: ${playerId}`);
            return false;
        }

        const player = this._gameController.players[playerIndex];
        if (!player) {
            console.error(`[Guandan] Player ${playerIndex} not found`);
            return false;
        }

        // Call game controller to pass
        const success = this._gameController.pass(playerIndex);
        if (success) {
            console.log(`[Guandan] Player ${player.name} (${playerIndex}) passed`);
        } else {
            console.error(`[Guandan] Failed to pass for player ${playerIndex}`);
        }

        return success;
    }

    /**
     * Phase 4: Refill players' hands to 5 cards
     * Call this after showdown to start next round
     */
    public refillHands(): void {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return;
        }

        this._theDecreeMode.refillHands();
        console.log('[The Decree] Hands refilled');

        // Check if game is over
        if (this._theDecreeMode.isGameOver()) {
            console.log('[The Decree] Game Over!');
            this.showFinalScores();
        } else {
            console.log('[The Decree] Next round started');
        }
    }

    /**
     * Show final scores and winner
     */
    private showFinalScores(): void {
        if (!this._theDecreeMode) return;

        const scores = this._theDecreeMode.getScores();
        console.log('=== Final Scores ===');

        let maxScore = -1;
        let winnerId = '';

        for (const [playerId, score] of scores) {
            console.log(`${playerId}: ${score} points`);
            if (score > maxScore) {
                maxScore = score;
                winnerId = playerId;
            }
        }

        console.log(`\nWinner: ${winnerId} with ${maxScore} points!`);
    }

    /**
     * Get player's played cards in current round
     * @param playerId Player ID
     */
    public getPlayerPlayedCards(playerId: string): number[] {
        if (!this._theDecreeMode) {
            return [];
        }

        const currentRound = this._theDecreeMode.getCurrentRound();
        if (!currentRound) {
            return [];
        }

        return currentRound.playerPlays.get(playerId) || [];
    }

    /**
     * Check if all players have played in current round
     */
    public allPlayersPlayed(): boolean {
        if (!this._theDecreeMode) {
            return false;
        }

        const currentRound = this._theDecreeMode.getCurrentRound();
        if (!currentRound) {
            return false;
        }

        return currentRound.playerPlays.size === 4; // 4 players
    }

    /**
     * Get the hand type and rank for comparison
     * Used to show what hand each player made
     * @param playerId Player ID
     */
    public getPlayerHandResult(playerId: string): any {
        if (!this._theDecreeMode) {
            return null;
        }

        const currentRound = this._theDecreeMode.getCurrentRound();
        if (!currentRound) {
            return null;
        }

        const playedCards = currentRound.playerPlays.get(playerId);
        if (!playedCards) {
            return null;
        }

        // Combine played cards with community cards
        const communityCards = this._theDecreeMode.getCommunityCards();
        const allCards = [...playedCards, ...communityCards];

        // Import TexasHoldEmEvaluator to evaluate hand
        // This will be used for display purposes
        return {
            playedCards,
            communityCards,
            allCards
            // TODO: Add hand type and rank
        };
    }

    /**
     * Quick test method: Auto-play a complete round
     * This is for testing purposes
     */
    public autoPlayTestRound(): void {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Game not initialized');
            return;
        }

        console.log('\n=== Auto-Play Test Round ===');

        // Step 1: Select first dealer (each player reveals their first card)
        const revealedCards = new Map<string, number>();
        revealedCards.set('player_0', 0);
        revealedCards.set('player_1', 0);
        revealedCards.set('player_2', 0);
        revealedCards.set('player_3', 0);

        const dealerId = this.selectFirstDealer(revealedCards);
        console.log(`Dealer: ${dealerId}`);

        // Step 2: Dealer calls number of cards
        this.dealerCall(2); // Play 2 cards

        // Step 3: All players select cards
        this.playerSelectCards('player_0', [0, 1]); // Player 0 plays first 2 cards
        this.playerSelectCards('player_1', [0, 1]);
        this.playerSelectCards('player_2', [0, 1]);
        this.playerSelectCards('player_3', [0, 1]);

        // Step 4: Refill hands
        this.scheduleOnce(() => {
            this.refillHands();
        }, 2);
    }

    // ==================== The Decree Helper Methods ====================

    /**
     * Initialize hands display for The Decree mode
     * Creates adapter Player objects from TheDecreeMode PlayerState
     */
    private initializeTheDecreeHandsDisplay(): void {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Cannot initialize hands - game not ready');
            return;
        }

        console.log('[The Decree] Initializing hands display...');

        // Create temporary GameController for hands manager
        if (!this._gameController) {
            if (this.gameControllerNode) {
                this._gameController = this.gameControllerNode.getComponent(GameController);
                if (!this._gameController) {
                    this._gameController = this.gameControllerNode.addComponent(GameController);
                }
            } else {
                this._gameController = this.node.addComponent(GameController);
            }
        }

        // Create adapter Player objects from The Decree player states
        const adapterPlayers: Player[] = [];
        const playerIds = ['player_0', 'player_1', 'player_2', 'player_3'];

        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            const playerState = this._theDecreeMode.getPlayerState(playerId);

            if (playerState) {
                // Create adapter player
                const player = new Player(i, playerId, i);
                player.setHandCards(playerState.hand);
                adapterPlayers.push(player);
            }
        }

        // Temporarily set adapter players in game controller
        // @ts-ignore - accessing private property for adapter
        this._gameController['_players'] = adapterPlayers;

        // Initialize hands manager if not already done
        if (!this._handsManager) {
            if (!this.handsManagerNode) {
                this.handsManagerNode = this.createHandsManagerStructure();
            }

            this._handsManager = this.handsManagerNode.getComponent(GameHandsManager);
            if (!this._handsManager) {
                this._handsManager = this.handsManagerNode.addComponent(GameHandsManager);
            }

            this._handsManager.init(this._gameController, this._pokerSprites, this._pokerPrefab);
        }

        // Update all hand displays
        this._handsManager.updateAllHands();

        console.log('[The Decree] Hands display initialized');
    }

    /**
     * Display community cards for The Decree mode
     * Directly creates card nodes under communityCardsNode
     */
    private displayCommunityCards(): void {
        if (!this._theDecreeMode) {
            console.error('[The Decree] Cannot display community cards - game not ready');
            return;
        }

        if (!this.communityCardsNode) {
            console.warn('[The Decree] Community cards node not found');
            return;
        }

        const communityCards = this._theDecreeMode.getCommunityCards();
        console.log(`[The Decree] Displaying ${communityCards.length} community cards:`, communityCards);

        // Simple layout: 4 cards in a horizontal row
        const cardWidth = 140;
        const cardSpacing = 20;
        const totalWidth = (cardWidth * 4) + (cardSpacing * 3);
        const startX = -totalWidth / 2 + cardWidth / 2;

        const pokerBack = this._pokerSprites.get("CardBack3");

        // Create card nodes directly
        communityCards.forEach((cardValue, index) => {
            const cardNode = instantiate(this._pokerPrefab);
            const poker = cardNode.getComponent(Poker);

            if (poker) {
                // Get the sprite for this card
                const spriteName = PokerFactory.getCardSpriteName(cardValue);
                const pokerFront = this._pokerSprites.get(spriteName);

                if (pokerFront) {
                    poker.init(cardValue, pokerBack, pokerFront);
                    poker.showFront();

                    const x = startX + (cardWidth + cardSpacing) * index;
                    cardNode.setPosition(new Vec3(x, 0, 0));
                    this.communityCardsNode.addChild(cardNode);
                } else {
                    console.error(`[The Decree] Sprite not found: ${spriteName}`);
                    cardNode.destroy();
                }
            } else {
                console.error('[The Decree] Poker component not found on prefab');
                cardNode.destroy();
            }
        });

        console.log('[The Decree] Community cards displayed successfully');
    }

    /**
     * Update The Decree hands display after cards are played
     * Call this after playerSelectCards succeeds
     */
    private updateTheDecreeHandsDisplay(): void {
        if (!this._theDecreeMode || !this._handsManager) {
            return;
        }

        // Update adapter players with latest hand data
        const playerIds = ['player_0', 'player_1', 'player_2', 'player_3'];

        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            const playerState = this._theDecreeMode.getPlayerState(playerId);

            if (playerState && this._gameController) {
                // Update adapter player's hand
                const player = this._gameController.players[i];
                if (player) {
                    player.setHandCards(playerState.hand);
                    this._handsManager.updatePlayerHand(i);
                }
            }
        }
    }

    /**
     * Cleanup - unregister events
     */
    onDestroy(): void {
        if (this.btnStart) {
            this.btnStart.node.off(Button.EventType.CLICK, this.onStartButtonClicked, this);
        }
    }
}