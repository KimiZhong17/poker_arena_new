import { _decorator, Component, Node, Prefab, SpriteFrame, UITransform } from 'cc';
import { PlayerUIController } from './PlayerUIController';
import { Player, PlayerInfo } from '../LocalStore/LocalPlayerStore';
import { SelectionChangedCallback } from './PlayerHandDisplay';
import { PlayerPosition, StateLabelAlignment } from './PlayerLayoutConfig';
import { DealerIndicator } from './DealerIndicator';
import { PlayerInfoPanel, InfoPanelMode } from './PlayerInfoPanel';

const { ccclass, property } = _decorator;

/**
 * PlayerUIManager - 管理所有玩家的UI节点
 *
 * 重构后的职责：
 * - 管理 PlayerUIController 数组（单一数组，简化管理）
 * - 提供批量操作接口（更新所有玩家、显示庄家等）
 * - 负责创建和初始化 PlayerUIController
 * - 应用玩家布局配置
 *
 * 设计理念：
 * - 从管理多个数组 → 管理单一 PlayerUIController 数组
 * - UI层管理器，与数据层（PlayerManager）分离
 * - 通过 GameMode 协调数据和UI
 */
@ccclass('PlayerUIManager')
export class PlayerUIManager extends Component {
    // ===== 庄家指示器引用 =====
    @property(DealerIndicator)
    public dealerIndicator: DealerIndicator | null = null;

    // ===== 玩家UI节点数组（核心）=====
    private _playerUINodes: PlayerUIController[] = [];

    // ===== 资源引用 =====
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    // ===== 配置 =====
    private _levelRank: number = 0;
    private _initialized: boolean = false;
    private _enableGrouping: boolean = true; // 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）

    // ===== Ready Stage 相关（两阶段初始化支持）=====
    private _maxSeats: number = 0;  // 房间最大玩家数
    private _mySeatIndex: number = 0;  // 本地玩家的座位索引
    private _seatNodes: Map<number, Node> = new Map();  // 座位节点映射（相对索引 -> Node）
    private _infoPanels: Map<number, PlayerInfoPanel> = new Map();  // 信息面板映射（相对索引 -> InfoPanel）
    private _layoutConfig: PlayerPosition[] = [];  // 布局配置

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

    // ===== 两阶段初始化方法（Ready Stage → Playing Stage）=====

    /**
     * Ready Stage 初始化：为已存在的座位节点添加信息面板
     * 注意：座位节点（BottomSeat等）及其Widget由Game.ts的createOrUpdateHandNodes创建
     * @param playerInfos 当前房间内的玩家信息列表
     * @param maxPlayers 房间最大玩家数
     * @param mySeatIndex 本地玩家的绝对座位索引
     * @param layoutConfig 玩家布局配置
     */
    public initForReadyStage(
        playerInfos: PlayerInfo[],
        maxPlayers: number,
        mySeatIndex: number,
        layoutConfig: PlayerPosition[]
    ): void {
        console.log(`[PlayerUIManager] InitForReadyStage: maxPlayers=${maxPlayers}, mySeat=${mySeatIndex}`);

        this._maxSeats = maxPlayers;
        this._mySeatIndex = mySeatIndex;
        this._layoutConfig = layoutConfig;

        // 清理之前的状态
        this._seatNodes.clear();
        this._infoPanels.clear();

        // 查找并设置所有座位节点（包括空座位）
        for (let absoluteSeat = 0; absoluteSeat < maxPlayers; absoluteSeat++) {
            const relativeSeat = this.getRelativeSeatIndex(absoluteSeat, mySeatIndex, maxPlayers);
            const config = layoutConfig[relativeSeat];

            if (!config) {
                console.error(`[PlayerUIManager] No layout config for relative seat ${relativeSeat}`);
                continue;
            }

            // 查找座位节点（必须已由 Game.ts 创建）
            const seatNode = this.node.getChildByName(config.name);
            if (!seatNode) {
                console.error(`[PlayerUIManager] Seat node ${config.name} not found! Make sure Game.ts has created it.`);
                continue;
            }

            console.log(`[PlayerUIManager] Found seat node: ${config.name}`);
            seatNode.active = config.active;
            this._seatNodes.set(relativeSeat, seatNode);

            // 查找或创建 InfoPanel 节点
            let infoPanelNode = seatNode.getChildByName('InfoPanel');
            if (!infoPanelNode) {
                infoPanelNode = new Node('InfoPanel');
                infoPanelNode.addComponent(UITransform);
                infoPanelNode.layer = this.node.layer;

                // 应用 InfoPanel 偏移（如果配置中有设置）
                const offsetX = config.infoPanelOffsetX ?? 0;
                const offsetY = config.infoPanelOffsetY ?? 0;
                infoPanelNode.setPosition(offsetX, offsetY, 0);

                seatNode.addChild(infoPanelNode);
                console.log(`[PlayerUIManager] Created InfoPanel for ${config.name} at offset (${offsetX}, ${offsetY})`);
            } else {
                console.log(`[PlayerUIManager] Found existing InfoPanel for ${config.name}`);
            }

            // 添加或获取 PlayerInfoPanel 组件
            let infoPanel = infoPanelNode.getComponent(PlayerInfoPanel);
            if (!infoPanel) {
                infoPanel = infoPanelNode.addComponent(PlayerInfoPanel);
            }
            this._infoPanels.set(relativeSeat, infoPanel);

            console.log(`[PlayerUIManager] Setup seat at relative seat ${relativeSeat} (absolute: ${absoluteSeat})`);
        }

        // 更新座位显示
        this.updateSeats(playerInfos);

        console.log(`[PlayerUIManager] Ready stage initialized with ${this._seatNodes.size} seats`);
    }

    /**
     * 更新座位显示（玩家加入/离开/准备）
     * @param playerInfos 当前房间内的玩家信息列表
     */
    public updateSeats(playerInfos: PlayerInfo[]): void {
        console.log(`[PlayerUIManager] UpdateSeats: ${playerInfos.length} players`);

        // 创建座位到玩家的映射
        const seatToPlayer = new Map<number, PlayerInfo>();
        for (const playerInfo of playerInfos) {
            seatToPlayer.set(playerInfo.seatIndex, playerInfo);
        }

        // 更新所有座位
        for (let absoluteSeat = 0; absoluteSeat < this._maxSeats; absoluteSeat++) {
            const relativeSeat = this.getRelativeSeatIndex(absoluteSeat, this._mySeatIndex, this._maxSeats);
            const infoPanel = this._infoPanels.get(relativeSeat);

            if (!infoPanel) {
                console.warn(`[PlayerUIManager] InfoPanel not found for relative seat ${relativeSeat}`);
                continue;
            }

            const playerInfo = seatToPlayer.get(absoluteSeat);

            if (playerInfo) {
                // 有玩家：显示玩家信息
                const isMyPlayer = absoluteSeat === this._mySeatIndex;
                const stateLabelAlignment = this._layoutConfig[relativeSeat]?.stateLabelAlignment ?? StateLabelAlignment.RIGHT;

                // 检查是否已经初始化过（避免重复调用 init 导致UI重建）
                if ((infoPanel as any).playerInfo && (infoPanel as any).playerInfo.id === playerInfo.id) {
                    // 已经初始化过，只更新数据
                    (infoPanel as any).playerInfo = playerInfo;
                    infoPanel.refresh();
                    console.log(`[PlayerUIManager] Seat ${relativeSeat}: Updated ${playerInfo.name} (ready: ${playerInfo.isReady})`);
                } else {
                    // 第一次初始化或玩家更换
                    infoPanel.init(playerInfo, isMyPlayer, InfoPanelMode.ROOM, stateLabelAlignment);
                    console.log(`[PlayerUIManager] Seat ${relativeSeat}: Initialized ${playerInfo.name} (ready: ${playerInfo.isReady})`);
                }
            } else {
                // 空座位：显示"等待玩家..."
                const emptyPlayerInfo: PlayerInfo = {
                    id: '',
                    name: '等待玩家...',
                    seatIndex: absoluteSeat,
                    isReady: false,
                    isHost: false
                };
                const stateLabelAlignment = this._layoutConfig[relativeSeat]?.stateLabelAlignment ?? StateLabelAlignment.RIGHT;

                // 检查是否已经是空座位状态
                if ((infoPanel as any).playerInfo && (infoPanel as any).playerInfo.id === '') {
                    // 已经是空座位，不需要重新初始化
                    console.log(`[PlayerUIManager] Seat ${relativeSeat}: Already empty`);
                } else {
                    // 设置为空座位
                    infoPanel.init(emptyPlayerInfo, false, InfoPanelMode.ROOM, stateLabelAlignment);
                    console.log(`[PlayerUIManager] Seat ${relativeSeat}: Set to empty`);
                }
            }
        }
    }

    /**
     * 升级到 Playing 模式：将 Ready Stage 的座位升级为完整的游戏UI
     * @param players 玩家数据数组（包含手牌等游戏数据）
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级
     * @param enableGrouping 是否启用同数字纵向堆叠
     */
    public upgradeToPlayingMode(
        players: Player[],
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number = 0,
        enableGrouping: boolean = true
    ): void {
        console.log('[PlayerUIManager] Upgrading to Playing mode...');

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;
        this._enableGrouping = enableGrouping;

        // 创建玩家索引到座位的映射
        const seatToPlayer = new Map<number, Player>();
        for (const player of players) {
            seatToPlayer.set(player.seatIndex, player);
        }

        this._playerUINodes = [];

        // 为每个有玩家的座位添加游戏组件
        for (let absoluteSeat = 0; absoluteSeat < this._maxSeats; absoluteSeat++) {
            const player = seatToPlayer.get(absoluteSeat);
            if (!player) continue;  // 跳过空座位

            const relativeSeat = this.getRelativeSeatIndex(absoluteSeat, this._mySeatIndex, this._maxSeats);
            const seatNode = this._seatNodes.get(relativeSeat);
            const infoPanel = this._infoPanels.get(relativeSeat);

            if (!seatNode || !infoPanel) {
                console.error(`[PlayerUIManager] Seat node or InfoPanel not found for relative seat ${relativeSeat}`);
                continue;
            }

            // 切换 InfoPanel 到 GAME 模式
            infoPanel.setMode(InfoPanelMode.GAME);
            infoPanel.updatePlayerInfo(player.info);

            // 创建手牌容器
            let handContainer = seatNode.getChildByName('HandContainer');
            if (!handContainer) {
                handContainer = new Node('HandContainer');
                handContainer.addComponent(UITransform);
                handContainer.layer = this.node.layer;
                handContainer.setPosition(0, 0, 0);
                seatNode.addChild(handContainer);
            }

            // 添加 PlayerUIController 组件
            let playerUIController = seatNode.getComponent(PlayerUIController);
            if (!playerUIController) {
                playerUIController = seatNode.addComponent(PlayerUIController);
            }

            // 初始化 PlayerUIController（传入已存在的 InfoPanel）
            playerUIController.handContainer = handContainer;
            playerUIController.infoPanel = infoPanel.node;
            playerUIController.init(player, relativeSeat, pokerSprites, pokerPrefab, levelRank, enableGrouping);

            this._playerUINodes[relativeSeat] = playerUIController;

            // 立即更新一次手牌显示（即使此时可能还没有手牌数据）
            // 这样可以确保 PlayerHandDisplay 组件被正确初始化
            playerUIController.updateHandDisplay();

            console.log(`[PlayerUIManager] Upgraded seat ${relativeSeat} for player ${player.name}`);
        }

        this._initialized = true;
        console.log(`[PlayerUIManager] Playing mode initialized with ${this._playerUINodes.length} active players`);
    }

    /**
     * 计算相对座位索引（用于主视角旋转）
     * @param absoluteSeat 服务器的绝对座位索引
     * @param mySeat 本地玩家的绝对座位索引
     * @param totalSeats 总座位数
     * @returns 相对座位索引（本地玩家始终为0）
     */
    public getRelativeSeatIndex(absoluteSeat: number, mySeat: number, totalSeats: number): number {
        return (absoluteSeat - mySeat + totalSeats) % totalSeats;
    }

    private createPlayerUINode(): void {
        // 占位函数，防止空类错误
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

            console.log(`[PlayerUIManager] Creating UI node for player ${i} (${player.name}) with widget config`);

            // 查找或创建节点
            let playerNode = this.node.getChildByName(config.name);
            if (!playerNode) {
                playerNode = new Node(config.name);
                playerNode.addComponent(UITransform);
                playerNode.layer = this.node.layer;
                this.node.addChild(playerNode);
                console.log(`[PlayerUIManager] Created new node: ${config.name}`);
            }

            // 如果节点已经有 Widget 组件，不要手动设置位置（让 Widget 自动管理）
            // 否则使用 fallback 坐标作为初始位置
            const existingWidget = playerNode.getComponent('cc.Widget') as any;
            console.log(`[PlayerUIManager] ${config.name} checking Widget: ${!!existingWidget}`);
            if (!existingWidget) {
                // 只有在没有 Widget 的情况下才使用 fallback 坐标
                if (config.fallbackX !== undefined && config.fallbackY !== undefined) {
                    playerNode.setPosition(config.fallbackX, config.fallbackY, 0);
                    console.log(`[PlayerUIManager] ${config.name} using fallback position (${config.fallbackX}, ${config.fallbackY})`);
                }
            } else {
                console.log(`[PlayerUIManager] ${config.name} has Widget, position will be managed automatically`);
                // 强制更新一次 Widget
                if (existingWidget.updateAlignment) {
                    existingWidget.updateAlignment();
                }
                console.log(`[PlayerUIManager] ${config.name} Widget updated, position: (${playerNode.position.x}, ${playerNode.position.y})`);
            }
            playerNode.active = config.active;

            // 添加或获取 PlayerUIController 组件
            let playerUIController = playerNode.getComponent(PlayerUIController);
            if (!playerUIController) {
                playerUIController = playerNode.addComponent(PlayerUIController);
            }

            // 初始化 PlayerUIController
            playerUIController.init(player, i, this._pokerSprites, this._pokerPrefab, this._levelRank, this._enableGrouping);

            this._playerUINodes.push(playerUIController);
        }

        console.log(`[PlayerUIManager] Created ${this._playerUINodes.length} PlayerUIController components`);
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
     * 更新玩家牌型显示
     * @param playerIndex 玩家索引
     * @param handTypeText 牌型文本
     * @param color 可选的颜色
     */
    public updatePlayerHandType(playerIndex: number, handTypeText: string, color?: string): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.setHandType(handTypeText, color);
        }
    }

    /**
     * 清除所有玩家的牌型显示
     */
    public clearAllHandTypes(): void {
        for (const node of this._playerUINodes) {
            node.clearHandType();
        }
    }

    /**
     * 显示庄家标识（使用独立的 DealerIndicator 组件）
     * @param dealerIndex 庄家玩家索引
     * @param immediate 是否立即移动（不使用动画）
     */
    public showDealer(dealerIndex: number, immediate: boolean = false): void {
        if (!this.dealerIndicator) {
            console.warn('[PlayerUIManager] DealerIndicator not configured! Please add a DealerIndicator component to the scene.');
            return;
        }

        const node = this._playerUINodes[dealerIndex];
        if (node) {
            // 根据玩家位置设置不同的 offset
            // 这样 dealer indicator 会显示在合适的位置
            const offsetConfig = this.getDealerIndicatorOffset(dealerIndex);
            this.dealerIndicator.setOffset(offsetConfig.x, offsetConfig.y);
            console.log(`[PlayerUIManager] Set dealer indicator offset for player ${dealerIndex}: (${offsetConfig.x}, ${offsetConfig.y})`);

            // 获取 PlayerUIController 的世界坐标
            const worldPos = node.getWorldPosition();
            console.log(`[PlayerUIManager] Player ${dealerIndex} node world position: (${worldPos.x}, ${worldPos.y})`);
            this.dealerIndicator.moveToDealerPosition(dealerIndex, worldPos, immediate);
            console.log(`[PlayerUIManager] DealerIndicator moved to player ${dealerIndex}`);
        } else {
            console.warn(`[PlayerUIManager] Player ${dealerIndex} not found for dealer indicator`);
        }
    }

    /**
     * 获取 dealer indicator 的偏移量配置
     * 根据玩家索引返回不同的偏移值，使 indicator 显示在合适的位置
     * @param playerIndex 玩家索引（相对位置）
     */
    private getDealerIndicatorOffset(playerIndex: number): { x: number, y: number } {
        // 获取玩家数量
        const playerCount = this._playerUINodes.length;

        // 根据玩家索引和总人数返回不同的 offset
        // 假设：
        // - index 0 (底部，当前玩家): indicator 在右侧
        // - index 1 (顶部，对手): indicator 在左侧
        // - index 2 (左侧): indicator 在右侧
        // - index 3 (右侧): indicator 在左侧

        switch (playerCount) {
            case 2:
                // 2人游戏：底部 vs 顶部
                if (playerIndex === 0) {
                    return { x: -300, y: 50 };   // 底部玩家：右侧
                } else {
                    return { x: -200, y: -50 };  // 顶部玩家：左侧
                }

            case 3:
                // 3人游戏：底部、左上、右上
                if (playerIndex === 0) {
                    return { x: -300, y: 50 };    // 底部：右侧
                } else if (playerIndex === 1) {
                    return { x: 80, y: -100 }; // 左上：左侧
                } else {
                    return { x: -80, y: -100 };  // 右上：右侧
                }

            case 4:
                // 4人游戏：底部、左侧、顶部、右侧
                if (playerIndex === 0) {
                    return { x: -300, y: 50 };     // 底部：右侧
                } else if (playerIndex === 1) {
                    return { x: 80, y: -100 };     // 左侧：右侧
                } else if (playerIndex === 2) {
                    return { x: -200, y: -50 };  // 顶部：左侧
                } else {
                    return { x: -80, y: -100 };    // 右侧：左侧
                }

            default:
                // 默认配置
                return { x: -150, y: 50 };
        }
    }

    /**
     * 隐藏所有庄家标识
     */
    public hideAllDealers(): void {
        if (this.dealerIndicator) {
            this.dealerIndicator.hide();
        }
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

    /**
     * Lock unselected cards for a player (dim them and disable interaction)
     * Call this after player has played their cards
     */
    public lockUnselectedCards(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.lockUnselectedCards();
        }
    }

    // ===== 访问器接口 =====
    /**
     * 获取 PlayerUIController
     */
    public getPlayerUINode(playerIndex: number): PlayerUIController | null {
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
     * 获取所有 PlayerUIController
     */
    public getAllPlayerUINodes(): PlayerUIController[] {
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
