import { _decorator, Component, Node, Prefab, SpriteFrame, UITransform } from 'cc';
import { PlayerUINode } from './PlayerUINode';
import { Player } from '../Core/Player';
import { SelectionChangedCallback } from './PlayerHandDisplay';
import { PlayerPosition } from '../Core/GameMode/PlayerLayoutConfig';

const { ccclass } = _decorator;

/**
 * PlayerUIManager - 管理所有玩家的UI节点
 *
 * 重构后的职责：
 * - 管理 PlayerUINode 数组（单一数组，简化管理）
 * - 提供批量操作接口（更新所有玩家、显示庄家等）
 * - 负责创建和初始化 PlayerUINode
 * - 应用玩家布局配置
 *
 * 设计理念：
 * - 从管理多个数组 → 管理单一 PlayerUINode 数组
 * - UI层管理器，与数据层（PlayerManager）分离
 * - 通过 GameMode 协调数据和UI
 */
@ccclass('PlayerUIManager')
export class PlayerUIManager extends Component {
    // ===== 玩家UI节点数组（核心）=====
    private _playerUINodes: PlayerUINode[] = [];

    // ===== 资源引用 =====
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    // ===== 配置 =====
    private _levelRank: number = 0;
    private _initialized: boolean = false;
    private _enableGrouping: boolean = true; // 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）

    /**
     * 初始化 PlayerUIManager
     * @param players 玩家数据数组
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级
     * @param layoutConfig 玩家布局配置
     * @param enableGrouping 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）
     */
    public init(
        players: Player[],
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number = 0,
        layoutConfig: PlayerPosition[],
        enableGrouping: boolean = true
    ): void {
        if (this._initialized) {
            console.warn('[PlayerUIManager] Already initialized! Skipping re-initialization.');
            return;
        }

        console.log('[PlayerUIManager] Initializing...');
        console.log(`[PlayerUIManager] Players: ${players.length}, Layout configs: ${layoutConfig.length}`);

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;
        this._enableGrouping = enableGrouping;

        // 创建 PlayerUINode 节点
        this.createPlayerUINodes(players, layoutConfig);

        this._initialized = true;
        console.log(`[PlayerUIManager] Initialized with ${this._playerUINodes.length} players`);
    }

    /**
     * 创建玩家UI节点
     */
    private createPlayerUINodes(players: Player[], layoutConfig: PlayerPosition[]): void {
        this._playerUINodes = [];

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const config = layoutConfig[i];

            if (!config) {
                console.error(`[PlayerUIManager] No layout config for player ${i}`);
                continue;
            }

            console.log(`[PlayerUIManager] Creating UI node for player ${i} (${player.name}) at (${config.x}, ${config.y})`);

            // 查找或创建节点
            let playerNode = this.node.getChildByName(config.name);
            if (!playerNode) {
                playerNode = new Node(config.name);
                playerNode.addComponent(UITransform);
                playerNode.layer = this.node.layer;
                this.node.addChild(playerNode);
                console.log(`[PlayerUIManager] Created new node: ${config.name}`);
            }

            // 应用布局配置
            playerNode.setPosition(config.x, config.y, 0);
            playerNode.active = config.active;

            // 添加或获取 PlayerUINode 组件
            let playerUINode = playerNode.getComponent(PlayerUINode);
            if (!playerUINode) {
                playerUINode = playerNode.addComponent(PlayerUINode);
            }

            // 初始化 PlayerUINode
            playerUINode.init(player, i, this._pokerSprites, this._pokerPrefab, this._levelRank, this._enableGrouping);

            this._playerUINodes.push(playerUINode);
        }

        console.log(`[PlayerUIManager] Created ${this._playerUINodes.length} PlayerUINode components`);
    }

    // ===== 批量操作接口 =====
    /**
     * 更新所有玩家手牌显示
     */
    public updateAllHands(): void {
        console.log('[PlayerUIManager] Updating all hands...');
        this._playerUINodes.forEach(node => {
            node.updateHandDisplay();
        });
    }

    /**
     * 更新指定玩家手牌
     */
    public updatePlayerHand(playerIndex: number, playedCards: number[] = []): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.updateHandDisplay(playedCards);
        } else {
            console.warn(`[PlayerUIManager] Player ${playerIndex} not found for hand update`);
        }
    }

    /**
     * 更新所有玩家信息
     */
    public updateAllPlayerInfo(): void {
        this._playerUINodes.forEach(node => node.updatePlayerInfo());
    }

    /**
     * 更新指定玩家信息
     */
    public updatePlayerInfo(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.updatePlayerInfo();
        }
    }

    /**
     * 更新指定玩家分数
     */
    public updatePlayerScore(playerIndex: number, score: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.updateScore(score);
        }
    }

    /**
     * 批量更新所有玩家分数
     */
    public updateAllScores(scores: number[]): void {
        for (let i = 0; i < scores.length && i < this._playerUINodes.length; i++) {
            this.updatePlayerScore(i, scores[i]);
        }
    }

    /**
     * 显示庄家标识
     */
    public showDealer(dealerIndex: number): void {
        // 先隐藏所有
        this._playerUINodes.forEach(node => node.hideDealerIndicator());

        // 显示指定玩家
        const node = this._playerUINodes[dealerIndex];
        if (node) {
            node.showDealerIndicator();
            console.log(`[PlayerUIManager] Showing dealer for player ${dealerIndex}`);
        }
    }

    /**
     * 隐藏所有庄家标识
     */
    public hideAllDealers(): void {
        this._playerUINodes.forEach(node => node.hideDealerIndicator());
    }

    // ===== 卡牌选择接口 =====
    /**
     * 启用玩家卡牌选择
     */
    public enableCardSelection(playerIndex: number, callback: SelectionChangedCallback | null = null): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.enableCardSelection(callback);
        }
    }

    /**
     * 禁用玩家卡牌选择
     */
    public disableCardSelection(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.disableCardSelection();
        }
    }

    /**
     * 获取选中的卡牌索引
     */
    public getSelectedIndices(playerIndex: number): number[] {
        const node = this._playerUINodes[playerIndex];
        return node ? node.getSelectedIndices() : [];
    }

    /**
     * 清除选择
     */
    public clearSelection(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.clearSelection();
        }
    }

    // ===== 访问器接口 =====
    /**
     * 获取 PlayerUINode
     */
    public getPlayerUINode(playerIndex: number): PlayerUINode | null {
        return this._playerUINodes[playerIndex] || null;
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this._playerUINodes.length;
    }

    /**
     * 获取玩家世界坐标
     */
    public getPlayerWorldPosition(playerIndex: number): { x: number, y: number } | null {
        const node = this._playerUINodes[playerIndex];
        return node ? node.getWorldPosition() : null;
    }

    /**
     * 检查玩家UI是否设置
     */
    public hasPlayerUI(playerIndex: number): boolean {
        return playerIndex >= 0 &&
               playerIndex < this._playerUINodes.length &&
               this._playerUINodes[playerIndex] !== null;
    }

    /**
     * 获取所有 PlayerUINode
     */
    public getAllPlayerUINodes(): PlayerUINode[] {
        return [...this._playerUINodes];
    }

    /**
     * 清除所有玩家UI
     */
    public clearAll(): void {
        this._playerUINodes.forEach(node => node.clearAll());
        this.hideAllDealers();
    }

    /**
     * 重置（用于新游戏）
     */
    public reset(): void {
        this._playerUINodes.forEach(node => {
            if (node && node.node) {
                node.node.destroy();
            }
        });
        this._playerUINodes = [];
        this._initialized = false;
        console.log('[PlayerUIManager] Reset complete');
    }
}
