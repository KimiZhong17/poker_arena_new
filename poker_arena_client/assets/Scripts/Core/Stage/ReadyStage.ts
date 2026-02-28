import { Button, Label, Node, Color } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Scenes/Game';
import { LocalRoomStore } from '../../State/RoomStore';
import { LocalUserStore } from '../../State/UserStore';
import { RoomService } from '../../Services/RoomService';
import { GameStage } from './StageManager';
import { EventCenter, GameEvents } from '../../Utils/EventCenter';
import { SeatLayoutConfig } from '../../Config/SeatConfig';
import { logger } from '../../Utils/Logger';

const log = logger('ReadyStage');

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

    // 防抖：上次按钮点击时间
    private lastButtonClickTime: number = 0;
    private readonly BUTTON_DEBOUNCE_MS: number = 500; // 500ms 防抖

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
        log.debug('Entering ready stage');
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

        log.debug('Waiting for players to ready up...');
        log.debug(`Local player: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}`);
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

        log.debug(`Local player initialized: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}, totalPlayers: ${this.totalPlayers}`);
    }

    /**
     * 初始化 PlayerUIManager（显示玩家座位和信息）
     * 🎯 优化：立即显示空座位UI，不等待网络数据
     */
    private initPlayerUIManager(): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            log.warn('PlayerUIManager not found on Game');
            return;
        }

        const currentRoom = this.localRoomStore.getCurrentRoom();

        // 🚀 优化：如果没有房间数据，先显示空座位（提升响应速度）
        if (!currentRoom) {
            log.debug('🚀 No room data yet, showing empty seats first for better UX');
            this.showEmptySeats(playerUIManager);
            return;
        }

        // 获取本地玩家信息
        const myPlayerInfo = this.localRoomStore.getMyPlayerInfo();
        if (!myPlayerInfo) {
            log.warn('🚀 Cannot find my player info yet, showing empty seats');
            this.showEmptySeats(playerUIManager);
            return;
        }

        // 有完整数据，正常初始化
        const layoutConfig = SeatLayoutConfig.getLayout(currentRoom.maxPlayers);

        log.debug(`Initializing PlayerUIManager with ${currentRoom.players.length} players, maxPlayers: ${currentRoom.maxPlayers}, mySeat: ${myPlayerInfo.seatIndex}`);
        playerUIManager.initForReadyStage(
            currentRoom.players,
            currentRoom.maxPlayers,
            myPlayerInfo.seatIndex,
            layoutConfig
        );
    }

    /**
     * 🎯 快速显示空座位（提升响应速度）
     * 让用户立即看到UI，而不是等待网络数据
     */
    private showEmptySeats(playerUIManager: any): void {
        const maxPlayers = this.totalPlayers || 4; // 默认4人房
        const emptyPlayers: any[] = [];

        for (let i = 0; i < maxPlayers; i++) {
            emptyPlayers.push({
                id: '',
                name: '等待玩家...',
                seatIndex: i,
                isReady: false,
                isHost: false
            });
        }

        const layoutConfig = SeatLayoutConfig.getLayout(maxPlayers);

        playerUIManager.initForReadyStage(
            emptyPlayers,
            maxPlayers,
            0, // 默认本地玩家在0号位
            layoutConfig
        );

        log.debug('✅ Empty seats displayed, waiting for room data...');
    }

    /**
     * 离开准备阶段
     */
    public onExit(): void {
        log.debug('Exiting ready stage');

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
        log.debug('Cleaning up EventCenter listeners');

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
            log.debug('UI shown');
        } else {
            log.warn('Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏准备阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            log.debug('UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        log.debug('Cleaning up');
        this.cleanupButtons();
        this.playerReadyStates.clear();
    }

    // ==================== 私有方法 ====================

    /**
     * 重置 TheDecreeUIController 状态
     * 用于游戏重启时清理上一局的状态
     */
    private resetTheDecreeUI(): void {
        log.debug('Attempting to reset TheDecreeUIController state');

        // TheDecree 在 Node_PlayStage 下
        const playStageNode = this.game.node.getChildByName('Node_PlayStage');
        if (!playStageNode) {
            log.warn('Node_PlayStage not found');
            return;
        }

        const theDecreeUINode = playStageNode.getChildByName('TheDecree');
        if (!theDecreeUINode) {
            log.warn('TheDecree not found under Node_PlayStage');
            return;
        }

        const theDecreeUIController = theDecreeUINode.getComponent('TheDecreeUIController') as any;
        if (theDecreeUIController && typeof theDecreeUIController.resetForRestart === 'function') {
            log.debug('Calling resetForRestart()...');
            theDecreeUIController.resetForRestart();
            log.debug('TheDecreeUIController reset complete');
        } else {
            log.warn('TheDecreeUIController component not found or resetForRestart method missing');
        }

        // 清理公牌节点的子元素（防止再来一局时看到上一局的公牌）
        // 注意：CommunityCardsNode 可能在 TheDecree 下或者在 game.node 下
        let communityCardsNode = theDecreeUINode.getChildByName('CommunityCardsNode');
        if (!communityCardsNode) {
            // 尝试从 game.node 查找
            communityCardsNode = this.game.node.getChildByName('CommunityCardsNode');
        }
        if (communityCardsNode) {
            log.debug('Clearing community cards node children');
            communityCardsNode.removeAllChildren();
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
            log.debug('========== resetReadyStates ==========');
            log.debug('Current room players:', currentRoom.players);
            for (const player of currentRoom.players) {
                // 使用玩家实际的准备状态，而不是强制设为 false
                this.playerReadyStates.set(player.id, player.isReady);
                log.debug(`Player ${player.id} (${player.name}): isReady = ${player.isReady}, isHost = ${player.isHost}`);
            }
            log.debug(`Reset ready states for ${currentRoom.players.length} players in room`);
            log.debug('=====================================');
        } else {
            // 单机模式：使用本地玩家ID和模拟玩家
            this.playerReadyStates.set(this.localPlayerId, false);

            // 添加其他模拟玩家（用于单机测试）
            for (let i = 1; i < this.totalPlayers; i++) {
                this.playerReadyStates.set(`player_${i}`, false);
            }
            log.debug(`Reset ready states for ${this.totalPlayers} players (single player mode)`);
        }
    }

    /**
     * 设置 EventCenter 事件监听
     */
    private setupEventListeners(): void {
        log.debug('Setting up EventCenter listeners');

        // 监听房间状态刷新事件
        this.onRoomRefreshHandler = () => {
            log.debug('Room refresh event received');
            this.refreshPlayerStates();
            this.updateButtonDisplay();
        };
        EventCenter.on(GameEvents.UI_REFRESH_ROOM, this.onRoomRefreshHandler, this);
    }

    /**
     * 从 LocalRoomStore 刷新玩家状态
     * 🎯 优化：当房间数据到达时，更新之前显示的空座位
     */
    private refreshPlayerStates(): void {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        if (!currentRoom) return;

        // 更新本地玩家的房主状态
        const localPlayer = currentRoom.players.find(p => p.id === this.localPlayerId);
        if (localPlayer) {
            this.isLocalPlayerHost = localPlayer.isHost;
            log.debug(`Local player host status updated: ${this.isLocalPlayerHost}`);
        }

        // 更新玩家准备状态
        this.playerReadyStates.clear();
        for (const player of currentRoom.players) {
            this.playerReadyStates.set(player.id, player.isReady);
        }

        log.debug('Player states refreshed from LocalRoomStore');

        // 🚀 优化：如果之前显示的是空座位，现在用真实数据更新
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            const myPlayerInfo = this.localRoomStore.getMyPlayerInfo();

            // 如果 PlayerUIManager 还没初始化（_maxSeats 为 0），尝试初始化
            if (playerUIManager.maxSeats === 0) {
                log.debug('PlayerUIManager not yet initialized, initializing now...');
                if (myPlayerInfo) {
                    const layoutConfig = SeatLayoutConfig.getLayout(currentRoom.maxPlayers);
                    playerUIManager.initForReadyStage(
                        currentRoom.players,
                        currentRoom.maxPlayers,
                        myPlayerInfo.seatIndex,
                        layoutConfig
                    );
                }
            } else {
                // 已初始化，只需更新座位信息
                log.debug('🔄 Updating seats with real player data');
                playerUIManager.updateSeats(currentRoom.players);
            }
        }
    }

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            log.warn('Cannot setup buttons: root node not set');
            return;
        }

        // 先清理旧的事件监听器，防止重复注册
        this.cleanupButtons();

        // 查找开始按钮
        this.btnStart = this.findStartButton();

        if (this.btnStart) {
            // 查找按钮上的 Label 组件（用于显示文字）
            this.btnLabel = this.btnStart.node.getComponentInChildren(Label);

            if (!this.btnLabel) {
                log.warn('No label found on start button, text will not be updated');
            } else {
                log.debug('Found label on start button');
            }

            // 注册点击事件
            this.btnStart.node.on(Button.EventType.CLICK, this.onStartButtonClicked, this);
            log.debug('Start button registered');
        } else {
            log.warn('Start button not found');
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
                log.debug('All players ready! Host can start game');
            } else {
                const readyCount = this.getReadyPlayerCount();
                log.debug(`Waiting for players: ${readyCount}/${this.totalPlayers - 1} ready`);
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
            log.debug('Start button unregistered');
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
                log.debug('Found start button by name: btn_start');
                return button;
            }
        }

        // 方式2: 遍历所有子节点查找第一个Button组件
        for (const child of this.rootNode.children) {
            const button = child.getComponent(Button);
            if (button) {
                log.debug(`Found start button by component: ${child.name}`);
                return button;
            }
        }

        return null;
    }

    /**
     * 开始按钮点击回调
     */
    private onStartButtonClicked(): void {
        // 防抖：防止短时间内重复点击
        const now = Date.now();
        if (now - this.lastButtonClickTime < this.BUTTON_DEBOUNCE_MS) {
            log.debug('Button click ignored (debounce)');
            return;
        }
        this.lastButtonClickTime = now;

        log.debug('Start button clicked');

        if (this.isLocalPlayerHost) {
            // 房主点击"开始游戏"
            if (this.allNonHostPlayersReady()) {
                log.debug('Host starting game...');
                this.startGame();
            } else {
                log.warn('Cannot start: not all players are ready');
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
            log.warn(`Unknown player: ${playerId}`);
            return;
        }

        // 房主不需要准备
        if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
            log.warn('Host does not need to ready up');
            return;
        }

        // 防止重复点击：如果已经准备好了，不再发送请求
        if (this.playerReadyStates.get(playerId) === true) {
            log.debug(`Player ${playerId} already ready, ignoring duplicate click`);
            return;
        }

        // 发送准备请求到服务器
        const networkClient = this.game.networkClient;
        if (networkClient && networkClient.getIsConnected()) {
            log.debug(`Sending ready request to server for player ${playerId}`);

            // 先更新本地状态，防止快速双击
            this.playerReadyStates.set(playerId, true);
            this.updateButtonDisplay();

            // 再发送请求到服务器
            this.roomService.toggleReady();
        } else {
            log.warn('Not connected to server, cannot send ready request');
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

        log.debug('========== allNonHostPlayersReady ==========');
        log.debug('Local player:', this.localPlayerId, 'isHost:', this.isLocalPlayerHost);
        log.debug('Player ready states:', Array.from(this.playerReadyStates.entries()));

        // 检查所有非房主玩家是否准备
        for (const [playerId, isReady] of this.playerReadyStates) {
            // 跳过房主
            if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
                log.debug(`Skipping host player: ${playerId}`);
                continue;
            }

            log.debug(`Checking player ${playerId}: isReady = ${isReady}`);
            if (!isReady) {
                log.debug('Not all non-host players ready');
                log.debug('=====================================');
                return false;
            }
        }

        log.debug('All non-host players ready!');
        log.debug('=====================================');
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
        log.debug('Starting game...');

        const networkClient = this.game.networkClient;
        if (networkClient && networkClient.getIsConnected()) {
            // 在线模式：发送开始游戏请求到服务器
            log.debug('Sending start game request to server');
            this.roomService.startGame();
        } else {
            // 单机模式：直接切换到Playing阶段
            log.debug('Single player mode, switching to Playing stage directly');
            const stageManager = this.game.stageManager;
            if (stageManager) {
                stageManager.switchToStage(GameStage.PLAYING);
            } else {
                log.error('StageManager not found on Game!');
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
            log.warn('Total players must be at least 1');
            return;
        }

        this.totalPlayers = count;
        log.debug(`Total players set to ${count}`);

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
