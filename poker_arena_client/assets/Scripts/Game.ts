import { _decorator, AssetManager, assetManager, Component, Node, Prefab, SpriteFrame, UITransform, Widget, Material } from 'cc';
import { PokerFactory } from './UI/PokerFactory';
import { GameController } from './Core/GameController';
import { PlayerUIManager } from './UI/PlayerUIManager';
import { SceneManager } from './SceneManager';
import { TheDecreeModeClient } from './Core/GameMode/TheDecreeModeClient';
import { GameStage } from './Core/Stage/StageManager';
import { StageManager } from './Core/Stage/StageManager';
import { ReadyStage } from './Core/Stage/ReadyStage';
import { PlayingStage } from './Core/Stage/PlayingStage';
import { EndStage } from './Core/Stage/EndStage';
import { SeatLayoutConfig } from './Config/SeatConfig';
import { NetworkClient } from './Network/NetworkClient';
import { NetworkManager } from './Network/NetworkManager';
import { NetworkConfig } from './Config/NetworkConfig';
import { EventCenter, GameEvents } from './Utils/EventCenter';
import { GameService } from './Services/GameService';
import { SceneUIController } from './UI/SceneUIController';
import { LoadingUI } from './UI/LoadingUI';
import { LocalRoomStore, RoomState } from './LocalStore/LocalRoomStore';
const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {

    @property(Node)
    public playerUIManagerNode: Node = null!;

    @property(Node)
    public sceneUINode: Node = null!;

    // 🎯 优化：加载进度UI
    @property(LoadingUI)
    public loadingUI: LoadingUI | null = null;

    // Stage nodes
    @property(Node)
    public nodeReadyStage: Node = null!;

    @property(Node)
    public nodePlayingStage: Node = null!;

    @property(Node)
    public nodeEndStage: Node = null!;;
    
    // Managers
    public stageManager: StageManager = null!;
    private _gameController: GameController = null!;
    private _playerUIManager: PlayerUIManager = null!;
    private _sceneUIController: SceneUIController = null!;

    // Network
    public networkClient: NetworkClient | null = null;
    private isOnlineMode: boolean = false;

    // Legacy game mode instance (used by legacy methods)
    private _theDecreeMode: TheDecreeModeClient | null = null;

    // Resources
    private _pokerBundle: AssetManager.Bundle = null;
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;
    private _glowMaterial: Material | null = null; // 边缘光材质
    private _hasEnteredGame: boolean = false;
    private _holdLoadingForReconnect: boolean = false;
    private readonly _debugLayout: boolean = false;

    private _onSwitchToPlayingStage = (): void => {
        console.log("[Game] Received SWITCH_TO_PLAYING_STAGE event, switching stage...");
        if (this.stageManager) {
            this.stageManager.switchToStage(GameStage.PLAYING);
        }
    };

    // Game configuration from scene transition
    private _gameMode: string = '';
    private _roomId: string = '';

    public onLoad(): void {
        console.log("Main onLoad");

        // 显示加载界面
        if (this.loadingUI) {
            this.loadingUI.show();
            this.loadingUI.updateProgress(0, '正在加载资源...');
        }

        // Get game configuration from scene transition
        const sceneManager = SceneManager.getInstance();
        const transitionData = sceneManager.getTransitionData<{
            roomId: string;
            gameMode: string;
            isOnlineMode?: boolean;
        }>();

        this._gameMode = transitionData.gameMode || 'guandan';
        this._roomId = transitionData.roomId || 'default_room';

        // Check if this is online mode (roomId from server)
        this.isOnlineMode = transitionData.isOnlineMode || false;

        console.log(`[Game] Game Mode: ${this._gameMode}, Room ID: ${this._roomId}, Online Mode: ${this.isOnlineMode}`);

        const existingBundle = assetManager.getBundle("Pokers");
        if (existingBundle) {
            this._pokerBundle = existingBundle;
            console.log("Poker bundle already loaded.");

            if (this.loadingUI) {
                this.loadingUI.updateProgress(0.3, '姝ｅ湪鍔犺浇鎵戝厠鐗?..');
            }

            this._onLoadPokerAtlas();
            this._onLoadPokerPrefab();
            this._onLoadGlowMaterial();
            return;
        }

        assetManager.loadBundle("Pokers", (err, bundle) => {
            if (err) {
                console.error(err);
                return;
            }
            this._pokerBundle = bundle;
            console.log("Poker bundle loaded.");

            if (this.loadingUI) {
                this.loadingUI.updateProgress(0.3, '正在加载扑克牌...');
            }

            this._onLoadPokerAtlas();
            this._onLoadPokerPrefab();
            this._onLoadGlowMaterial();
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

            if (this.loadingUI) {
                this.loadingUI.updateProgress(0.6, '正在准备游戏...');
            }

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

            if (this.loadingUI) {
                this.loadingUI.updateProgress(0.9, '即将进入房间...');
            }

            this._checkAllLoaded();
        });
    }

    private _onLoadGlowMaterial(): void {
        const existingBundle = assetManager.getBundle("Effects");
        if (existingBundle) {
            existingBundle.load("CardGlow", Material, (err, material) => {
                if (err) {
                    console.warn("CardGlow material not found, glow effect will be disabled.");
                    this._checkAllLoaded();
                    return;
                }

                this._glowMaterial = material;
                console.log("CardGlow material loaded.");

                if (this._playerUIManager) {
                    this._playerUIManager.applyGlowMaterialToMainHand(material);
                }
                this._checkAllLoaded();
            });
            return;
        }

        assetManager.loadBundle("Effects", (err, bundle) => {
            if (err) {
                // Effects bundle not found, continue without glow material
                console.warn("Effects bundle not found, glow effect will be disabled.");
                this._checkAllLoaded();
                return;
            }

            bundle.load("CardGlow", Material, (err, material) => {
                if (err) {
                    console.warn("CardGlow material not found, glow effect will be disabled.");
                    this._checkAllLoaded();
                    return;
                }

                this._glowMaterial = material;
                console.log("CardGlow material loaded.");

                if (this._playerUIManager) {
                    this._playerUIManager.applyGlowMaterialToMainHand(material);
                }
                this._checkAllLoaded();
            });
        });
    }

    private _checkAllLoaded(): void {
        console.log(this._pokerBundle, this._pokerSprites.size, this._pokerPrefab);
        if (this._hasEnteredGame) {
            return;
        }
        if (this._pokerBundle && this._pokerSprites.size > 0 && this._pokerPrefab) {
            this._hasEnteredGame = true;
            this._enterGame();
        }
    }

    private _enterGame(): void {
        console.log("[Game] Entering game - initializing systems...");
        console.log('[Game] instance:', {
            node: this.node?.name,
            uuid: this.node?.uuid,
            scene: this.node?.scene?.name
        });

        if (this.loadingUI) {
            this.loadingUI.updateProgress(1.0, '加载完成！');
        }

        // 1. Initialize PokerFactory (global singleton)
        const pokerFactory = this.node.getComponent(PokerFactory) || this.node.addComponent(PokerFactory);
        pokerFactory.init(this._pokerSprites, this._pokerPrefab);

        // 2. Auto-find nodes if not manually assigned
        this.autoFindNodes();

        // 3. Initialize player UI manager (will be used by GameModes)
        this.initializePlayerUIManager();

        // 4. Initialize Scene UI (exit button, settings, room ID)
        this.initializeSceneUI();

        // 5. Initialize network client if online mode
        if (this.isOnlineMode) {
            this.initializeNetworkClient();
        }

        // 6. Create and setup Stage Manager
        this.createStageManager();

        // 7. Setup event listeners for stage switching
        this.setupStageEventListeners();

        // 8. 根据房间状态决定进入哪个阶段
        const roomStore = LocalRoomStore.getInstance();
        const currentRoom = roomStore.getCurrentRoom();
        console.log('[Game] Room snapshot at enter:', {
            hasRoom: !!currentRoom,
            roomId: currentRoom?.id,
            state: currentRoom?.state,
            players: currentRoom?.players?.length,
            maxPlayers: currentRoom?.maxPlayers
        });

        if (currentRoom && currentRoom.state === RoomState.PLAYING) {
            // 重连场景：房间正在游戏中，直接进入 PlayingStage
            console.log("[Game] Reconnect scenario: Room is PLAYING, entering Playing stage");
            this._holdLoadingForReconnect = true;
            if (this.loadingUI) {
                this.loadingUI.show();
                this.loadingUI.updateProgress(1.0, '正在进入游戏...');
            }
            console.log('[Game] Reconnect loading hold set:', this._holdLoadingForReconnect, 'instance:', this.node?.uuid);
            this.stageManager.switchToStage(GameStage.PLAYING);
        } else {
            // 正常场景：进入 ReadyStage
            console.log("[Game] All systems initialized, entering Ready stage");
            this.stageManager.switchToStage(GameStage.READY);
            this._holdLoadingForReconnect = false;
            console.log('[Game] Reconnect loading hold set:', this._holdLoadingForReconnect, 'instance:', this.node?.uuid);
        }

        // 延迟隐藏加载界面（让用户看到100%）
        if (!this._holdLoadingForReconnect) {
            this.scheduleOnce(() => {
                if (this.loadingUI) {
                    console.log('[Game] Auto-hide loading UI (non-reconnect)');
                    this.loadingUI.hide();
                }
            }, 0.5);
        } else {
            console.log('[Game] Holding loading UI for reconnect');
        }
    }

    /**
     * Initialize player UI manager
     */
    private initializePlayerUIManager(): void {
        if (!this.playerUIManagerNode) {
            this.playerUIManagerNode = this.createPlayerUIManager();
        } else {
            // Node exists (assigned in editor), but we still need to setup Widget for hand nodes
            console.log("[Game] PlayerUIManager node already exists, setting up Widget components...");
            this.createOrUpdateHandNodes(this.playerUIManagerNode);
        }

        // Get or create component, but DON'T call init yet
        // (will be called when game mode starts with actual player data)
        this._playerUIManager = this.playerUIManagerNode.getComponent(PlayerUIManager);
        if (!this._playerUIManager) {
            this._playerUIManager = this.playerUIManagerNode.addComponent(PlayerUIManager);
        }

        console.log("[Game] PlayerUIManager component created (will init with player data later)");
    }

    /**
     * Initialize Scene UI (exit button, settings, room ID display)
     */
    private initializeSceneUI(): void {
        console.log("[Game] Initializing Scene UI...");

        // Find or create Scene UI node
        if (!this.sceneUINode) {
            console.log("[Game] SceneUI node not manually assigned, creating automatically...");
            this.sceneUINode = this.createSceneUI();
        } else {
            console.log("[Game] Using manually assigned SceneUI node");
        }

        // Ensure the node is active
        if (!this.sceneUINode.active) {
            this.sceneUINode.active = true;
            console.log("[Game] Activated SceneUI node");
        }

        // Get or create SceneUIController component
        this._sceneUIController = this.sceneUINode.getComponent(SceneUIController);
        if (!this._sceneUIController) {
            this._sceneUIController = this.sceneUINode.addComponent(SceneUIController);
            console.log("[Game] Added SceneUIController component to node");
        } else {
            console.log("[Game] Found existing SceneUIController component");
        }

        // Initialize with room ID and mode
        this._sceneUIController.init(this._roomId, this.isOnlineMode);

        console.log("[Game] Scene UI initialized");
    }

    /**
     * Create Scene UI node at Canvas root level
     */
    private createSceneUI(): Node {
        const canvasNode = this.node.parent; // Main's parent is Canvas
        let sceneUINode: Node | null = null;

        if (canvasNode) {
            const existingSceneUI = canvasNode.getChildByName("Node_SceneUI");
            if (existingSceneUI) {
                console.log("[Game] Found existing Node_SceneUI at Canvas root level");
                sceneUINode = existingSceneUI;
            }
        }

        // If not found, create Node_SceneUI at Canvas root level
        if (!sceneUINode) {
            const parentNode = canvasNode || this.node;
            sceneUINode = new Node("Node_SceneUI");
            sceneUINode.active = true; // Ensure it's active
            parentNode.addChild(sceneUINode);

            // Make sure SceneUI is rendered on top
            const siblingCount = parentNode.children.length;
            sceneUINode.setSiblingIndex(siblingCount - 1);
            console.log(`[Game] Created new Node_SceneUI at index: ${sceneUINode.getSiblingIndex()} / ${siblingCount}`);
        }

        // Add UITransform
        if (!sceneUINode.getComponent(UITransform)) {
            sceneUINode.addComponent(UITransform);
        }

        console.log('[Game] Node_SceneUI configured');

        return sceneUINode;
    }

    /**
     * Initialize network client for online mode
     * 使用 NetworkManager 获取全局单例，确保与 Lobby 使用同一个连接
     */
    private initializeNetworkClient(): void {
        console.log("[Game] Initializing network client...");

        // 使用 NetworkManager 获取全局单例 NetworkClient
        const serverUrl = NetworkConfig.getServerUrl();
        console.log(`[Game] Connecting to server: ${serverUrl}`);
        const networkManager = NetworkManager.getInstance();
        this.networkClient = networkManager.getClient(serverUrl);

        if (this.networkClient.getIsConnected()) {
            console.log("[Game] Using existing connected network client");
        } else {
            console.log("[Game] Network client not connected, will connect in Ready stage");
        }

        // 初始化 GameService（单例模式，会自动注册网络监听器）
        GameService.getInstance();
        console.log("[Game] GameService initialized");
    }

    /**
     * Create and register all game stages
     */
    private createStageManager(): void {
        console.log("[Game] Creating Stage Manager...");

        this.stageManager = new StageManager();

        // Create and register Ready Stage
        const readyStage = new ReadyStage(this, this.nodeReadyStage);
        this.stageManager.registerStage(GameStage.READY, readyStage);

        // Create and register Playing Stage
        const playingStage = new PlayingStage(this, this.nodePlayingStage, this._gameMode);
        this.stageManager.registerStage(GameStage.PLAYING, playingStage);

        // Create and register End Stage
        const endStage = new EndStage(this, this.nodeEndStage);
        this.stageManager.registerStage(GameStage.END, endStage);

        console.log("[Game] Stage Manager created with 3 stages");
    }

    /**
     * Setup event listeners for stage switching
     */
    private setupStageEventListeners(): void {
        console.log("[Game] Setting up stage event listeners...");

        // Listen for game start event to switch to Playing stage
        EventCenter.on('SWITCH_TO_PLAYING_STAGE', this._onSwitchToPlayingStage, this);

        console.log("[Game] Stage event listeners setup complete");
    }

    /**
     * Update is called every frame
     */
    public update(deltaTime: number): void {
        if (this.stageManager) {
            this.stageManager.update(deltaTime);
        }
    }

    /**
     * 强制给现有节点应用 Widget（调试用）
     * 在浏览器控制台输入：cc.find('Canvas/Main').getComponent('Game').forceApplyWidgetToExistingNodes()
     */
    public forceApplyWidgetToExistingNodes(): void {
        console.log('[Debug] Forcing Widget application...');
        if (this.playerUIManagerNode) {
            this.createOrUpdateHandNodes(this.playerUIManagerNode);
            console.log('[Debug] Widget force update complete');
        } else {
            console.error('[Debug] playerUIManagerNode not found');
        }
    }

    /**
     * Clean up when game is destroyed
     */
    onDestroy(): void {
        EventCenter.off('SWITCH_TO_PLAYING_STAGE', this._onSwitchToPlayingStage, this);

        if (this.stageManager) {
            this.stageManager.cleanup();
        }

        // Disconnect network client if connected
        if (this.networkClient) {
            this.networkClient.disconnect();
            this.networkClient = null;
        }
    }

    // ==================== Node Finding Utilities ====================

    /**
     * Auto-find nodes by name if not manually assigned
     */
    private autoFindNodes(): void {
        // Auto-find ReadyStageNode
        if (!this.nodeReadyStage) {
            this.nodeReadyStage = this.findNodeByName(this.node, 'Node_ReadyStage');
        }

        // Note: Game mode specific nodes (TheDecree, Guandan, CommunityCards)
        // are now managed by their respective GameModeClient classes
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
     * Create player UI manager node structure automatically
     * Creates the PlayerUI node (which will host PlayerUIManager component) and hand position nodes
     * 使用 Widget 组件实现屏幕自适应
     *
     * Note: Node_PlayerUI should be at Canvas root level to be visible across all game stages
     * (ReadyStage, PlayStage, EndStage all need access to player UI)
     */
    private createPlayerUIManager(): Node {
        // Try to find existing Node_PlayerUI at Canvas root level
        const canvasNode = this.node.parent; // Main's parent is Canvas
        let playerUINode: Node | null = null;

        if (canvasNode) {
            const existingPlayerUI = canvasNode.getChildByName("Node_PlayerUI");
            if (existingPlayerUI) {
                console.log("[Game] Found existing Node_PlayerUI at Canvas root level");
                playerUINode = existingPlayerUI;
            }
        }

        // If not found, create Node_PlayerUI at Canvas root level
        if (!playerUINode) {
            const parentNode = canvasNode || this.node;
            playerUINode = new Node("Node_PlayerUI");
            parentNode.addChild(playerUINode);

            // Make sure PlayerUI is rendered on top
            const siblingCount = parentNode.children.length;
            playerUINode.setSiblingIndex(siblingCount - 1);
            console.log(`[Game] Created new Node_PlayerUI at index: ${playerUINode.getSiblingIndex()} / ${siblingCount}`);
        }

        // Node_PlayerUI只是一个逻辑容器，不需要Widget
        // 所有手牌节点（BottomSeat、LeftSeat等）的Widget会直接对齐Canvas
        if (!playerUINode.getComponent(UITransform)) {
            playerUINode.addComponent(UITransform);
        }

        console.log('[Game] Node_PlayerUI configured as container');

        // Create or update hand container nodes with Widget configuration
        this.createOrUpdateHandNodes(playerUINode);

        return playerUINode;
    }

    /**
     * 创建或更新手牌节点的 Widget 配置
     * 根据游戏模式使用对应的布局配置
     */
    private createOrUpdateHandNodes(playerUINode: Node): void {
        // 根据游戏模式选择布局
        // TheDecree: 2-4人，Guandan: 5-6人
        let layoutConfig;
        const layoutPlayerCount = this.getLayoutPlayerCount();
        if (this._gameMode === 'the_decree') {
            const count = layoutPlayerCount >= 2 ? Math.min(layoutPlayerCount, 4) : 4;
            layoutConfig = SeatLayoutConfig.getTheDecreeLayout(count);
            console.log(`[Game] Using TheDecree ${count}-player layout`);
        } else {
            const count = layoutPlayerCount >= 5 ? Math.min(layoutPlayerCount, 6) : 5;
            layoutConfig = SeatLayoutConfig.getGuandanLayout(count);
            console.log(`[Game] Using Guandan ${count}-player layout`);
        }

        const activeCount = layoutConfig.filter(c => c.active).length;
        console.log(`[Game] Applying Widget layout: ${activeCount} active / ${layoutConfig.length} total positions`);

        layoutConfig.forEach(config => {
            // 查找现有节点或创建新节点
            let handNode = playerUINode.getChildByName(config.name);
            if (!handNode) {
                handNode = new Node(config.name);
                playerUINode.addChild(handNode);
                console.log(`[Game] Created new hand node: ${config.name}`);
            } else {
                console.log(`[Game] Found existing hand node: ${config.name}, updating Widget`);
            }

            // 添加 UITransform（如果没有）
            let uiTransform = handNode.getComponent(UITransform);
            if (!uiTransform) {
                uiTransform = handNode.addComponent(UITransform);
            }
            // 保持默认锚点 (0.5, 0.5) - Widget 会根据对齐方式自动调整位置

            // 添加或获取 Widget 组件（必须使用字符串方式）
            let handWidget = handNode.getComponent('cc.Widget') as Widget;
            if (!handWidget) {
                handWidget = handNode.addComponent('cc.Widget') as Widget;
                console.log(`[Game] Added Widget to ${config.name}`);

                // 立即验证
                const verifyWidget = handNode.getComponent('cc.Widget');
                if (!verifyWidget) {
                    console.error(`[Game] ERROR: Failed to add Widget to ${config.name}!`);
                    return;
                } else {
                    console.log(`[Game] Widget verified on ${config.name}`);
                }
            }

            // 重置所有对齐
            handWidget.isAlignLeft = false;
            handWidget.isAlignRight = false;
            handWidget.isAlignTop = false;
            handWidget.isAlignBottom = false;
            handWidget.isAlignHorizontalCenter = false;
            handWidget.isAlignVerticalCenter = false;

            // 手牌Widget直接对齐到Canvas
            // 因为Node_PlayerUI只是逻辑容器，不影响布局
            // 直接对齐Canvas确保正确的自适应行为
            handWidget.target = playerUINode.getParent(); // Canvas节点

            // 应用 widget 配置
            const w = config.widget;
            if (this._debugLayout) {
                console.log(`[Game] ${config.name} widget config:`, JSON.stringify(w));
            }
            if (w.alignLeft !== undefined) {
                handWidget.isAlignLeft = w.alignLeft;
                if (w.left !== undefined) {
                    handWidget.left = w.left;
                }
            }
            if (w.alignRight !== undefined) {
                handWidget.isAlignRight = w.alignRight;
                if (w.right !== undefined) {
                    handWidget.right = w.right;
                }
            }
            if (w.alignTop !== undefined) {
                handWidget.isAlignTop = w.alignTop;
                if (w.top !== undefined) {
                    handWidget.top = w.top;
                }
            }
            if (w.alignBottom !== undefined) {
                handWidget.isAlignBottom = w.alignBottom;
                if (w.bottom !== undefined) {
                    handWidget.bottom = w.bottom;
                    if (this._debugLayout) {
                        console.log(`[Game] ${config.name} bottom set to ${w.bottom}`);
                    }
                }
            }
            if (w.alignHorizontalCenter !== undefined) {
                handWidget.isAlignHorizontalCenter = w.alignHorizontalCenter;
                if (w.horizontalCenter !== undefined) {
                    handWidget.horizontalCenter = w.horizontalCenter;
                    if (this._debugLayout) {
                        console.log(`[Game] ${config.name} horizontalCenter set to ${w.horizontalCenter}`);
                    }
                }
            }
            if (w.alignVerticalCenter !== undefined) {
                handWidget.isAlignVerticalCenter = w.alignVerticalCenter;
                if (w.verticalCenter !== undefined) {
                    handWidget.verticalCenter = w.verticalCenter;
                    if (this._debugLayout) {
                        console.log(`[Game] ${config.name} verticalCenter set to ${w.verticalCenter}`);
                    }
                }
            }

            // 强制立即更新 Widget 对齐
            handWidget.updateAlignment();
            if (this._debugLayout) {
                console.log(`[Game] ${config.name} Widget alignment updated, position: (${handNode.position.x}, ${handNode.position.y})`);
            }

            // 延迟检查位置是否被改变
            if (this._debugLayout) {
                this.scheduleOnce(() => {
                    console.log(`[Game] ${config.name} position after 1 second: (${handNode.position.x}, ${handNode.position.y})`);
                }, 1.0);
            }

            // 设置节点激活状态
            handNode.active = config.active;

            // 确保有 Container 子节点
            let container = handNode.getChildByName("Container");
            if (!container) {
                container = new Node("Container");
                container.addComponent(UITransform);
                handNode.addChild(container);
            }
        });

        console.log("[Game] All hand positions configured with Widget alignment");
    }

    private getLayoutPlayerCount(): number {
        const roomStore = LocalRoomStore.getInstance();
        const currentRoom = roomStore.getCurrentRoom();
        return currentRoom?.maxPlayers ?? currentRoom?.players?.length ?? 0;
    }

    public finishReconnectLoading(): void {
        console.log('[Game] finishReconnectLoading called, hold:', this._holdLoadingForReconnect, 'instance:', this.node?.uuid);
        if (!this._holdLoadingForReconnect) {
            console.log('[Game] finishReconnectLoading: hold=false, forcing hide anyway');
        }

        this._holdLoadingForReconnect = false;
        if (this.loadingUI) {
            console.log('[Game] Hiding loading UI after reconnect');
            this.loadingUI.hide();
        } else {
            console.warn('[Game] finishReconnectLoading: loadingUI missing');
        }
    }

    // ==================== Public Accessors ====================

    public get pokerSprites(): Map<string, SpriteFrame> {
        return this._pokerSprites;
    }

    public get pokerPrefab(): Prefab {
        return this._pokerPrefab;
    }

    public get glowMaterial(): Material | null {
        return this._glowMaterial;
    }

    public get holdLoadingForReconnect(): boolean {
        return this._holdLoadingForReconnect;
    }

    public set holdLoadingForReconnect(value: boolean) {
        this._holdLoadingForReconnect = value;
    }

    public set theDecreeModeRef(mode: TheDecreeModeClient | null) {
        this._theDecreeMode = mode;
    }

    /**
     * Get game controller (for external access)
     */
    public get gameController(): GameController {
        return this._gameController;
    }

    /**
     * Get player UI manager (for external access)
     */
    public get playerUIManager(): PlayerUIManager {
        return this._playerUIManager;
    }

    /**
     * Get scene UI controller (for external access)
     */
    public get sceneUIController(): SceneUIController {
        return this._sceneUIController;
    }

    /**
     * Get The Decree mode instance
     */
    public get theDecreeMode(): TheDecreeModeClient | null {
        return this._theDecreeMode;
    }
}
