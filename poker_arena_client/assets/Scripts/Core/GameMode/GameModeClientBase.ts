import { Game } from "../../Game";
import { SeatLayoutConfig, SeatPosition } from "../../Config/SeatConfig";
import { Player, PlayerInfo } from "../../LocalStore/LocalPlayerStore";
import { ClientMessageType, DealerCallRequest, PlayCardsRequest } from "../../Network/Messages";
import { LocalRoomStore } from "../../LocalStore/LocalRoomStore";
import { Node } from "cc";
import { logger } from '../../Utils/Logger';

// Forward declarations for handler types (avoid circular imports)
import type { DealingHandler } from "./Handlers/DealingHandler";
import type { ShowdownHandler } from "./Handlers/ShowdownHandler";
import type { ReconnectHandler } from "./Handlers/ReconnectHandler";

const log = logger('GameMode');

/**
 * Game mode configuration
 */
export interface GameModeConfig {
    id: string;
    name: string;
    displayName: string;
    minPlayers: number;
    maxPlayers: number;
    deckCount: number;        // Number of decks
    initialHandSize: number;  // Initial cards per player
    description: string;
}

/**
 * Base class for all client-side game modes
 *
 * 架构：
 * GameModeClientBase (协调者 + 通用工具)
 * ├── DealingHandler   (发牌动画，子类初始化)
 * ├── ShowdownHandler  (摊牌展示，子类初始化)
 * ├── ReconnectHandler (重连恢复，子类初始化)
 * ├── PlayerUIManager  (UI层，从 Game 访问)
 * └── NetworkClient    (网络层，从 Game 访问)
 */
export abstract class GameModeClientBase {
    protected game: Game;
    protected config: GameModeConfig;
    protected isActive: boolean = false;

    // 网络事件处理器存储（用于注销）
    protected networkEventHandlers: Map<string, Function> = new Map();

    // 玩家 ID 映射 (playerId -> playerIndex)
    protected playerIdToIndexMap: Map<string, number> = new Map();

    // ---- 通用游戏状态（子类可读写）----
    protected communityCards: number[] = [];
    protected dealerId: string = '';
    protected currentRoundNumber: number = 0;
    protected cardsToPlay: number = 0;

    // ---- 定时器管理 ----
    protected _pendingTimeouts: number[] = [];

    // ---- Handler 引用（子类在 onEnter 中初始化）----
    protected dealingHandler: DealingHandler | null = null;
    protected showdownHandler: ShowdownHandler | null = null;
    protected reconnectHandler: ReconnectHandler | null = null;

    constructor(game: Game, config: GameModeConfig) {
        this.game = game;
        this.config = config;
    }

    public getConfig(): GameModeConfig {
        return { ...this.config };
    }

    // ==================== 生命周期方法 ====================

    /**
     * 进入此游戏模式时调用
     * 子类应该覆盖此方法并：
     * 1. 调用 super.onEnter()
     * 2. 初始化 PlayerManager
     * 3. 调用 initGame()
     * 4. 调用 dealCards()
     */
    public onEnter(): void {
        log.debug(`[${this.config.name}] Entering game mode`);
        this.isActive = true;
        this.showUI();
    }

    /**
     * 离开此游戏模式时调用
     */
    public onExit(): void {
        log.debug(`[${this.config.name}] Exiting game mode`);
        this.isActive = false;
        this.hideUI();
    }

    /**
     * 每帧更新（可选实现）
     */
    public update?(deltaTime: number): void;

    /**
     * 清理资源
     */
    public cleanup(): void {
        log.debug(`[${this.config.name}] Cleaning up`);
        this.isActive = false;
    }

    // ==================== UI 控制接口 ====================

    /**
     * 显示游戏模式相关UI
     * 子类必须实现此方法
     */
    public abstract showUI(): void;

    /**
     * 隐藏游戏模式相关UI
     * 子类必须实现此方法
     */
    public abstract hideUI(): void;

    // ==================== PlayerUIManager 初始化（通用方法）====================

    /**
     * 初始化 PlayerUIManager
     * 子类在发牌后调用此方法
     *
     * @param players Player 数组（从 PlayerManager 获取）
     * @param enableGrouping 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）
     * @protected
     */
    protected initializePlayerUIManager(players: Player[], enableGrouping: boolean = true): void {
        log.debug(`[${this.config.name}] initializePlayerUIManager() - Starting...`);

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            log.error(`[${this.config.name}] PlayerUIManager not found!`);
            return;
        }

        // 获取 poker 资源（从 Game 获取）
        const pokerSprites = this.game.pokerSprites;
        const pokerPrefab = this.game.pokerPrefab;
        const glowMaterial = this.game.glowMaterial;
        log.debug(`[${this.config.name}] glowMaterial loaded:`, !!glowMaterial);

        if (!pokerSprites || !pokerPrefab) {
            log.error(`[${this.config.name}] Poker resources not loaded!`);
            return;
        }

        // 获取布局配置
        const layoutConfig = SeatLayoutConfig.getLayout(players.length);

        log.debug(`[${this.config.name}] Initializing PlayerUIManager with ${players.length} players`);
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            log.debug(`  - Player ${i}: ${player.name}, cards: ${player.handCards.length}`);
        }

        // 初始化 PlayerUIManager（新接口）
        playerUIManager.init(
            players,                      // Player 数组
            pokerSprites,                 // 扑克牌精灵
            pokerPrefab,                  // 扑克牌预制体
            this.getCurrentLevelRank(),   // 关卡等级
            layoutConfig,                 // 布局配置
            enableGrouping,               // 是否启用分组堆叠
            glowMaterial                  // 边缘光材质（可选）
        );

        log.debug(`[${this.config.name}] PlayerUIManager initialized`);
    }

    /**
     * 更新所有玩家的手牌显示
     * @protected
     */
    protected updateAllHandsDisplay(): void {
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.updateAllHands();
        }
    }

    /**
     * 更新特定玩家的手牌显示
     *
     * @param playerIndex 玩家索引
     * @param playedCards 已打出的牌（可选，用于高亮显示）
     * @protected
     */
    protected updatePlayerHandDisplay(playerIndex: number, playedCards: number[] = []): void {
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.updatePlayerHand(playerIndex, playedCards);
        }
    }

    /**
     * 更新所有玩家分数显示
     * @protected
     */
    protected updateAllScoresDisplay(): void {
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.updateAllPlayerInfo();
        }
    }

    /**
     * 更新特定玩家的分数显示
     * @param playerIndex 玩家索引
     * @param score 新分数
     * @protected
     */
    protected updatePlayerScoreDisplay(playerIndex: number, score: number): void {
        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.updatePlayerScore(playerIndex, score);
        }
    }

    // ==================== 玩家布局 ====================

    /**
     * 调整玩家位置布局
     * 默认实现：使用 SeatLayoutConfig 提供的标准布局
     * 子类可以覆盖以实现自定义布局
     */
    public adjustPlayerLayout(): void {
        const playerCount = this.config.maxPlayers;
        log.debug(`[${this.config.name}] Adjusting player layout for ${playerCount} players`);

        const positions = SeatLayoutConfig.getLayout(playerCount);
        this.applyPlayerLayout(positions);

        const layoutName = SeatLayoutConfig.getLayoutName(playerCount);
        log.debug(`[${this.config.name}] Player layout adjusted: ${playerCount} players in ${layoutName} formation`);
    }

    /**
     * 应用玩家布局配置
     * 将位置配置应用到实际的节点上
     *
     * @param positions 位置配置数组
     * @protected 子类可以调用此方法来应用自定义配置
     */
    protected applyPlayerLayout(positions: SeatPosition[]): void {
        const handsManagerNode = this.game.playerUIManagerNode;
        if (!handsManagerNode) {
            log.warn(`[${this.config.name}] PlayerUIManagerNode not found`);
            return;
        }

        // 应用布局配置
        for (const config of positions) {
            const handNode = handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                if (config.active) {
                    // 检查节点是否有 Widget 组件
                    const widget = handNode.getComponent('cc.Widget') as any;
                    if (widget) {
                        // 如果有 Widget，让 Widget 自己管理位置，不要手动 setPosition
                        // 强制更新一次 Widget 对齐以确保位置正确
                        widget.updateAlignment();
                        log.debug(`[${this.config.name}] ${config.name} has Widget, position managed by Widget`);
                    } else if (config.fallbackX !== undefined && config.fallbackY !== undefined) {
                        // 只有在没有 Widget 的情况下才使用 fallback 坐标
                        handNode.setPosition(config.fallbackX, config.fallbackY, 0);
                        log.debug(`[${this.config.name}] ${config.name} no Widget, using fallback position (${config.fallbackX}, ${config.fallbackY})`);
                    }
                }
            }
        }
    }

    // ==================== 游戏逻辑接口（子类必须实现）====================

    /**
     * Initialize game state
     * 子类实现：创建 PlayerManager，初始化玩家数据
     */
    public abstract initGame(playerInfos: PlayerInfo[]): void;

    /**
     * Deal cards to players
     * 子类实现：发牌逻辑，然后调用 initializePlayerUIManager()
     */
    public abstract dealCards(): void;

    /**
     * Validate if a play is legal
     * 子类实现：游戏规则验证
     */
    public abstract isValidPlay(cards: number[], playerId: string): boolean;

    /**
     * Process a player's play
     * 子类实现：处理玩家出牌
     */
    public abstract playCards(cards: number[], playerId: string): boolean;

    /**
     * Check if game is over
     * 子类实现：游戏结束判断
     */
    public abstract isGameOver(): boolean;

    /**
     * Get current level rank (for games like Guandan)
     * 如果游戏模式不需要 level rank，可以返回 0
     */
    public abstract getCurrentLevelRank(): number;

    // ==================== 状态查询 ====================

    /**
     * 检查游戏模式是否活跃
     */
    public isGameModeActive(): boolean {
        return this.isActive;
    }

    // ==================== 网络功能（通用方法）====================

    /**
     * 检查是否为网络模式
     */
    protected isNetworkMode(): boolean {
        return this.game.networkClient !== null && this.game.networkClient.getIsConnected();
    }

    /**
     * 获取网络客户端（带检查）
     */
    protected getNetworkClient() {
        const network = this.game.networkClient;
        if (!network) {
            log.error(`[${this.config.name}] Network client not available`);
            return null;
        }
        if (!network.getIsConnected()) {
            log.error(`[${this.config.name}] Network client not connected`);
            return null;
        }
        return network;
    }

    /**
     * 注册网络事件（通用框架）
     * 子类调用此方法注册事件，基类负责管理和注销
     */
    protected registerNetworkEvent(eventName: string, handler: Function): void {
        const network = this.game.networkClient;
        if (!network) {
            log.warn(`[${this.config.name}] Cannot register event '${eventName}': Network client not available`);
            return;
        }

        // 绑定 this 上下文
        const boundHandler = handler.bind(this);

        // 存储处理器用于注销
        this.networkEventHandlers.set(eventName, boundHandler);

        // 注册到网络客户端
        network.on(eventName, boundHandler);

        log.debug(`[${this.config.name}] Registered network event: ${eventName}`);
    }

    /**
     * 批量注册网络事件
     */
    protected registerNetworkEvents(events: { [eventName: string]: Function }): void {
        for (const [eventName, handler] of Object.entries(events)) {
            this.registerNetworkEvent(eventName, handler);
        }
    }

    /**
     * 注销所有网络事件
     * 在 onExit() 和 cleanup() 中自动调用
     */
    protected unregisterAllNetworkEvents(): void {
        const network = this.game.networkClient;
        if (!network) return;

        for (const [eventName, handler] of this.networkEventHandlers) {
            network.off(eventName, handler);
            log.debug(`[${this.config.name}] Unregistered network event: ${eventName}`);
        }

        this.networkEventHandlers.clear();
    }

    /**
     * 设置玩家 ID 映射
     * @param playerInfos 玩家信息数组（按 seatIndex 排序）
     */
    protected setupPlayerIdMapping(playerInfos: Array<{ id: string, seatIndex: number }>): void {
        this.playerIdToIndexMap.clear();
        for (const playerInfo of playerInfos) {
            this.playerIdToIndexMap.set(playerInfo.id, playerInfo.seatIndex);
        }
        log.debug(`[${this.config.name}] Player ID mapping setup:`, Array.from(this.playerIdToIndexMap.entries()));
    }

    /**
     * 从 playerId 获取 playerIndex
     */
    protected getPlayerIndex(playerId: string): number {
        const index = this.playerIdToIndexMap.get(playerId);
        if (index === undefined) {
            log.warn(`[${this.config.name}] Player ID not found in mapping: ${playerId}`);
            return -1;
        }
        return index;
    }

    /**
     * 发送网络请求（通用方法）
     * 子类可以使用此方法发送请求到服务器
     */
    protected sendNetworkRequest(eventName: string, data: any): boolean {
        const network = this.getNetworkClient();
        if (!network) {
            return false;
        }

        log.debug(`[${this.config.name}] Sending network request: ${eventName}`, data);
        return network.send(eventName, data);
    }

    // ==================== 游戏特定网络请求（The Decree 游戏）====================

    /**
     * 庄家叫牌请求
     * @param cardsToPlay 要出的牌数（1、2或3）
     */
    protected sendDealerCallRequest(cardsToPlay: 1 | 2 | 3): boolean {
        log.debug(`[${this.config.name}] sendDealerCallRequest called, cardsToPlay:`, cardsToPlay);

        const network = this.getNetworkClient();
        log.debug(`[${this.config.name}] Network client:`, !!network);

        if (!network) {
            log.error(`[${this.config.name}] No network client available`);
            return false;
        }

        const localRoomStore = LocalRoomStore.getInstance();

        const playerId = localRoomStore.getMyPlayerId();
        const currentRoom = localRoomStore.getCurrentRoom();

        log.debug(`[${this.config.name}] Player ID:`, playerId);
        log.debug(`[${this.config.name}] Current room:`, currentRoom?.id);

        if (!playerId || !currentRoom) {
            log.error(`[${this.config.name}] Cannot send dealer call: missing player or room info`);
            log.error(`[${this.config.name}]   playerId:`, playerId);
            log.error(`[${this.config.name}]   currentRoom:`, currentRoom);
            return false;
        }

        const request: DealerCallRequest = {
            roomId: currentRoom.id,
            playerId: playerId,
            cardsToPlay
        };

        log.debug(`[${this.config.name}] Sending dealer call request:`, request);
        const result = network.send(ClientMessageType.DEALER_CALL, request);
        log.debug(`[${this.config.name}] Send result:`, result);

        return result;
    }

    /**
     * 玩家出牌请求
     * @param cards 要出的牌
     */
    protected sendPlayCardsRequest(cards: number[]): boolean {
        const network = this.getNetworkClient();
        if (!network) {
            return false;
        }

        const localRoomStore = LocalRoomStore.getInstance();

        const playerId = localRoomStore.getMyPlayerId();
        const currentRoom = localRoomStore.getCurrentRoom();

        if (!playerId || !currentRoom) {
            log.error(`[${this.config.name}] Cannot send play cards: missing player or room info`);
            return false;
        }

        const request: PlayCardsRequest = {
            roomId: currentRoom.id,
            playerId: playerId,
            cards
        };

        log.debug(`[${this.config.name}] Playing cards:`, cards);
        return network.send(ClientMessageType.PLAY_CARDS, request);
    }

    // ==================== 通用工具方法 ====================

    /**
     * 递归查找节点
     */
    protected findNodeByName(root: Node, name: string): Node | null {
        if (root.name === name) return root;
        for (const child of root.children) {
            const found = this.findNodeByName(child, name);
            if (found) return found;
        }
        return null;
    }

    /**
     * 根据 playerId 获取玩家名字
     */
    public getPlayerName(playerId: string): string {
        const room = LocalRoomStore.getInstance().getCurrentRoom();
        if (room) {
            const playerInfo = room.players.find(p => p.id === playerId);
            if (playerInfo) return playerInfo.name;
        }
        return 'Unknown';
    }

    /**
     * 根据卡牌编码获取卡牌名称
     * Guandan 编码: A=14, 2=15, 3-13 标准
     */
    protected getCardName(card: number): string {
        const suits = ['♦', '♣', '♥', '♠'];
        const pointMap: Record<number, string> = {
            3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
            10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
        };
        const suit = (card & 0xF0) >> 4;
        const point = card & 0x0F;
        const suitStr = suits[suit];
        const pointStr = pointMap[point];
        return (suitStr && pointStr) ? suitStr + pointStr : '未知牌';
    }

    // ==================== 定时器管理 ====================

    public registerTimeout(callback: () => void, delayMs: number): void {
        const timerId = setTimeout(callback, delayMs) as unknown as number;
        this._pendingTimeouts.push(timerId);
    }

    protected clearPendingTimeouts(): void {
        for (const timerId of this._pendingTimeouts) {
            clearTimeout(timerId);
        }
        this._pendingTimeouts = [];
    }

    // ==================== 座位映射 ====================

    /**
     * 刷新玩家 ID → 相对座位索引映射
     * 当前玩家始终映射到 index 0
     */
    protected refreshPlayerIdMapping(): void {
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            log.warn(`[${this.config.name}] No current room for player mapping`);
            return;
        }

        const myPlayerId = localRoomStore.getMyPlayerId();
        const myPlayerInfo = currentRoom.players.find(p => p.id === myPlayerId);
        const mySeatIndex = myPlayerInfo?.seatIndex ?? 0;
        const totalSeats = currentRoom.maxPlayers;

        this.playerIdToIndexMap.clear();
        for (const playerInfo of currentRoom.players) {
            const relativeIndex = (playerInfo.seatIndex - mySeatIndex + totalSeats) % totalSeats;
            this.playerIdToIndexMap.set(playerInfo.id, relativeIndex);
        }

        log.debug(`[${this.config.name}] Player ID mapping refreshed:`, Array.from(this.playerIdToIndexMap.entries()));
    }

    /**
     * 升级 PlayerUIManager 到游戏模式（ROOM → GAME）
     */
    public upgradePlayerUIToPlayingMode(): void {
        log.debug(`[${this.config.name}] Upgrading PlayerUIManager to Playing mode...`);

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            log.error(`[${this.config.name}] PlayerUIManager not found!`);
            return;
        }

        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            log.error(`[${this.config.name}] No current room found!`);
            return;
        }

        const myPlayerId = localRoomStore.getMyPlayerId();
        const myPlayerInfo = currentRoom.players.find(p => p.id === myPlayerId);
        const mySeatIndex = myPlayerInfo?.seatIndex ?? 0;

        // 如果 PlayerUIManager 未初始化（重连跳过 ReadyStage 的场景）
        if (playerUIManager.maxSeats === 0) {
            log.debug(`[${this.config.name}] PlayerUIManager not initialized, calling initForReadyStage first...`);
            const layoutConfig = SeatLayoutConfig.getLayout(currentRoom.maxPlayers);
            playerUIManager.initForReadyStage(
                currentRoom.players,
                currentRoom.maxPlayers,
                mySeatIndex,
                layoutConfig
            );
        }

        // 重新映射玩家位置：当前玩家 → index 0
        const totalSeats = currentRoom.maxPlayers;
        const remappedPlayers = [];
        for (let i = 0; i < totalSeats; i++) {
            const actualSeatIndex = (mySeatIndex + i) % totalSeats;
            const playerInfo = currentRoom.players.find(p => p.seatIndex === actualSeatIndex);
            if (playerInfo) {
                remappedPlayers.push({ ...playerInfo, displayIndex: i });
            }
        }

        // 设置映射：playerId -> displayIndex
        this.playerIdToIndexMap.clear();
        for (const player of remappedPlayers) {
            this.playerIdToIndexMap.set(player.id, player.displayIndex);
        }

        log.debug(`[${this.config.name}] Player ID mapping:`, Array.from(this.playerIdToIndexMap.entries()));

        // 转换为 Player 对象
        const players = remappedPlayers.map(playerInfo => new Player(playerInfo));

        const pokerSprites = this.game.pokerSprites;
        const pokerPrefab = this.game.pokerPrefab;
        const glowMaterial = this.game.glowMaterial;

        if (!pokerSprites || !pokerPrefab) {
            log.error(`[${this.config.name}] Poker resources not loaded!`);
            return;
        }

        playerUIManager.upgradeToPlayingMode(
            players,
            pokerSprites,
            pokerPrefab,
            this.getCurrentLevelRank(),
            this.getEnableGrouping(),
            glowMaterial
        );

        log.debug(`[${this.config.name}] PlayerUIManager upgraded to Playing mode`);
    }

    // ==================== 钩子方法（子类覆盖）====================

    /** 发牌动画完成后回调，子类覆盖以启用选牌等 */
    public onDealAnimationComplete(): void {}

    /** 显示消息提示，子类覆盖以使用自己的 UIController */
    public showMessage(msg: string, duration: number): void {}

    /** 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false） */
    protected getEnableGrouping(): boolean { return false; }

    // ==================== Handler 访问 getter ====================

    public getGame(): Game { return this.game; }
    public getPlayerIndexByPlayerId(playerId: string): number { return this.getPlayerIndex(playerId); }
    public getPlayerIdToIndexMap(): Map<string, number> { return this.playerIdToIndexMap; }
    public getConfigRef(): GameModeConfig { return this.config; }
    public getDealerId(): string { return this.dealerId; }

    /**
     * 提前清除摊牌显示（在发牌动画更新 handCards 之前调用）
     * 防止 showdown 定时器在动画期间触发 updateDisplay 覆盖动画状态
     */
    public flushShowdownCleanup(): void {
        if (this.showdownHandler) {
            this.showdownHandler.clearShowdownDisplay();
        }
    }

    /**
     * 检查发牌动画是否正在进行中
     */
    public isDealingInProgress(): boolean {
        if (this.dealingHandler && 'isDealingAnimationInProgress' in this.dealingHandler) {
            return (this.dealingHandler as any).isDealingAnimationInProgress;
        }
        return false;
    }
}
