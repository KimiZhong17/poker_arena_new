import { _decorator, Component, Node, Prefab, SpriteFrame, UITransform, Material } from 'cc';
import { PlayerHandDisplay, HandDisplayMode, SelectionChangedCallback } from './PlayerHandDisplay';
import { Player, PlayerInfo } from '../LocalStore/LocalPlayerStore';
import { PlayerInfoPanel, InfoPanelMode } from './PlayerInfoPanel';
import { SeatPosition } from '../Config/SeatConfig';
import { logger } from '../Utils/Logger';

const log = logger('PlayerUICtrl');

const { ccclass, property } = _decorator;

/**
 * PlayerUIController - 单个玩家座位的UI控制器组件
 * 封装了一个玩家座位的所有UI元素和行为
 *
 * 职责：
 * - 管理单个玩家座位的所有UI元素（手牌、信息面板等）
 * - 与 Player 数据模型绑定
 * - 提供UI更新接口
 * - 不包含游戏逻辑（逻辑在 GameMode 中）
 */
@ccclass('PlayerUIController')
export class PlayerUIController extends Component {
    // ===== UI节点引用（可在编辑器配置或代码创建）=====
    @property(Node)
    public handContainer: Node = null!;  // 手牌容器

    @property(Node)
    public infoPanel: Node = null!;  // 信息面板容器节点

    // ===== 数据绑定 =====
    private _player: Player | null = null;  // 绑定的 Player 数据
    private _handDisplay: PlayerHandDisplay | null = null;  // 手牌显示组件
    private _infoPanelComponent: PlayerInfoPanel | null = null;  // 信息面板组件
    private _playerIndex: number = 0;  // 玩家索引（0-4）
    private _positionConfig: SeatPosition | null = null;  // 座位位置配置
    private _glowMaterial: Material | null = null;  // 边缘光材质

    // ===== 初始化方法 =====
    /**
     * 初始化 PlayerUIController
     * @param player 玩家数据模型
     * @param playerIndex 玩家索引（0-4）
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级（Guandan用）
     * @param enableGrouping 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）
     * @param positionConfig 座位位置配置（包含偏移量等）
     */
    public init(
        player: Player,
        playerIndex: number,
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number,
        enableGrouping: boolean = true,
        positionConfig?: SeatPosition,
        glowMaterial?: Material
    ): void {
        this._player = player;
        this._playerIndex = playerIndex;
        this._positionConfig = positionConfig || null;
        this._glowMaterial = glowMaterial || null;

        log.debug(`[PlayerUIController] Initializing for ${player.name} (index: ${playerIndex})`);

        // 自动查找或创建子节点
        this.setupChildNodes();

        // 初始化手牌显示
        this.setupHandDisplay(pokerSprites, pokerPrefab, levelRank, enableGrouping);

        // 初始化玩家信息
        this.updatePlayerInfo();

        log.debug(`[PlayerUIController] Initialized for ${player.name}`);
    }

    /**
     * 查找并设置子节点引用
     */
    private setupChildNodes(): void {
        // 如果属性未在编辑器配置，自动查找或创建
        if (!this.handContainer) {
            this.handContainer = this.node.getChildByName("HandContainer");
            if (!this.handContainer) {
                this.handContainer = this.createHandContainer();
            }
        }

        if (!this.infoPanel) {
            this.infoPanel = this.node.getChildByName("InfoPanel");
            // InfoPanel should already exist (created by PlayerUIManager in ready stage)
            // If not found, log warning but don't create (backward compatibility for old init path)
            if (!this.infoPanel) {
                log.warn(`[PlayerUIController] InfoPanel not found for ${this._player?.name || 'player'}`);
            }
        }

        // Get PlayerInfoPanel component
        if (this.infoPanel) {
            this._infoPanelComponent = this.infoPanel.getComponent(PlayerInfoPanel);
            if (!this._infoPanelComponent) {
                log.warn(`[PlayerUIController] PlayerInfoPanel component not found on InfoPanel node`);
            }
        }
    }

    /**
     * 创建手牌容器（如果不存在）
     */
    private createHandContainer(): Node {
        const container = new Node("HandContainer");
        container.addComponent(UITransform);
        container.layer = this.node.layer;
        container.setPosition(0, 0, 0);
        this.node.addChild(container);
        log.debug(`[PlayerUIController] Created HandContainer for ${this._player?.name || 'player'}`);
        return container;
    }

    /**
     * 初始化手牌显示组件
     */
    private setupHandDisplay(
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number,
        enableGrouping: boolean = true
    ): void {
        if (!this.handContainer) {
            log.error(`[PlayerUIController] HandContainer not found for ${this._player.name}`);
            return;
        }

        // TheDecree 模式（enableGrouping = false）：主玩家 SPREAD，其他玩家 STACK
        // Guandan 模式（enableGrouping = true）：主玩家 SPREAD，其他玩家 STACK
        // 主玩家（index 0）显示正面牌 SPREAD，其他玩家显示牌背 STACK（出牌时会在STACK模式中单独显示）
        const displayMode = (this._playerIndex === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

        // Only pass glow material for main player (index 0)
        const glowMat = (this._playerIndex === 0) ? this._glowMaterial : null;

        this._handDisplay = this.handContainer.addComponent(PlayerHandDisplay);
        this._handDisplay.handContainer = this.handContainer;
        this._handDisplay.init(this._player, displayMode, pokerSprites, pokerPrefab, levelRank, this._playerIndex, enableGrouping, false, this._positionConfig, glowMat);

        log.debug(`[PlayerUIController] HandDisplay initialized for ${this._player.name} in ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'} mode`);
    }

    // ===== 玩家信息管理 =====
    /**
     * 更新玩家信息显示
     */
    public updatePlayerInfo(): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.updatePlayerInfo(this._player.info);
        }
    }

    /**
     * 设置玩家名称
     */
    public setPlayerName(name: string): void {
        if (this._player) {
            this._player.name = name;
            this.updatePlayerInfo();
        }
    }

    /**
     * 更新玩家分数
     */
    public updateScore(score: number): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.updateScore(score);
        }
    }

    /**
     * 设置头像（如果需要）
     */
    public setAvatar(spriteFrame: SpriteFrame): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.setAvatar(spriteFrame);
        }
    }

    /**
     * 设置牌型显示文本
     * @param handTypeText 牌型文本（如"同花 +9"）
     * @param color 可选的颜色（十六进制字符串，如 "#FFD700"）
     */
    public setHandType(handTypeText: string, color?: string): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.setHandType(handTypeText, color);
        }
    }

    /**
     * 清除牌型显示
     */
    public clearHandType(): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.clearHandType();
        }
    }

    public setAutoStatus(isAuto: boolean, reason?: 'manual' | 'timeout' | 'disconnect'): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.setAutoStatus(isAuto, reason);
        }
    }

    // ===== 手牌显示管理 =====
    /**
     * 更新手牌显示
     */
    public updateHandDisplay(playedCards: number[] = []): void {
        if (this._handDisplay) {
            this._handDisplay.updateDisplay(playedCards);
        }
    }

    /**
     * 启用卡牌选择（仅主玩家）
     */
    public enableCardSelection(callback: SelectionChangedCallback | null = null): void {
        if (this._handDisplay) {
            this._handDisplay.enableCardSelection(callback);
        }
    }

    /**
     * 禁用卡牌选择
     */
    public disableCardSelection(): void {
        if (this._handDisplay) {
            this._handDisplay.disableCardSelection();
        }
    }

    /**
     * 获取选中的卡牌索引
     */
    public getSelectedIndices(): number[] {
        return this._handDisplay ? this._handDisplay.getSelectedIndices() : [];
    }

    /**
     * 清除卡牌选择
     */
    public clearSelection(): void {
        if (this._handDisplay) {
            this._handDisplay.clearSelection();
        }
    }

    /**
     * Lock unselected cards (dim them and disable interaction)
     * Call this after player has played their cards
     */
    public lockUnselectedCards(): void {
        if (this._handDisplay) {
            this._handDisplay.lockUnselectedCards();
        }
    }

    // ===== Getters =====
    public getPlayer(): Player {
        return this._player;
    }

    public getPlayerIndex(): number {
        return this._playerIndex;
    }

    public getHandDisplay(): PlayerHandDisplay | null {
        return this._handDisplay;
    }

    /**
     * 获取世界坐标位置（用于动画）
     */
    public getWorldPosition(): { x: number, y: number } {
        const worldPos = this.node.getWorldPosition();
        return { x: worldPos.x, y: worldPos.y };
    }

    /**
     * 获取手牌堆的世界坐标（用于发牌动画目标位置）
     * HandContainer 在座位节点原点，handPileOffset 作为卡牌内部偏移
     * 这里将两者合并，返回手牌堆实际显示的世界坐标
     */
    public getHandContainerWorldPosition(): { x: number, y: number } {
        if (this.handContainer) {
            const worldPos = this.handContainer.getWorldPosition();
            const hpOffset = this._positionConfig?.handPileOffset || { x: 0, y: 0 };
            return { x: worldPos.x + hpOffset.x, y: worldPos.y + hpOffset.y };
        }
        // 如果没有手牌容器，返回节点自身的世界坐标
        return this.getWorldPosition();
    }

    /**
     * 获取信息面板的世界坐标（用于 dealer indicator 定位）
     */
    public getInfoPanelWorldPosition(): { x: number, y: number } {
        if (this.infoPanel) {
            const worldPos = this.infoPanel.getWorldPosition();
            return { x: worldPos.x, y: worldPos.y };
        }
        // 如果没有信息面板，返回节点自身的世界坐标
        return this.getWorldPosition();
    }

    /**
     * 清除所有UI显示
     */
    public clearAll(): void {
        if (this._infoPanelComponent) {
            this._infoPanelComponent.clear();
        }
    }
}
