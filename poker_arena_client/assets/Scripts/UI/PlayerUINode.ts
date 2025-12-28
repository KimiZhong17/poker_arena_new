import { _decorator, Component, Node, Prefab, SpriteFrame, Label, Sprite, UITransform } from 'cc';
import { PlayerHandDisplay, HandDisplayMode, SelectionChangedCallback } from './PlayerHandDisplay';
import { Player } from '../LocalStore/LocalPlayerStore';

const { ccclass, property } = _decorator;

/**
 * PlayerUINode - 单个玩家的UI节点组件
 * 封装了一个玩家的所有UI元素和行为
 *
 * 职责：
 * - 管理单个玩家的所有UI元素（手牌、信息面板、庄家标识）
 * - 与 Player 数据模型绑定
 * - 提供UI更新接口
 * - 不包含游戏逻辑（逻辑在 GameMode 中）
 */
@ccclass('PlayerUINode')
export class PlayerUINode extends Component {
    // ===== UI节点引用（可在编辑器配置或代码创建）=====
    @property(Node)
    public handContainer: Node = null!;  // 手牌容器

    @property(Node)
    public infoPanel: Node = null!;  // 信息面板

    // 信息面板子元素（自动查找）
    private nameLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private handTypeLabel: Label | null = null;  // 牌型显示标签
    private avatarSprite: Sprite | null = null;

    // ===== 数据绑定 =====
    private _player: Player = null!;  // 绑定的 Player 数据
    private _handDisplay: PlayerHandDisplay | null = null;  // 手牌显示组件
    private _playerIndex: number = 0;  // 玩家索引（0-4）

    // ===== 初始化方法 =====
    /**
     * 初始化 PlayerUINode
     * @param player 玩家数据模型
     * @param playerIndex 玩家索引（0-4）
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级（Guandan用）
     * @param enableGrouping 是否启用同数字纵向堆叠（Guandan: true, TheDecree: false）
     */
    public init(
        player: Player,
        playerIndex: number,
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number,
        enableGrouping: boolean = true
    ): void {
        this._player = player;
        this._playerIndex = playerIndex;

        console.log(`[PlayerUINode] Initializing for ${player.name} (index: ${playerIndex})`);

        // 自动查找或创建子节点
        this.setupChildNodes();

        // 初始化手牌显示
        this.setupHandDisplay(pokerSprites, pokerPrefab, levelRank, enableGrouping);

        // 初始化玩家信息
        this.updatePlayerInfo();

        console.log(`[PlayerUINode] Initialized for ${player.name}`);
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
            if (!this.infoPanel) {
                this.infoPanel = this.createInfoPanel();
            }
        }

        // 查找信息面板子元素
        if (this.infoPanel) {
            this.nameLabel = this.infoPanel.getChildByName("NameLabel")?.getComponent(Label) || null;
            this.scoreLabel = this.infoPanel.getChildByName("ScoreLabel")?.getComponent(Label) || null;
            this.handTypeLabel = this.infoPanel.getChildByName("HandTypeLabel")?.getComponent(Label) || null;
            this.avatarSprite = this.infoPanel.getChildByName("Avatar")?.getComponent(Sprite) || null;
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
        console.log(`[PlayerUINode] Created HandContainer for ${this._player?.name || 'player'}`);
        return container;
    }

    /**
     * 创建信息面板（如果不存在）
     */
    private createInfoPanel(): Node {
        const panel = new Node("InfoPanel");
        panel.addComponent(UITransform);
        panel.layer = this.node.layer;

        // Position based on player index
        // Player 0 (main player at bottom): position at same height as hand cards, on the left
        // Player 2 (top player): position on the left side of hand cards
        // Other players: default position below hand
        if (this._playerIndex === 0) {
            // Bottom player: same Y as hand cards (0), left side
            panel.setPosition(-300, 0, 0);
        } else if (this._playerIndex === 2) {
            // Top player: same Y as hand cards (0), left side
            panel.setPosition(-200, 30, 0);
        } else {
            // Left and right players: below hand
            panel.setPosition(0, -100, 0);
        }

        // 创建子元素
        const nameLabel = new Node("NameLabel");
        const nameLabelComp = nameLabel.addComponent(Label);
        nameLabel.addComponent(UITransform);
        nameLabelComp.fontSize = 20;
        nameLabel.setPosition(0, 0, 0);
        panel.addChild(nameLabel);

        const scoreLabel = new Node("ScoreLabel");
        const scoreLabelComp = scoreLabel.addComponent(Label);
        scoreLabel.addComponent(UITransform);
        scoreLabelComp.fontSize = 18;
        scoreLabel.setPosition(0, -25, 0);
        panel.addChild(scoreLabel);

        // HandType label (for showing poker hand type)
        const handTypeLabel = new Node("HandTypeLabel");
        const handTypeLabelComp = handTypeLabel.addComponent(Label);
        handTypeLabel.addComponent(UITransform);
        handTypeLabelComp.fontSize = 16;
        handTypeLabelComp.color = new cc.Color(255, 215, 0, 255); // Gold color
        handTypeLabel.setPosition(0, -50, 0);
        panel.addChild(handTypeLabel);

        // Avatar 可选
        const avatar = new Node("Avatar");
        avatar.addComponent(Sprite);
        avatar.addComponent(UITransform);
        avatar.setPosition(0, 35, 0);
        panel.addChild(avatar);

        this.node.addChild(panel);
        console.log(`[PlayerUINode] Created InfoPanel for ${this._player?.name || 'player'} (index: ${this._playerIndex}) at position: ${panel.position.x}, ${panel.position.y}`);
        return panel;
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
            console.error(`[PlayerUINode] HandContainer not found for ${this._player.name}`);
            return;
        }

        // TheDecree 模式（enableGrouping = false）：主玩家 SPREAD，其他玩家 STACK
        // Guandan 模式（enableGrouping = true）：主玩家 SPREAD，其他玩家 STACK
        // 主玩家（index 0）显示正面牌 SPREAD，其他玩家显示牌背 STACK（出牌时会在STACK模式中单独显示）
        const displayMode = (this._playerIndex === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

        this._handDisplay = this.handContainer.addComponent(PlayerHandDisplay);
        this._handDisplay.handContainer = this.handContainer;
        this._handDisplay.init(this._player, displayMode, pokerSprites, pokerPrefab, levelRank, this._playerIndex, enableGrouping);

        console.log(`[PlayerUINode] HandDisplay initialized for ${this._player.name} in ${displayMode === HandDisplayMode.SPREAD ? 'SPREAD' : 'STACK'} mode`);
    }

    // ===== 玩家信息管理 =====
    /**
     * 更新玩家信息显示
     */
    public updatePlayerInfo(): void {
        if (this.nameLabel) {
            this.nameLabel.string = this._player.name;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${this._player.score}`;
        }
    }

    /**
     * 设置玩家名称
     */
    public setPlayerName(name: string): void {
        if (this.nameLabel) {
            this.nameLabel.string = name;
        }
    }

    /**
     * 更新玩家分数
     */
    public updateScore(score: number): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${score}`;
        }
    }

    /**
     * 设置头像（如果需要）
     */
    public setAvatar(spriteFrame: SpriteFrame): void {
        if (this.avatarSprite) {
            this.avatarSprite.spriteFrame = spriteFrame;
        }
    }

    /**
     * 设置牌型显示文本
     * @param handTypeText 牌型文本（如"同花 +9"）
     * @param color 可选的颜色（十六进制字符串，如 "#FFD700"）
     */
    public setHandType(handTypeText: string, color?: string): void {
        if (this.handTypeLabel) {
            this.handTypeLabel.string = handTypeText;
            if (color) {
                // Parse hex color string to Color
                const hexColor = color.replace('#', '');
                const r = parseInt(hexColor.substring(0, 2), 16);
                const g = parseInt(hexColor.substring(2, 4), 16);
                const b = parseInt(hexColor.substring(4, 6), 16);
                this.handTypeLabel.color = new cc.Color(r, g, b, 255);
            }
        }
    }

    /**
     * 清除牌型显示
     */
    public clearHandType(): void {
        if (this.handTypeLabel) {
            this.handTypeLabel.string = "";
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
     * 获取手牌容器的世界坐标（用于 dealer indicator 定位）
     */
    public getHandContainerWorldPosition(): { x: number, y: number } {
        if (this.handContainer) {
            const worldPos = this.handContainer.getWorldPosition();
            return { x: worldPos.x, y: worldPos.y };
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
        if (this.nameLabel) this.nameLabel.string = "";
        if (this.scoreLabel) this.scoreLabel.string = "";
    }
}
