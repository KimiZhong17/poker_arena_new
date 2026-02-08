// 必须在最前面导入 polyfills
import './Utils/polyfills';

import { _decorator, Component, Button, Label, EditBox, Node, Toggle, profiler, assetManager, SpriteFrame, Prefab } from 'cc';
import { SceneManager } from './SceneManager';
import { AuthService } from './Services/AuthService';
import { RoomService } from './Services/RoomService';
import { LocalUserStore } from './LocalStore/LocalUserStore';
import { NetworkManager } from './Network/NetworkManager';
import { NetworkConfig } from './Config/NetworkConfig';
import { NetworkClient } from './Network/NetworkClient';
import { ErrorEvent, RoomJoinedEvent, RoomCreatedEvent } from './Network/Messages';
import { LocalRoomStore, RoomData, RoomState } from './LocalStore/LocalRoomStore';
import { EventCenter, GameEvents } from './Utils/EventCenter';

const { ccclass, property } = _decorator;

/**
 * Lobby Scene - Simplified version
 * Players can create a room or join by room ID
 */
@ccclass('Lobby')
export class Lobby extends Component {
    @property(Button)
    createRoomButton: Button = null!;

    @property(Button)
    joinRoomButton: Button = null!;

    @property(Button)
    backButton: Button = null!;

    @property(Label)
    statusLabel: Label = null!;

    // RoomPanel 相关
    @property(Node)
    roomPanel: Node = null!;

    // RoomPanel 子节点（自动查找）
    private roomPanelInput: EditBox | null = null;
    private btnConfirm: Button | null = null;
    private btnClose: Button | null = null;
    private tgNumPlayer: Node | null = null; // TG_NumPlayer toggle group node
    private toggle2: Toggle | null = null;
    private toggle3: Toggle | null = null;
    private toggle4: Toggle | null = null;

    private authService: AuthService = null!;
    private roomService: RoomService = null!;
    private localUserStore: LocalUserStore = null!;
    private sceneManager: SceneManager = null!;
    private networkClient: NetworkClient | null = null;
    private currentGameMode: string = '';

    private maxPlayers = 4;
    private roomPanelMode: 'join' | 'create' = 'join'; // Track current mode
    private selectedPlayerCount = 4; // Store the selected player count for room creation

    onLoad() {
        // 在 onLoad 中初始化单例，确保它们总是可用
        this.sceneManager = SceneManager.getInstance();
        this.authService = AuthService.getInstance();
        this.roomService = RoomService.getInstance();
        this.localUserStore = LocalUserStore.getInstance();

        // 🎯 优化：预加载游戏资源，减少进入房间时的加载时间
        this.preloadGameAssets();
    }

    /**
     * 预加载游戏资源（在后台静默加载）
     * 这样当用户点击"加入房间"或"创建房间"时，资源已经在内存中了
     */
    private preloadGameAssets(): void {
        console.log('[Lobby] 🚀 Starting to preload game assets...');

        assetManager.loadBundle("Pokers", (err, bundle) => {
            if (err) {
                console.error('[Lobby] ❌ Failed to preload Poker bundle:', err);
                return;
            }

            console.log('[Lobby] ✅ Poker bundle preloaded successfully');

            // 预加载所有扑克牌精灵
            bundle.loadDir("", SpriteFrame, (err, sprites) => {
                if (!err) {
                    console.log(`[Lobby] ✅ Preloaded ${sprites.length} poker sprites`);
                } else {
                    console.error('[Lobby] ❌ Failed to preload sprites:', err);
                }
            });

            // 预加载扑克牌预制体
            bundle.load("PokerPrefab", Prefab, (err, prefab) => {
                if (!err) {
                    console.log('[Lobby] ✅ Preloaded poker prefab');
                } else {
                    console.error('[Lobby] ❌ Failed to preload prefab:', err);
                }
            });
        });
    }

    start() {
        // 隐藏左下角性能统计面板
        profiler.hideStats();

        // 确保 sceneManager 已初始化（防御性编程）
        if (!this.sceneManager) {
            this.sceneManager = SceneManager.getInstance();
        }
        if (!this.authService) {
            this.authService = AuthService.getInstance();
        }
        if (!this.roomService) {
            this.roomService = RoomService.getInstance();
        }
        if (!this.localUserStore) {
            this.localUserStore = LocalUserStore.getInstance();
        }

        // Check if user is logged in
        if (!this.authService.isLoggedIn()) {
            console.warn('[Lobby] User not logged in, redirecting to login');
            this.sceneManager.goToLogin();
            return;
        }

        // Get transition data
        const transitionData = this.sceneManager.getTransitionData<{
            gameMode: string;
        }>();

        // Get game mode from transition data or LocalUserStore
        this.currentGameMode = transitionData.gameMode || this.localUserStore.getSelectedGameMode() || '';

        if (!this.currentGameMode) {
            console.error('[Lobby] No game mode selected');
            this.sceneManager.goToHall();
            return;
        }

        console.log(`[Lobby] Game mode: ${this.currentGameMode}`);

        // 监听 UI_NAVIGATE_TO_GAME 事件（用于重连成功后跳转）
        EventCenter.on(GameEvents.UI_NAVIGATE_TO_GAME, this.onNavigateToGame, this);

        // 初始化网络客户端
        this.initNetworkClient();

        // 自动查找 RoomPanel 子节点
        this.autoFindRoomPanelElements();

        this.setupUI();
        this.setupButtons();
    }

    private setupUI(): void {
        // Clear status initially
        if (this.statusLabel) {
            this.statusLabel.string = '';
        }

        // 初始隐藏 RoomPanel
        this.hideRoomPanel();
    }

    /**
     * 初始化网络客户端
     */
    private initNetworkClient(): void {
        const serverUrl = NetworkConfig.getServerUrl();
        console.log(`[Lobby] Connecting to server: ${serverUrl}`);

        // 使用 NetworkManager 获取全局单例 NetworkClient
        const networkManager = NetworkManager.getInstance();
        this.networkClient = networkManager.getClient(serverUrl);

        // RoomService 会自己通过 NetworkManager 获取客户端，不需要手动设置

        // 如果已经连接，直接设置事件监听
        if (this.networkClient.getIsConnected()) {
            console.log('[Lobby] Already connected to server');
            this.setupNetworkEvents();
            this.checkAutoReconnect();
            return;
        }

        // 连接到服务器
        this.networkClient.connect()
            .then(() => {
                console.log('[Lobby] Connected to server');
                this.setupNetworkEvents();
                this.checkAutoReconnect();
            })
            .catch((error) => {
                console.error('[Lobby] Failed to connect to server:', error);
                this.showStatus('连接服务器失败');
            });
    }

    /**
     * 检查是否需要自动重连到之前的房间
     */
    private checkAutoReconnect(): void {
        if (this.roomService.hasPendingReconnect()) {
            console.log('[Lobby] Found pending reconnect, attempting to reconnect...');
            this.showStatus('正在重连到游戏...');
            this.roomService.tryAutoReconnect();
        }
    }

    /**
     * 设置网络事件监听
     */
    private setupNetworkEvents(): void {
        if (!this.networkClient) return;

        // 监听房间创建成功（使用箭头函数，不需要 bind）
        this.networkClient.on('room_created', this.onRoomCreated);

        // 监听房间加入成功
        this.networkClient.on('room_joined', this.onRoomJoined);

        // 监听错误
        this.networkClient.on('error', this.onNetworkError);
    }

    /**
     * 自动查找 RoomPanel 子节点
     */
    private autoFindRoomPanelElements(): void {
        if (!this.roomPanel) {
            console.error('[Lobby] roomPanel not assigned!');
            return;
        }

        // 查找输入框
        const inputNode = this.roomPanel.getChildByName('RoomIdInput');
        this.roomPanelInput = inputNode?.getComponent(EditBox) || null;

        // 查找确认按钮
        const confirmNode = this.roomPanel.getChildByName('btn_confirm');
        this.btnConfirm = confirmNode?.getComponent(Button) || null;

        // 查找关闭按钮
        const closeNode = this.roomPanel.getChildByName('btn_close');
        this.btnClose = closeNode?.getComponent(Button) || null;

        // 查找 TG_NumPlayer toggle group
        this.tgNumPlayer = this.roomPanel.getChildByName('TG_NumPlayer') || null;

        if (this.tgNumPlayer) {
            // 查找三个 toggle
            const toggle2Node = this.tgNumPlayer.getChildByName('toggle_2');
            this.toggle2 = toggle2Node?.getComponent(Toggle) || null;

            const toggle3Node = this.tgNumPlayer.getChildByName('toggle_3');
            this.toggle3 = toggle3Node?.getComponent(Toggle) || null;

            const toggle4Node = this.tgNumPlayer.getChildByName('toggle_4');
            this.toggle4 = toggle4Node?.getComponent(Toggle) || null;
        }

        console.log('[Lobby] RoomPanel elements found:', {
            roomPanelInput: !!this.roomPanelInput,
            btnConfirm: !!this.btnConfirm,
            btnClose: !!this.btnClose,
            tgNumPlayer: !!this.tgNumPlayer,
            toggle2: !!this.toggle2,
            toggle3: !!this.toggle3,
            toggle4: !!this.toggle4
        });

        // 注册 RoomPanel 按钮事件
        if (this.btnConfirm) {
            this.btnConfirm.node.on(Button.EventType.CLICK, this.onRoomPanelConfirmClicked, this);
        }

        if (this.btnClose) {
            this.btnClose.node.on(Button.EventType.CLICK, this.onRoomPanelCloseClicked, this);
        }
    }

    private setupButtons(): void {
        // Create Room button
        if (this.createRoomButton?.node) {
            this.createRoomButton.node.on(Button.EventType.CLICK, this.onCreateRoomClicked, this);
        }

        // Join Room button
        if (this.joinRoomButton?.node) {
            this.joinRoomButton.node.on(Button.EventType.CLICK, this.onJoinRoomClicked, this);
        }

        // Back button
        if (this.backButton?.node) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClicked, this);
        }
    }

    /**
     * Handle create room button click
     * Show room panel to select player count
     */
    private onCreateRoomClicked(): void {
        console.log('[Lobby] Create room clicked');

        if (!this.authService.isLoggedIn()) {
            console.error('[Lobby] No user logged in');
            this.showStatus('Error: User not logged in');
            return;
        }

        // 显示房间面板（创建模式）
        this.roomPanelMode = 'create';
        this.showRoomPanel();
    }

    /**
     * Handle join room button click
     * Show room panel to enter room ID
     */
    private onJoinRoomClicked(): void {
        console.log('[Lobby] Join room button clicked');

        if (!this.authService.isLoggedIn()) {
            console.error('[Lobby] No user logged in');
            this.showStatus('Error: User not logged in');
            return;
        }

        // 显示房间面板（加入模式）
        this.roomPanelMode = 'join';
        this.showRoomPanel();
    }

    /**
     * Handle back button
     */
    private onBackClicked(): void {
        console.log('[Lobby] Back clicked');
        this.sceneManager.goToHall();
    }

    // ==================== RoomPanel 相关方法 ====================

    /**
     * 显示 RoomPanel
     */
    private showRoomPanel(): void {
        if (this.roomPanel) {
            this.roomPanel.active = true;

            if (this.roomPanelMode === 'join') {
                // 加入房间模式：显示输入框，隐藏 toggle group
                if (this.roomPanelInput) {
                    this.roomPanelInput.node.active = true;
                    this.roomPanelInput.string = '';
                }
                if (this.tgNumPlayer) {
                    this.tgNumPlayer.active = false;
                }
            } else {
                // 创建房间模式：隐藏输入框，显示 toggle group
                if (this.roomPanelInput) {
                    this.roomPanelInput.node.active = false;
                }
                if (this.tgNumPlayer) {
                    this.tgNumPlayer.active = true;
                    // 默认选中 toggle_4 (4人房)
                    if (this.toggle4) {
                        this.toggle4.isChecked = true;
                    }
                }
            }

            // 禁用后面的按钮，防止点击穿透
            this.setMainButtonsEnabled(false);

            console.log(`[Lobby] RoomPanel shown in ${this.roomPanelMode} mode`);
        }
    }

    /**
     * 隐藏 RoomPanel
     */
    private hideRoomPanel(): void {
        if (this.roomPanel) {
            this.roomPanel.active = false;

            // 重新启用后面的按钮
            this.setMainButtonsEnabled(true);

            console.log('[Lobby] RoomPanel hidden');
        }
    }

    /**
     * 获取选中的玩家数量
     */
    private getSelectedPlayerCount(): number {
        if (this.toggle2?.isChecked) {
            return 2;
        } else if (this.toggle3?.isChecked) {
            return 3;
        } else if (this.toggle4?.isChecked) {
            return 4;
        }
        // 默认返回 4
        return 4;
    }

    /**
     * RoomPanel 确认按钮点击
     */
    private onRoomPanelConfirmClicked(): void {
        console.log('[Lobby] RoomPanel confirm clicked');

        if (this.roomPanelMode === 'join') {
            // 加入房间模式
            // 获取输入的房间号
            const roomId = this.roomPanelInput?.string?.trim() || '';

            // 验证房间号格式（4位数字）
            if (!this.validateRoomId(roomId)) {
                console.error('[Lobby] Invalid room ID format');
                this.showStatus('请输入4位数字房间号');
                return;
            }

            // 检查是否已登录
            if (!this.authService.isLoggedIn()) {
                console.error('[Lobby] No user logged in');
                this.showStatus('用户未登录');
                return;
            }

            // 通过 RoomService 加入房间
            console.log(`[Lobby] Joining room: ${roomId}`);
            this.roomService.joinRoom(roomId);
        } else {
            // 创建房间模式
            // 获取选中的玩家数量
            const playerCount = this.getSelectedPlayerCount();

            // 检查是否已登录
            if (!this.authService.isLoggedIn()) {
                console.error('[Lobby] No user logged in');
                this.showStatus('用户未登录');
                return;
            }

            // 保存选中的玩家数量，供 onRoomCreated 使用
            this.selectedPlayerCount = playerCount;

            // 通过 RoomService 创建房间
            console.log(`[Lobby] Creating room with ${playerCount} players`);
            this.roomService.createRoom(this.currentGameMode, playerCount);
        }
    }

    /**
     * RoomPanel 关闭按钮点击
     */
    private onRoomPanelCloseClicked(): void {
        console.log('[Lobby] RoomPanel close clicked');
        this.hideRoomPanel();
    }

    /**
     * 验证房间号格式（4位数字）
     */
    private validateRoomId(roomId: string): boolean {
        const regex = /^\d{4}$/;
        return regex.test(roomId);
    }

    /**
     * 启用/禁用主界面按钮（防止点击穿透）
     */
    private setMainButtonsEnabled(enabled: boolean): void {
        if (this.createRoomButton) {
            this.createRoomButton.interactable = enabled;
        }
        if (this.joinRoomButton) {
            this.joinRoomButton.interactable = enabled;
        }
        if (this.backButton) {
            this.backButton.interactable = enabled;
        }
    }

    // ==================== 网络事件处理 ====================

    /**
     * 房间创建成功
     */
    private onRoomCreated = (data: RoomCreatedEvent) => {
        console.log('[Lobby] Room created successfully:', data);

        // 保存房间信息到 LocalRoomStore
        const localRoomStore = LocalRoomStore.getInstance();
        const roomData: RoomData = {
            id: data.roomId,
            name: `Room ${data.roomId}`,
            gameModeId: this.currentGameMode,
            state: RoomState.WAITING,
            hostId: data.playerId,
            players: [{
                id: data.playerId,
                name: data.playerName,
                isReady: false,
                isHost: true,
                seatIndex: 0
            }],
            maxPlayers: data.maxPlayers, // 使用服务器返回的玩家数量
            isPrivate: false,
            createdAt: Date.now()
        };

        localRoomStore.setCurrentRoom(roomData);
        // 保存服务器分配的玩家ID到 LocalRoomStore
        localRoomStore.setMyPlayerId(data.playerId);
        console.log('[Lobby] Room data saved to LocalRoomStore:', roomData);
        console.log('[Lobby] Player ID saved to LocalRoomStore:', data.playerId);

        // 确保 sceneManager 已初始化
        if (!this.sceneManager) {
            console.error('[Lobby] SceneManager is null, reinitializing...');
            this.sceneManager = SceneManager.getInstance();
        }

        // 跳转到游戏场景（在线模式）
        this.sceneManager.goToGame({
            roomId: data.roomId,
            gameMode: this.currentGameMode,
            isOnlineMode: true  // 标记为在线模式
        });
    }

    /**
     * 房间加入成功
     */
    private onRoomJoined = (data: RoomJoinedEvent) => {
        console.log('[Lobby] Successfully joined room:', data);

        // 保存房间信息到 LocalRoomStore
        const localRoomStore = LocalRoomStore.getInstance();
        const myPlayerInfo = data.players.find(p => p.id === data.playerId);
        const roomData: RoomData = {
            id: data.roomId,
            name: `Room ${data.roomId}`,
            gameModeId: this.currentGameMode,
            state: RoomState.WAITING,
            hostId: data.players.find(p => p.isHost)?.id || data.players[0]?.id || '',
            players: data.players,
            maxPlayers: data.maxPlayers, // 使用服务器返回的玩家数量
            isPrivate: false,
            createdAt: Date.now()
        };

        localRoomStore.setCurrentRoom(roomData);
        // 保存服务器分配的玩家ID到 LocalRoomStore
        localRoomStore.setMyPlayerId(data.playerId);
        console.log('[Lobby] Room data saved to LocalRoomStore:', roomData);
        console.log('[Lobby] Player ID saved to LocalRoomStore:', { id: data.playerId, isHost: myPlayerInfo?.isHost });

        // 隐藏面板
        this.hideRoomPanel();

        // 确保 sceneManager 已初始化
        if (!this.sceneManager) {
            console.error('[Lobby] SceneManager is null, reinitializing...');
            this.sceneManager = SceneManager.getInstance();
        }

        // 跳转到游戏场景（在线模式）
        this.sceneManager.goToGame({
            roomId: data.roomId,
            gameMode: this.currentGameMode,
            isOnlineMode: true  // 标记为在线模式
        });
    }

    /**
     * 网络错误处理
     */
    private onNetworkError = (error: ErrorEvent) => {
        console.error('[Lobby] Network error:', error);

        // 根据错误码显示友好提示
        let errorMessage = '操作失败';

        switch (error.code) {
            case 'ROOM_NOT_FOUND':
                errorMessage = '房间不存在';
                break;
            case 'ROOM_FULL':
                errorMessage = '房间已满';
                break;
            case 'INTERNAL_ERROR':
                errorMessage = '服务器错误';
                break;
            default:
                errorMessage = error.message || '未知错误';
        }

        this.showStatus(errorMessage);
    }

    /**
     * Show status message
     */
    private showStatus(message: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = message;

            // Auto-hide after 3 seconds
            this.scheduleOnce(() => {
                if (this.statusLabel) {
                    this.statusLabel.string = '';
                }
            }, 3);
        }
    }

    /**
     * 处理 UI_NAVIGATE_TO_GAME 事件（重连成功后跳转到游戏场景）
     */
    private onNavigateToGame = () => {
        console.log('[Lobby] Navigating to game scene (reconnect or join)');

        // 确保 sceneManager 已初始化
        if (!this.sceneManager) {
            this.sceneManager = SceneManager.getInstance();
        }

        // 获取当前房间信息
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();

        if (currentRoom) {
            // 跳转到游戏场景
            this.sceneManager.goToGame({
                roomId: currentRoom.id,
                gameMode: currentRoom.gameModeId || this.currentGameMode,
                isOnlineMode: true
            });
        } else {
            console.error('[Lobby] No room data found for navigation');
        }
    };

    onDestroy() {
        // Clean up EventCenter listeners
        EventCenter.off(GameEvents.UI_NAVIGATE_TO_GAME, this.onNavigateToGame, this);
        // Clean up event listeners with null checks
        if (this.createRoomButton?.node && this.createRoomButton.isValid) {
            this.createRoomButton.node.off(Button.EventType.CLICK, this.onCreateRoomClicked, this);
        }
        if (this.joinRoomButton?.node && this.joinRoomButton.isValid) {
            this.joinRoomButton.node.off(Button.EventType.CLICK, this.onJoinRoomClicked, this);
        }
        if (this.backButton?.node && this.backButton.isValid) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClicked, this);
        }

        // Clean up RoomPanel event listeners
        if (this.btnConfirm?.node && this.btnConfirm.isValid) {
            this.btnConfirm.node.off(Button.EventType.CLICK, this.onRoomPanelConfirmClicked, this);
        }
        if (this.btnClose?.node && this.btnClose.isValid) {
            this.btnClose.node.off(Button.EventType.CLICK, this.onRoomPanelCloseClicked, this);
        }

        // Clean up network event listeners（使用箭头函数，不需要 bind）
        if (this.networkClient) {
            this.networkClient.off('room_created', this.onRoomCreated);
            this.networkClient.off('room_joined', this.onRoomJoined);
            this.networkClient.off('error', this.onNetworkError);

            // 不要断开连接！NetworkManager 会管理连接的生命周期
            // this.networkClient.disconnect();
        }
    }
}
