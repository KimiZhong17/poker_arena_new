/**
 * Game mode configuration
 */
export interface GameModeConfig {
    id: string;
    name: string;
    displayName: string;
    minPlayers: number;
    maxPlayers: number;
    deckCount: number;
    initialHandSize: number;
    description: string;
}

/**
 * Player information
 */
export interface PlayerInfo {
    id: string;
    name: string;
    seatIndex: number;
    isReady: boolean;
    isHost: boolean;
}

/**
 * Base class for all game modes (Server-side)
 *
 * 职责：
 * - 定义游戏模式的生命周期接口
 * - 管理游戏状态和逻辑
 * - 不包含任何 UI 相关代码
 */
import { Logger } from '../utils/Logger';

export abstract class GameModeBase {
    protected config: GameModeConfig;
    protected isActive: boolean = false;

    constructor(config: GameModeConfig) {
        this.config = config;
    }

    public getConfig(): GameModeConfig {
        return { ...this.config };
    }

    // ==================== 生命周期方法 ====================

    /**
     * 初始化游戏
     */
    public abstract initGame(playerInfos: PlayerInfo[]): void;

    /**
     * 开始游戏
     */
    public abstract startGame(): void;

    /**
     * 发牌
     */
    public abstract dealCards(): void;

    /**
     * 验证出牌是否合法
     */
    public abstract isValidPlay(cards: number[], playerId: string): boolean;

    /**
     * 处理玩家出牌
     */
    public abstract playCards(cards: number[], playerId: string): boolean;

    /**
     * 检查游戏是否结束
     */
    public abstract isGameOver(): boolean;

    /**
     * 清理资源
     */
    public cleanup(): void {
        Logger.info(this.config.name, 'Cleaning up');
        this.isActive = false;
    }

    // ==================== 状态查询 ====================

    /**
     * 检查游戏模式是否活跃
     */
    public isGameModeActive(): boolean {
        return this.isActive;
    }
}
