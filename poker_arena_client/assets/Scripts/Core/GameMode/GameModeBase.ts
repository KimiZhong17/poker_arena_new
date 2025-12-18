import { Game } from "../../Game";
import { PlayerLayoutConfig } from "./PlayerLayoutConfig";
import { Player } from "../Player";
import { RoomManager } from "../Room/RoomManager";

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
 * Base class for all game modes
 *
 * 所有游戏模式（TheDecree、Guandan等）都必须继承此类
 *
 * 职责：
 * - 实现游戏规则逻辑
 * - 管理游戏状态
 * - 控制游戏模式相关的UI
 * - 处理玩家操作
 *
 * 生命周期：
 * 1. constructor - 创建时
 * 2. onEnter - 进入此模式时（初始化游戏、显示UI）
 * 3. update - 每帧更新（可选）
 * 4. onExit - 离开此模式时（清理状态、隐藏UI）
 * 5. cleanup - 销毁时（释放资源）
 */
export abstract class GameModeBase {
    protected game: Game;
    protected config: GameModeConfig;
    protected isActive: boolean = false;

    // UI 用的 Player 对象数组
    // 所有游戏模式都需要这个来驱动 PlayerUIManager
    protected uiPlayers: Player[] = [];

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
     * 实现此方法时应该：
     * 1. 初始化游戏状态
     * 2. 显示UI
     * 3. 设置玩家布局
     * 4. 开始游戏流程（如发牌）
     */
    public onEnter(): void {
        console.log(`[${this.config.name}] Entering game mode`);
        this.isActive = true;
        this.showUI();
    }

    /**
     * 离开此游戏模式时调用
     * 实现此方法时应该：
     * 1. 清理游戏状态
     * 2. 隐藏UI
     * 3. 停止游戏流程
     */
    public onExit(): void {
        console.log(`[${this.config.name}] Exiting game mode`);
        this.isActive = false;
        this.hideUI();
    }

    /**
     * 每帧更新（可选实现）
     * 如果游戏模式需要逐帧更新逻辑，可以覆盖此方法
     * @param deltaTime 距离上一帧的时间间隔（秒）
     */
    public update?(deltaTime: number): void;

    /**
     * 清理资源
     * 在游戏模式不再使用时调用
     */
    public cleanup(): void {
        console.log(`[${this.config.name}] Cleaning up`);
        this.isActive = false;
    }

    // ==================== UI 控制接口 ====================

    /**
     * 显示游戏模式相关UI
     * 子类必须实现此方法来显示特定游戏模式的UI元素
     * 例如：显示特定的按钮、面板、公共牌区域等
     */
    public abstract showUI(): void;

    /**
     * 隐藏游戏模式相关UI
     * 子类必须实现此方法来隐藏特定游戏模式的UI元素
     */
    public abstract hideUI(): void;

    // ==================== UI 玩家管理（所有模式通用）====================

    /**
     * 从 RoomManager 获取玩家名称
     * 如果找不到则返回默认名称
     *
     * @param playerId 玩家ID
     * @param defaultName 默认名称（如果在房间中找不到）
     * @protected
     */
    protected getPlayerNameFromRoom(playerId: string, defaultName: string): string {
        const roomManager = RoomManager.getInstance();
        const currentRoom = roomManager.getCurrentRoom();

        if (currentRoom) {
            const roomPlayer = currentRoom.players.find(p => p.id === playerId);
            if (roomPlayer) {
                return roomPlayer.name;
            }
        }

        return defaultName;
    }

    /**
     * 创建 UI 用的 Player 对象
     * 基于 playerIds 创建 Player 实例，用于驱动 PlayerUIManager
     * 自动从 RoomManager 获取玩家名称
     *
     * @param playerIds 玩家ID数组（例如：['player_0', 'player_1', ...]）
     * @protected 子类在 initGame() 中调用此方法
     */
    protected createUIPlayers(playerIds: string[]): void {
        this.uiPlayers = [];

        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            // 从 RoomManager 获取玩家名称，如果找不到则使用默认名称
            const playerName = this.getPlayerNameFromRoom(playerId, `Player ${i + 1}`);
            const player = new Player(i, playerName, i);
            this.uiPlayers.push(player);
        }

        console.log(`[${this.config.name}] Created ${this.uiPlayers.length} UI players`);
    }

    /**
     * 初始化 PlayerUIManager
     * 将 uiPlayers 设置到 GameController，并初始化 PlayerUIManager
     *
     * @protected 子类在 onEnter() 中调用此方法（通常在 dealCards() 之后）
     */
    protected initializePlayerUIManager(): void {
        const playerUIManager = this.game.playerUIManager;
        const gameController = this.game.gameController;

        if (!playerUIManager) {
            console.error(`[${this.config.name}] PlayerUIManager not found!`);
            return;
        }

        if (!gameController) {
            console.error(`[${this.config.name}] GameController not found!`);
            return;
        }

        // 设置 GameController 的 players（用于 PlayerUIManager）
        // @ts-ignore - accessing private property
        gameController['_players'] = this.uiPlayers;

        // 获取 poker 资源（从 Game 获取）
        // @ts-ignore - accessing private property
        const pokerSprites = this.game['_pokerSprites'];
        // @ts-ignore - accessing private property
        const pokerPrefab = this.game['_pokerPrefab'];

        if (!pokerSprites || !pokerPrefab) {
            console.error(`[${this.config.name}] Poker resources not loaded!`);
            return;
        }

        // 初始化 PlayerUIManager
        playerUIManager.init(gameController, pokerSprites, pokerPrefab);

        console.log(`[${this.config.name}] PlayerUIManager initialized with ${this.uiPlayers.length} players`);
    }

    /**
     * 更新所有玩家的手牌显示
     * 子类需要在更新玩家手牌数据后调用此方法
     *
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
     * 获取 UI Player 对象
     * 供子类访问
     *
     * @param index 玩家索引
     * @protected
     */
    protected getUIPlayer(index: number): Player | null {
        return this.uiPlayers[index] || null;
    }

    /**
     * 获取所有 UI Player 对象
     *
     * @protected
     */
    protected getUIPlayers(): Player[] {
        return this.uiPlayers;
    }

    // ==================== 玩家布局 ====================

    /**
     * 调整玩家位置布局
     * 不同游戏模式可能有不同的玩家数量和布局
     *
     * 默认实现：使用 PlayerLayoutConfig 提供的标准布局
     * 子类可以：
     * 1. 直接使用此默认实现
     * 2. 调用 applyPlayerLayout() 但传入自定义配置
     * 3. 完全覆盖以实现自定义逻辑
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
    protected applyPlayerLayout(positions: Array<{ name: string; x: number; y: number; active: boolean }>): void {
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
                    handNode.setPosition(config.x, config.y, 0);
                }
            }
        }
    }

    // ==================== 游戏逻辑接口 ====================

    /**
     * Initialize game state
     */
    public abstract initGame(playerIds: string[]): void;

    /**
     * Deal cards to players
     */
    public abstract dealCards(): void;

    /**
     * Validate if a play is legal
     */
    public abstract isValidPlay(cards: number[], playerId: string): boolean;

    /**
     * Process a player's play
     */
    public abstract playCards(cards: number[], playerId: string): boolean;

    /**
     * Check if game is over
     */
    public abstract isGameOver(): boolean;

    /**
     * Get current level rank (for games like Guandan)
     * 如果游戏模式不需要level rank，可以返回0
     */
    public abstract getCurrentLevelRank(): number;

    // ==================== 状态查询 ====================

    /**
     * 检查游戏模式是否活跃
     */
    public isGameModeActive(): boolean {
        return this.isActive;
    }
}
