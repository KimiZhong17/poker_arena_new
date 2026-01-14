import { Button, Label, Node, Color } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { LocalRoomStore } from '../../LocalStore/LocalRoomStore';
import { LocalUserStore } from '../../LocalStore/LocalUserStore';
import { RoomService } from '../../Services/RoomService';
import { GameStage } from './StageManager';
import { EventCenter, GameEvents } from '../../Utils/EventCenter';
import { PlayerLayoutConfig } from '../../UI/PlayerLayoutConfig';

/**
 * 准备阶段
 *
 * 职责：
 * - 显示准备阶段UI（Node_ReadyStage）
 * - 管理准备/开始按钮（btn_start）
 * - 跟踪玩家准备状态
 * - 房主显示"开始"按钮，仅当所有人准备好才可点击
 * - 非房主显示"准备"按钮，点击后变为"已准备"并禁用
 * - 所有玩家准备好后房主点击开始切换到Playing阶段
 *
 * 使用场景：
 * 1. 游戏刚开始时
 * 2. 从EndStage点击"再来一局"后
 *
 * 生命周期：
 * onEnter() -> 显示UI，注册按钮事件，重置状态
 * onExit() -> 隐藏UI，注销按钮事件
 */
export class ReadyStage extends GameStageBase {
    // start/ready button
    private btnStart: Button | null = null;
    private btnLabel: Label | null = null;

    // 玩家准备状态
    // key: playerId (e.g., 'player_0', 'player_1')
    // value: 是否已准备
    private playerReadyStates: Map<string, boolean> = new Map();

    // 配置
    private totalPlayers: number = 4; // 默认4人（The Decree模式）

    // 管理器引用
    private localRoomStore: LocalRoomStore;
    private localUserStore: LocalUserStore;
    private roomService: RoomService;

    // 本地玩家信息
    private localPlayerId: string = '';
    private isLocalPlayerHost: boolean = false;

    // EventCenter 事件处理器引用（用于清理）
    private onRoomRefreshHandler: (() => void) | null = null;

    constructor(game: Game, rootNode: Node | null = null) {
        super(game, rootNode);
        this.localRoomStore = LocalRoomStore.getInstance();
        this.localUserStore = LocalUserStore.getInstance();
        this.roomService = RoomService.getInstance();
    }

    /**
     * 进入准备阶段
     */
    public onEnter(): void {
        console.log('[ReadyStage] Entering ready stage');
        this.isActive = true;

        // 0. 重置 TheDecreeUIController 状态（用于游戏重启）
        this.resetTheDecreeUI();

        // 1. 获取本地玩家信息
        this.initLocalPlayerInfo();

        // 2. 重置状态
        this.resetReadyStates();

        // 3. 显示UI
        this.showUI();

        // 4. 初始化 PlayerUIManager（用于显示玩家信息）
        this.initPlayerUIManager();

        // 5. 设置按钮事件
        this.setupButtons();

        // 6. 设置 EventCenter 事件监听
        this.setupEventListeners();

        // 7. 更新按钮显示
        this.updateButtonDisplay();

        console.log('[ReadyStage] Waiting for players to ready up...');
        console.log(`[ReadyStage] Local player: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}`);
    }

    /**
     * 初始化本地玩家信息
     */
    private initLocalPlayerInfo(): void {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        const currentPlayerId = this.localRoomStore.getMyPlayerId();

        if (currentPlayerId) {
            this.localPlayerId = currentPlayerId;
        } else {
            // 单机模式：默认为 player_0
            this.localPlayerId = 'player_0';
        }

        if (currentRoom) {
            // 多人模式：检查是否是房主
            const localPlayer = currentRoom.players.find(p => p.id === this.localPlayerId);
            this.isLocalPlayerHost = localPlayer?.isHost || false;
            this.totalPlayers = currentRoom.maxPlayers;
        } else {
            // 单机模式：默认为房主
            this.isLocalPlayerHost = true;
            this.totalPlayers = 4;
        }

        console.log(`[ReadyStage] Local player initialized: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}, totalPlayers: ${this.totalPlayers}`);
    }

    /**
     * 初始化 PlayerUIManager（显示玩家座位和信息）
     */
    private initPlayerUIManager(): void {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            console.warn('[ReadyStage] No current room, skipping PlayerUIManager initialization');
            return;
        }

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.warn('[ReadyStage] PlayerUIManager not found on Game');
            return;
        }

        // 获取本地玩家信息
        const myPlayerInfo = this.localRoomStore.getMyPlayerInfo();
        if (!myPlayerInfo) {
            console.warn('[ReadyStage] Cannot find my player info yet, will retry on UI_REFRESH_ROOM');
            // 延迟初始化：等待 UI_REFRESH_ROOM 事件时再尝试
            return;
        }

        // 获取布局配置
        const layoutConfig = PlayerLayoutConfig.getStandardLayout(currentRoom.maxPlayers);

        // 初始化 PlayerUIManager
        console.log(`[ReadyStage] Initializing PlayerUIManager with ${currentRoom.players.length} players, maxPlayers: ${currentRoom.maxPlayers}, mySeat: ${myPlayerInfo.seatIndex}`);
        playerUIManager.initForReadyStage(
            currentRoom.players,
            currentRoom.maxPlayers,
            myPlayerInfo.seatIndex,
            layoutConfig
        );
    }

    /**
     * 离开准备阶段
     */
    public onExit(): void {
        console.log('[ReadyStage] Exiting ready stage');

        // 1. 清理按钮事件
        this.cleanupButtons();

        // 2. 清理 EventCenter 事件监听
        this.cleanupEventListeners();

        // 3. 调用基类的 onExit（会自动隐藏UI）
        super.onExit();
    }

    /**
     * 清理 EventCenter 事件监听
     */
    private cleanupEventListeners(): void {
        console.log('[ReadyStage] Cleaning up EventCenter listeners');

        if (this.onRoomRefreshHandler) {
            EventCenter.off(GameEvents.UI_REFRESH_ROOM, this.onRoomRefreshHandler, this);
            this.onRoomRefreshHandler = null;
        }
    }

    /**
     * 显示准备阶段UI
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
            console.log('[ReadyStage] UI shown');
        } else {
            console.warn('[ReadyStage] Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏准备阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            console.log('[ReadyStage] UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[ReadyStage] Cleaning up');
        this.cleanupButtons();
        this.playerReadyStates.clear();
    }

    // ==================== 私有方法 ====================

    /**
     * 重置 TheDecreeUIController 状态
     * 用于游戏重启时清理上一局的状态
     */
    private resetTheDecreeUI(): void {
        console.log('[ReadyStage] Attempting to reset TheDecreeUIController state');

        // TheDecree 在 Node_PlayStage 下
        const playStageNode = this.game.node.getChildByName('Node_PlayStage');
        if (!playStageNode) {
            console.warn('[ReadyStage] Node_PlayStage not found');
            return;
        }

        const theDecreeUINode = playStageNode.getChildByName('TheDecree');
        if (!theDecreeUINode) {
            console.warn('[ReadyStage] TheDecree not found under Node_PlayStage');
            return;
        }

        const theDecreeUIController = theDecreeUINode.getComponent('TheDecreeUIController') as any;
        if (theDecreeUIController && typeof theDecreeUIController.resetForRestart === 'function') {
            console.log('[ReadyStage] Calling resetForRestart()...');
            theDecreeUIController.resetForRestart();
            console.log('[ReadyStage] TheDecreeUIController reset complete');
        } else {
            console.warn('[ReadyStage] TheDecreeUIController component not found or resetForRestart method missing');
        }
    }

    /**
     * 重置所有玩家的准备状态
     */
    private resetReadyStates(): void {
        this.playerReadyStates.clear();

        // 在单机模式下，使用实际的玩家ID
        const currentRoom = this.localRoomStore.getCurrentRoom();

        if (currentRoom) {
            // 多人模式：使用房间中的玩家ID和实际的准备状态
            console.log('[ReadyStage] ========== resetReadyStates ==========');
            console.log('[ReadyStage] Current room players:', currentRoom.players);
            for (const player of currentRoom.players) {
                // 使用玩家实际的准备状态，而不是强制设为 false
                this.playerReadyStates.set(player.id, player.isReady);
                console.log(`[ReadyStage] Player ${player.id} (${player.name}): isReady = ${player.isReady}, isHost = ${player.isHost}`);
            }
            console.log(`[ReadyStage] Reset ready states for ${currentRoom.players.length} players in room`);
            console.log('[ReadyStage] =====================================');
        } else {
            // 单机模式：使用本地玩家ID和模拟玩家
            this.playerReadyStates.set(this.localPlayerId, false);

            // 添加其他模拟玩家（用于单机测试）
            for (let i = 1; i < this.totalPlayers; i++) {
                this.playerReadyStates.set(`player_${i}`, false);
            }
            console.log(`[ReadyStage] Reset ready states for ${this.totalPlayers} players (single player mode)`);
        }
    }

    /**
     * 设置 EventCenter 事件监听
     */
    private setupEventListeners(): void {
        console.log('[ReadyStage] Setting up EventCenter listeners');

        // 监听房间状态刷新事件
        this.onRoomRefreshHandler = () => {
            console.log('[ReadyStage] Room refresh event received');
            this.refreshPlayerStates();
            this.updateButtonDisplay();
        };
        EventCenter.on(GameEvents.UI_REFRESH_ROOM, this.onRoomRefreshHandler, this);
    }

    /**
     * 从 LocalRoomStore 刷新玩家状态
     */
    private refreshPlayerStates(): void {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        if (!currentRoom) return;

        // 更新本地玩家的房主状态
        const localPlayer = currentRoom.players.find(p => p.id === this.localPlayerId);
        if (localPlayer) {
            this.isLocalPlayerHost = localPlayer.isHost;
            console.log(`[ReadyStage] Local player host status updated: ${this.isLocalPlayerHost}`);
        }

        // 更新玩家准备状态
        this.playerReadyStates.clear();
        for (const player of currentRoom.players) {
            this.playerReadyStates.set(player.id, player.isReady);
        }

        console.log('[ReadyStage] Player states refreshed from LocalRoomStore');

        // 更新 PlayerUIManager 显示
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            // 如果 PlayerUIManager 还没初始化（_maxSeats 为 0），尝试初始化
            if ((playerUIManager as any)._maxSeats === 0) {
                console.log('[ReadyStage] PlayerUIManager not yet initialized, initializing now...');
                this.initPlayerUIManager();
            } else {
                // 已初始化，只需更新座位信息
                playerUIManager.updateSeats(currentRoom.players);
            }
        }
    }

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            console.warn('[ReadyStage] Cannot setup buttons: root node not set');
            return;
        }

        // 查找开始按钮
        this.btnStart = this.findStartButton();

        if (this.btnStart) {
            // 查找按钮上的 Label 组件（用于显示文字）
            this.btnLabel = this.btnStart.node.getComponentInChildren(Label);

            if (!this.btnLabel) {
                console.warn('[ReadyStage] No label found on start button, text will not be updated');
            } else {
                console.log('[ReadyStage] Found label on start button');
            }

            // 注册点击事件
            this.btnStart.node.on(Button.EventType.CLICK, this.onStartButtonClicked, this);
            console.log('[ReadyStage] Start button registered');
        } else {
            console.warn('[ReadyStage] Start button not found');
        }
    }

    /**
     * 更新按钮显示（文字和可用状态）
     * 只修改文字内容和按钮交互状态，保留原有的样式设置
     */
    private updateButtonDisplay(): void {
        if (!this.btnStart) {
            return;
        }

        if (this.isLocalPlayerHost) {
            // 房主显示"开始"
            if (this.btnLabel) {
                this.btnLabel.string = '开 始';
            }

            // 检查是否所有非房主玩家都已准备
            const allReady = this.allNonHostPlayersReady();

            // 控制按钮是否可点击
            this.btnStart.interactable = allReady;

            if (allReady) {
                console.log('[ReadyStage] All players ready! Host can start game');
            } else {
                const readyCount = this.getReadyPlayerCount();
                console.log(`[ReadyStage] Waiting for players: ${readyCount}/${this.totalPlayers - 1} ready`);
            }
        } else {
            // 非房主显示"准备"或"已准备"
            const isReady = this.playerReadyStates.get(this.localPlayerId) || false;

            if (isReady) {
                if (this.btnLabel) {
                    this.btnLabel.string = '已准备';
                }
                this.btnStart.interactable = false; // 禁用按钮
            } else {
                if (this.btnLabel) {
                    this.btnLabel.string = '准 备';
                }
                this.btnStart.interactable = true; // 启用按钮
            }
        }
    }

    /**
     * 清理按钮事件
     */
    private cleanupButtons(): void {
        if (this.btnStart && this.btnStart.node) {
            this.btnStart.node.off(Button.EventType.CLICK, this.onStartButtonClicked, this);
            this.btnStart = null;
            console.log('[ReadyStage] Start button unregistered');
        }
    }

    /**
     * 查找开始按钮
     * 尝试多种方式查找：
     * 1. 直接通过名称查找 'btn_start'
     * 2. 查找子节点中的Button组件
     */
    private findStartButton(): Button | null {
        if (!this.rootNode) return null;

        // 方式1: 通过名称查找
        const btnNode = this.rootNode.getChildByName('btn_start');
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                console.log('[ReadyStage] Found start button by name: btn_start');
                return button;
            }
        }

        // 方式2: 遍历所有子节点查找第一个Button组件
        for (const child of this.rootNode.children) {
            const button = child.getComponent(Button);
            if (button) {
                console.log(`[ReadyStage] Found start button by component: ${child.name}`);
                return button;
            }
        }

        return null;
    }

    /**
     * 开始按钮点击回调
     */
    private onStartButtonClicked(): void {
        console.log('[ReadyStage] Start button clicked');

        if (this.isLocalPlayerHost) {
            // 房主点击"开始游戏"
            if (this.allNonHostPlayersReady()) {
                console.log('[ReadyStage] Host starting game...');
                this.startGame();
            } else {
                console.warn('[ReadyStage] Cannot start: not all players are ready');
            }
        } else {
            // 非房主点击"准备"
            this.onPlayerReady(this.localPlayerId);
        }
    }

    /**
     * 玩家准备
     * @param playerId 玩家ID
     */
    private onPlayerReady(playerId: string): void {
        // 检查玩家是否存在
        if (!this.playerReadyStates.has(playerId)) {
            console.warn(`[ReadyStage] Unknown player: ${playerId}`);
            return;
        }

        // 房主不需要准备
        if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
            console.warn('[ReadyStage] Host does not need to ready up');
            return;
        }

        // 发送准备请求到服务器
        const networkClient = this.game.networkClient;
        if (networkClient && networkClient.getIsConnected()) {
            console.log(`[ReadyStage] Sending ready request to server for player ${playerId}`);
            this.roomService.toggleReady();

            // 本地临时更新状态（服务器会广播确认）
            this.playerReadyStates.set(playerId, true);
            this.updateButtonDisplay();
        } else {
            console.warn('[ReadyStage] Not connected to server, cannot send ready request');
        }
    }

    /**
     * 检查是否所有非房主玩家都准备好
     */
    private allNonHostPlayersReady(): boolean {
        // 在单机模式下，如果是房主，直接返回 true
        if (this.totalPlayers === 1 || !this.localRoomStore.getCurrentRoom()) {
            return true;
        }

        console.log('[ReadyStage] ========== allNonHostPlayersReady ==========');
        console.log('[ReadyStage] Local player:', this.localPlayerId, 'isHost:', this.isLocalPlayerHost);
        console.log('[ReadyStage] Player ready states:', Array.from(this.playerReadyStates.entries()));

        // 检查所有非房主玩家是否准备
        for (const [playerId, isReady] of this.playerReadyStates) {
            // 跳过房主
            if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
                console.log(`[ReadyStage] Skipping host player: ${playerId}`);
                continue;
            }

            console.log(`[ReadyStage] Checking player ${playerId}: isReady = ${isReady}`);
            if (!isReady) {
                console.log('[ReadyStage] Not all non-host players ready');
                console.log('[ReadyStage] =====================================');
                return false;
            }
        }

        console.log('[ReadyStage] All non-host players ready!');
        console.log('[ReadyStage] =====================================');
        return true;
    }

    /**
     * 获取已准备的玩家数量（不包括房主）
     */
    private getReadyPlayerCount(): number {
        let count = 0;
        for (const [playerId, isReady] of this.playerReadyStates) {
            // 跳过房主
            if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
                continue;
            }

            if (isReady) {
                count++;
            }
        }
        return count;
    }

    /**
     * 开始游戏
     * 房主发送开始游戏请求到服务器
     */
    private startGame(): void {
        console.log('[ReadyStage] Starting game...');

        const networkClient = this.game.networkClient;
        if (networkClient && networkClient.getIsConnected()) {
            // 在线模式：发送开始游戏请求到服务器
            console.log('[ReadyStage] Sending start game request to server');
            this.roomService.startGame();
        } else {
            // 单机模式：直接切换到Playing阶段
            console.log('[ReadyStage] Single player mode, switching to Playing stage directly');
            const stageManager = this.game.stageManager;
            if (stageManager) {
                stageManager.switchToStage(GameStage.PLAYING);
            } else {
                console.error('[ReadyStage] StageManager not found on Game!');
            }
        }
    }

    // ==================== 公共接口（供外部调用）====================

    /**
     * 设置总玩家数
     * 通常在多人游戏中使用
     * @param count 玩家数量
     */
    public setTotalPlayers(count: number): void {
        if (count < 1) {
            console.warn('[ReadyStage] Total players must be at least 1');
            return;
        }

        this.totalPlayers = count;
        console.log(`[ReadyStage] Total players set to ${count}`);

        // 如果已经进入阶段，重置状态
        if (this.isActive) {
            this.resetReadyStates();
        }
    }

    /**
     * 手动标记玩家为准备状态
     * 用于网络同步或测试
     * @param playerId 玩家ID
     */
    public markPlayerReady(playerId: string): void {
        this.onPlayerReady(playerId);
    }

    /**
     * 获取玩家准备状态
     * @param playerId 玩家ID
     */
    public isPlayerReady(playerId: string): boolean {
        return this.playerReadyStates.get(playerId) || false;
    }

    /**
     * 获取所有玩家的准备状态
     */
    public getAllReadyStates(): Map<string, boolean> {
        return new Map(this.playerReadyStates);
    }
}
