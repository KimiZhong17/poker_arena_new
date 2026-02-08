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

    /**
     * 更新玩家 ID（用于重连场景）
     * @param oldPlayerId 旧的玩家ID
     * @param newPlayerId 新的玩家ID
     * @returns 是否更新成功
     */
    public updatePlayerId(oldPlayerId: string, newPlayerId: string): boolean {
        const player = this.players.get(oldPlayerId);
        if (!player) {
            return false;
        }

        // 从旧的 key 删除
        this.players.delete(oldPlayerId);

        // 更新玩家的 id
        player.id = newPlayerId;

        // 用新的 key 重新添加
        this.players.set(newPlayerId, player);

        // 更新 playerOrder
        const index = this.playerOrder.indexOf(oldPlayerId);
        if (index !== -1) {
            this.playerOrder[index] = newPlayerId;
        }

        Logger.info('PlayerManager', `Player ID updated: ${oldPlayerId} -> ${newPlayerId}`);
        return true;
    }
}
