import { Game } from "../../Game";
import { PlayerLayoutConfig } from "./PlayerLayoutConfig";
import { Player, PlayerInfo } from "../Player";
import { PlayerManager } from "../PlayerManager";

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
 * 重构后的职责：
 * - 定义游戏模式的生命周期接口
 * - 提供 PlayerUIManager 初始化的通用方法
 * - 子类负责创建和管理 PlayerManager（数据层）
 * - 通过 Game 访问 PlayerUIManager（UI层）
 *
 * 架构：
 * GameMode (协调者)
 * ├── PlayerManager (数据层，子类管理)
 * └── PlayerUIManager (UI层，从 Game 访问)
 */
export abstract class GameModeBase {
    protected game: Game;
    protected config: GameModeConfig;
    protected isActive: boolean = false;

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
}
