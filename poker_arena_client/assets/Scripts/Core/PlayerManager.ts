import { Player } from './Player';
import { PlayerInfo } from './Player';

/**
 * PlayerManager - 管理所有玩家的数据和状态
 *
 * 职责：
 * - 管理 Player 对象的生命周期
 * - 提供玩家查询接口
 * - 处理玩家状态变化
 * - 不包含具体游戏规则（规则在 GameMode 中）
 *
 * 设计理念：
 * - 数据层管理器，与UI层分离
 * - 支持不同类型的 Player 子类（如 TheDecreePlayer）
 * - 通过 id 和 seatIndex 两种方式访问玩家
 */
export class PlayerManager {
    private _players: Map<string, Player> = new Map();  // 使用 id 作为 key
    private _playerOrder: string[] = [];                 // 玩家顺序（座位顺序）

    /**
     * 创建玩家
     * @param playerInfos 玩家信息数组
     * @param PlayerClass Player 类或其子类（如 TheDecreePlayer）
     */
    public createPlayers(playerInfos: PlayerInfo[], PlayerClass: typeof Player = Player): void {
        this._players.clear();
        this._playerOrder = [];

        playerInfos.forEach(info => {
            const player = new PlayerClass(info);
            this._players.set(info.id, player);
            this._playerOrder.push(info.id);
        });

        console.log(`[PlayerManager] Created ${this._players.size} players`);
    }

    /**
     * 获取玩家（按 ID）
     */
    public getPlayer(playerId: string): Player | undefined {
        return this._players.get(playerId);
    }

    /**
     * 获取玩家（按座位索引）
     */
    public getPlayerBySeat(seatIndex: number): Player | undefined {
        const playerId = this._playerOrder[seatIndex];
        return playerId ? this._players.get(playerId) : undefined;
    }

    /**
     * 获取所有玩家（按座位顺序）
     */
    public getAllPlayers(): Player[] {
        return this._playerOrder
            .map(id => this._players.get(id)!)
            .filter(p => p !== undefined);
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this._players.size;
    }

    /**
     * 获取玩家顺序（ID数组）
     */
    public getPlayerOrder(): string[] {
        return [...this._playerOrder];
    }

    /**
     * 获取下一个玩家（顺时针）
     */
    public getNextPlayer(currentPlayerId: string): Player | undefined {
        const currentIndex = this._playerOrder.indexOf(currentPlayerId);
        if (currentIndex === -1) return undefined;

        const nextIndex = (currentIndex + 1) % this._playerOrder.length;
        return this._players.get(this._playerOrder[nextIndex]);
    }

    /**
     * 获取上一个玩家（逆时针）
     */
    public getPreviousPlayer(currentPlayerId: string): Player | undefined {
        const currentIndex = this._playerOrder.indexOf(currentPlayerId);
        if (currentIndex === -1) return undefined;

        const prevIndex = (currentIndex - 1 + this._playerOrder.length) % this._playerOrder.length;
        return this._players.get(this._playerOrder[prevIndex]);
    }

    /**
     * 查找符合条件的玩家
     */
    public findPlayer(predicate: (player: Player) => boolean): Player | undefined {
        for (const player of this._players.values()) {
            if (predicate(player)) {
                return player;
            }
        }
        return undefined;
    }

    /**
     * 过滤玩家
     */
    public filterPlayers(predicate: (player: Player) => boolean): Player[] {
        return Array.from(this._players.values()).filter(predicate);
    }

    /**
     * 检查玩家是否存在
     */
    public hasPlayer(playerId: string): boolean {
        return this._players.has(playerId);
    }

    /**
     * 清除所有玩家
     */
    public clear(): void {
        this._players.clear();
        this._playerOrder = [];
        console.log('[PlayerManager] Cleared all players');
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): string {
        const playerInfo = this.getAllPlayers().map(p =>
            `${p.name} (${p.id}): ${p.handCards.length} cards, score: ${p.score}`
        ).join('\n  ');

        return `[PlayerManager] ${this._players.size} players:\n  ${playerInfo}`;
    }
}
