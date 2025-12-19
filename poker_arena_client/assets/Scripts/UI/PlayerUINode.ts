import { _decorator, Component, Node, Prefab, SpriteFrame, Label, Sprite, UITransform } from 'cc';
import { PlayerHandDisplay, HandDisplayMode, SelectionChangedCallback } from './PlayerHandDisplay';
import { Player } from '../Core/Player';

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

    @property(Node)
    public dealerIndicator: Node = null!;  // 庄家标识

    // 信息面板子元素（自动查找）
    private nameLabel: Label | null = null;
    private scoreLabel: Label | null = null;
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
     */
    public init(
        player: Player,
        playerIndex: number,
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number
    ): void {
        this._player = player;
        this._playerIndex = playerIndex;

        console.log(`[PlayerUINode] Initializing for ${player.name} (index: ${playerIndex})`);

        // 自动查找或创建子节点
        this.setupChildNodes();

        // 初始化手牌显示
        this.setupHandDisplay(pokerSprites, pokerPrefab, levelRank);

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

        if (!this.dealerIndicator) {
            this.dealerIndicator = this.node.getChildByName("DealerIndicator");
            // 庄家标识可选，如果不存在就不创建
        }

        // 查找信息面板子元素
        if (this.infoPanel) {
            this.nameLabel = this.infoPanel.getChildByName("NameLabel")?.getComponent(Label) || null;
            this.scoreLabel = this.infoPanel.getChildByName("ScoreLabel")?.getComponent(Label) || null;
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
        panel.setPosition(0, -100, 0); // 默认位置：手牌下方

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

        // Avatar 可选
        const avatar = new Node("Avatar");
        avatar.addComponent(Sprite);
        avatar.addComponent(UITransform);
        avatar.setPosition(0, 35, 0);
        panel.addChild(avatar);

        this.node.addChild(panel);
        console.log(`[PlayerUINode] Created InfoPanel for ${this._player?.name || 'player'}`);
        return panel;
    }

    /**
     * 初始化手牌显示组件
     */
    private setupHandDisplay(
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number
    ): void {
        if (!this.handContainer) {
            console.error(`[PlayerUINode] HandContainer not found for ${this._player.name}`);
            return;
        }

        // Main player (index 0) shows spread cards, others show stack
        const displayMode = (this._playerIndex === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

        this._handDisplay = this.handContainer.addComponent(PlayerHandDisplay);
        this._handDisplay.handContainer = this.handContainer;
        this._handDisplay.init(this._player, displayMode, pokerSprites, pokerPrefab, levelRank, this._playerIndex);

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

    // ===== 庄家标识管理 =====
    /**
     * 显示庄家标识
     */
    public showDealerIndicator(): void {
        if (this.dealerIndicator) {
            this.dealerIndicator.active = true;
        }
    }

    /**
     * 隐藏庄家标识
     */
    public hideDealerIndicator(): void {
        if (this.dealerIndicator) {
            this.dealerIndicator.active = false;
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
     * 清除所有UI显示
     */
    public clearAll(): void {
        if (this.nameLabel) this.nameLabel.string = "";
        if (this.scoreLabel) this.scoreLabel.string = "";
        this.hideDealerIndicator();
    }
}
