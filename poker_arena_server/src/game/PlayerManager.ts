import { Player, PlayerInfo } from './Player';
import { Logger } from '../utils/Logger';

/**
 * Player Manager (Server-side)
 * 管理游戏中的所有玩家（纯数据层，无UI）
 */
export class PlayerManager {
    private players: Map<string, Player> = new Map();
    private playerOrder: string[] = [];

    /**
     * 创建玩家
     */
    public createPlayers<T extends Player>(
        playerInfos: PlayerInfo[],
        PlayerClass: new (info: PlayerInfo) => T
    ): void {
        this.clear();

        for (const info of playerInfos) {
            const player = new PlayerClass(info);
            this.players.set(player.id, player);
            this.playerOrder.push(player.id);
        }

        Logger.info('PlayerManager', `Created ${this.players.size} players`);
    }

    /**
     * 获取玩家
     */
    public getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId);
    }

    /**
     * 获取所有玩家
     */
    public getAllPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    /**
     * 获取玩家顺序
     */
    public getPlayerOrder(): string[] {
        return [...this.playerOrder];
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this.players.size;
    }

    /**
     * 获取玩家索引
     */
    public getPlayerIndex(playerId: string): number {
        return this.playerOrder.indexOf(playerId);
    }

    /**
     * 清空所有玩家
     */
    public clear(): void {
        this.players.clear();
        this.playerOrder = [];
    }
}
