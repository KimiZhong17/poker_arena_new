import { Game } from "../../Game";
import { PlayerLayoutConfig } from "./PlayerLayoutConfig";
import { Player, PlayerInfo } from "../Player";
import { ClientMessageType, DealerCallRequest, PlayCardsRequest } from "../../Network/Messages";

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
 * 重构后的职责：
 * - 定义游戏模式的生命周期接口
 * - 提供 PlayerUIManager 初始化的通用方法
 * - 提供网络事件管理的通用框架（注册/注销/处理）
 * - 子类负责创建和管理 PlayerManager（数据层）
 * - 通过 Game 访问 PlayerUIManager（UI层）
 *
 * 架构：
 * GameModeClientBase (协调者)
 * ├── PlayerManager (数据层，子类管理)
 * ├── PlayerUIManager (UI层，从 Game 访问)
 * └── NetworkClient (网络层，从 Game 访问)
 */
export abstract class GameModeClientBase {
    protected game: Game;
    protected config: GameModeConfig;
    protected isActive: boolean = false;

    // 网络事件处理器存储（用于注销）
    protected networkEventHandlers: Map<string, Function> = new Map();

    // 玩家 ID 映射 (playerId -> playerIndex)
    protected playerIdToIndexMap: Map<string, number> = new Map();

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
        console.log(`[${this.config.name}] Entering game mode`);
        this.isActive = true;
        this.showUI();
    }

    /**
     * 离开此游戏模式时调用
     */
    public onExit(): void {
        console.log(`[${this.config.name}] Exiting game mode`);
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
        console.log(`[${this.config.name}] Cleaning up`);
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
        console.log(`[${this.config.name}] initializePlayerUIManager() - Starting...`);

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error(`[${this.config.name}] PlayerUIManager not found!`);
            return;
        }

        // 获取 poker 资源（从 Game 获取）
        // @ts-ignore - accessing private property
        const pokerSprites = this.game['_pokerSprites'];
        // @ts-ignore - accessing private property
        const pokerPrefab = this.game['_pokerPrefab'];

        if (!pokerSprites || !pokerPrefab) {
            console.error(`[${this.config.name}] Poker resources not loaded!`);
            return;
        }

        // 获取布局配置
        const layoutConfig = PlayerLayoutConfig.getStandardLayout(players.length);

        console.log(`[${this.config.name}] Initializing PlayerUIManager with ${players.length} players`);
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            console.log(`  - Player ${i}: ${player.name}, cards: ${player.handCards.length}`);
        }

        // 初始化 PlayerUIManager（新接口）
        playerUIManager.init(
            players,                      // Player 数组
            pokerSprites,                 // 扑克牌精灵
            pokerPrefab,                  // 扑克牌预制体
            this.getCurrentLevelRank(),   // 关卡等级
            layoutConfig,                 // 布局配置
            enableGrouping                // 是否启用分组堆叠
        );

        console.log(`[${this.config.name}] PlayerUIManager initialized`);
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
     * 默认实现：使用 PlayerLayoutConfig 提供的标准布局
     * 子类可以覆盖以实现自定义布局
     */
    public adjustPlayerLayout(): void {
        const playerCount = this.config.maxPlayers;
        console.log(`[${this.config.name}] Adjusting player layout for ${playerCount} players`);

        const positions = PlayerLayoutConfig.getStandardLayout(playerCount);
        this.applyPlayerLayout(positions);

        const layoutName = PlayerLayoutConfig.getLayoutName(playerCount);
        console.log(`[${this.config.name}] Player layout adjusted: ${playerCount} players in ${layoutName} formation`);
    }

    /**
     * 应用玩家布局配置
     * 将位置配置应用到实际的节点上
     *
     * @param positions 位置配置数组
     * @protected 子类可以调用此方法来应用自定义配置
     */
    protected applyPlayerLayout(positions: import('./PlayerLayoutConfig').PlayerPosition[]): void {
        const handsManagerNode = this.game.playerUIManagerNode;
        if (!handsManagerNode) {
            console.warn(`[${this.config.name}] PlayerUIManagerNode not found`);
            return;
        }

        // 应用布局配置
        for (const config of positions) {
            const handNode = handsManagerNode.getChildByName(config.name);
            if (handNode) {
                handNode.active = config.active;
                if (config.active) {
                    // 使用 fallback 坐标（如果有）或保持原位置
                    // Widget 会在节点添加到场景后自动应用锚点
                    if (config.fallbackX !== undefined && config.fallbackY !== undefined) {
                        handNode.setPosition(config.fallbackX, config.fallbackY, 0);
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
            console.error(`[${this.config.name}] Network client not available`);
            return null;
        }
        if (!network.getIsConnected()) {
            console.error(`[${this.config.name}] Network client not connected`);
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
            console.warn(`[${this.config.name}] Cannot register event '${eventName}': Network client not available`);
            return;
        }

        // 绑定 this 上下文
        const boundHandler = handler.bind(this);

        // 存储处理器用于注销
        this.networkEventHandlers.set(eventName, boundHandler);

        // 注册到网络客户端
        network.on(eventName, boundHandler);

        console.log(`[${this.config.name}] Registered network event: ${eventName}`);
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
            console.log(`[${this.config.name}] Unregistered network event: ${eventName}`);
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
        console.log(`[${this.config.name}] Player ID mapping setup:`, Array.from(this.playerIdToIndexMap.entries()));
    }

    /**
     * 从 playerId 获取 playerIndex
     */
    protected getPlayerIndex(playerId: string): number {
        const index = this.playerIdToIndexMap.get(playerId);
        if (index === undefined) {
            console.warn(`[${this.config.name}] Player ID not found in mapping: ${playerId}`);
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

        console.log(`[${this.config.name}] Sending network request: ${eventName}`, data);
        return network.send(eventName, data);
    }

    // ==================== 游戏特定网络请求（The Decree 游戏）====================

    /**
     * 庄家叫牌请求
     * @param cardsToPlay 要出的牌数（1、2或3）
     */
    protected sendDealerCallRequest(cardsToPlay: 1 | 2 | 3): boolean {
        const network = this.getNetworkClient();
        if (!network) {
            return false;
        }

        const request: DealerCallRequest = {
            roomId: network.getRoomId(),
            playerId: network.getPlayerId(),
            cardsToPlay
        };

        console.log(`[${this.config.name}] Dealer calling ${cardsToPlay} cards`);
        return network.send(ClientMessageType.DEALER_CALL, request);
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

        const request: PlayCardsRequest = {
            roomId: network.getRoomId(),
            playerId: network.getPlayerId(),
            cards
        };

        console.log(`[${this.config.name}] Playing cards:`, cards);
        return network.send(ClientMessageType.PLAY_CARDS, request);
    }
}
