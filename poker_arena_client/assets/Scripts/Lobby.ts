// 必须在最前面导入 polyfills
import './Utils/polyfills';

import { _decorator, Component, Button, Label, EditBox, Node } from 'cc';
import { SceneManager } from './SceneManager';
import { AuthService } from './Services/AuthService';
import { RoomService } from './Services/RoomService';
import { LocalUserStore } from './LocalStore/LocalUserStore';
import { NetworkManager } from './Network/NetworkManager';
import { NetworkClient } from './Network/NetworkClient';
import { ErrorEvent, RoomJoinedEvent, RoomCreatedEvent } from './Network/Messages';
import { LocalRoomStore, RoomData, RoomState } from './LocalStore/LocalRoomStore';

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

    private authService: AuthService = null!;
    private roomService: RoomService = null!;
    private localUserStore: LocalUserStore = null!;
    private sceneManager: SceneManager = null!;
    private networkClient: NetworkClient | null = null;
    private currentGameMode: string = '';

    start() {
        this.authService = AuthService.getInstance();
        this.roomService = RoomService.getInstance();
        this.localUserStore = LocalUserStore.getInstance();
        this.sceneManager = SceneManager.getInstance();

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
        const serverUrl = 'http://localhost:3000'; // TODO: 从配置读取

        // 使用 NetworkManager 获取全局单例 NetworkClient
        const networkManager = NetworkManager.getInstance();
        this.networkClient = networkManager.getClient(serverUrl);

        // RoomService 会自己通过 NetworkManager 获取客户端，不需要手动设置

        // 如果已经连接，直接设置事件监听
        if (this.networkClient.getIsConnected()) {
            console.log('[Lobby] Already connected to server');
            this.setupNetworkEvents();
            return;
        }

        // 连接到服务器
        this.networkClient.connect()
            .then(() => {
                console.log('[Lobby] Connected to server');
                this.setupNetworkEvents();
            })
            .catch((error) => {
                console.error('[Lobby] Failed to connect to server:', error);
                this.showStatus('连接服务器失败');
            });
    }

    /**
     * 设置网络事件监听
     */
    private setupNetworkEvents(): void {
        if (!this.networkClient) return;

        // 监听房间创建成功
        this.networkClient.on('room_created', this.onRoomCreated.bind(this));

        // 监听房间加入成功
        this.networkClient.on('room_joined', this.onRoomJoined.bind(this));

        // 监听错误
        this.networkClient.on('error', this.onNetworkError.bind(this));
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

        console.log('[Lobby] RoomPanel elements found:', {
            roomPanelInput: !!this.roomPanelInput,
            btnConfirm: !!this.btnConfirm,
            btnClose: !!this.btnClose
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
     * Create a room via RoomService
     */
    private onCreateRoomClicked(): void {
        console.log('[Lobby] Create room clicked');

        if (!this.authService.isLoggedIn()) {
            console.error('[Lobby] No user logged in');
            this.showStatus('Error: User not logged in');
            return;
        }

        // 通过 RoomService 创建房间
        console.log('[Lobby] Creating room via RoomService...');
        this.roomService.createRoom(this.currentGameMode, 4);
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

        // 显示房间面板
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

            // 清空输入框
            if (this.roomPanelInput) {
                this.roomPanelInput.string = '';
            }

            console.log('[Lobby] RoomPanel shown');
        }
    }

    /**
     * 隐藏 RoomPanel
     */
    private hideRoomPanel(): void {
        if (this.roomPanel) {
            this.roomPanel.active = false;
            console.log('[Lobby] RoomPanel hidden');
        }
    }

    /**
     * RoomPanel 确认按钮点击
     */
    private onRoomPanelConfirmClicked(): void {
        console.log('[Lobby] RoomPanel confirm clicked');

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

    // ==================== 网络事件处理 ====================

    /**
     * 房间创建成功
     */
    private onRoomCreated(data: RoomCreatedEvent): void {
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
            maxPlayers: 4,
            isPrivate: false,
            createdAt: Date.now()
        };

        localRoomStore.setCurrentRoom(roomData);
        // 保存服务器分配的玩家ID到 LocalRoomStore
        localRoomStore.setMyPlayerId(data.playerId);
        console.log('[Lobby] Room data saved to LocalRoomStore:', roomData);
        console.log('[Lobby] Player ID saved to LocalRoomStore:', data.playerId);

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
    private onRoomJoined(data: RoomJoinedEvent): void {
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
            maxPlayers: 4,
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
    private onNetworkError(error: ErrorEvent): void {
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

    onDestroy() {
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

        // Clean up network event listeners
        if (this.networkClient) {
            this.networkClient.off('room_created', this.onRoomCreated.bind(this));
            this.networkClient.off('room_joined', this.onRoomJoined.bind(this));
            this.networkClient.off('error', this.onNetworkError.bind(this));

            // 不要断开连接！NetworkManager 会管理连接的生命周期
            // this.networkClient.disconnect();
        }
    }
}
