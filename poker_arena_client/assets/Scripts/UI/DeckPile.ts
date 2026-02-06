import { _decorator, Component, Node, Sprite, SpriteFrame, Vec3, UITransform, Widget, instantiate, tween, Prefab } from 'cc';
import { DeckPileConfig } from '../Config/DealingAnimationConfig';
import { CardScale, CardSpriteNames } from '../Config/CardDisplayConfig';
import { Poker } from './Poker';

const { ccclass, property } = _decorator;

/**
 * DeckPile - 牌堆UI组件
 *
 * 职责：
 * - 显示牌堆（多张牌背叠加效果）
 * - 提供牌堆位置供动画使用
 * - 发牌时的视觉反馈
 *
 * 复用 CardScale.stackDisplay 配置
 */
@ccclass('DeckPile')
export class DeckPile extends Component {
    // ===== 私有属性 =====
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab | null = null;
    private _cardNodes: Node[] = [];
    private _isInitialized: boolean = false;

    /**
     * 初始化牌堆
     * @param pokerSprites 扑克牌精灵集合
     * @param pokerPrefab 扑克牌预制体
     */
    public init(pokerSprites: Map<string, SpriteFrame>, pokerPrefab: Prefab): void {
        console.log('[DeckPile] Initializing...');

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

        // 清除之前的卡牌节点
        this.clearCards();

        // 创建堆叠的牌背（复用 CardScale.stackDisplay 配置）
        this.createCardStack();

        // 设置 Widget 定位
        this.setupWidget();

        this._isInitialized = true;
        console.log('[DeckPile] Initialized with', CardScale.stackDisplay.maxCards, 'cards');
    }

    /**
     * 创建牌堆堆叠效果
     * 复用 CardScale.stackDisplay 配置和 PlayerHandDisplay 的创建逻辑
     */
    private createCardStack(): void {
        if (!this._pokerPrefab) {
            console.warn('[DeckPile] No poker prefab set');
            return;
        }

        // 牌堆使用有Logo的卡背
        const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                         this._pokerSprites.get(CardSpriteNames.back);
        if (!cardBack) {
            console.warn('[DeckPile] No card back sprite found');
            return;
        }

        const maxCards = CardScale.stackDisplay.maxCards;
        const stackOffset = CardScale.stackDisplay.offset;

        for (let i = 0; i < maxCards; i++) {
            // 使用预制体创建卡牌节点（与 PlayerHandDisplay.createCardNode 类似）
            const cardNode = instantiate(this._pokerPrefab);
            const pokerCtrl = cardNode.addComponent(Poker);

            // 初始化为牌背
            pokerCtrl.init(0, cardBack, cardBack);
            pokerCtrl.showBack();

            // 设置位置（堆叠偏移）
            const offsetX = i * stackOffset;
            const offsetY = i * stackOffset;
            cardNode.setPosition(offsetX, offsetY, 0);

            // 设置层级
            cardNode.layer = this.node.layer;

            // 添加到节点
            this.node.addChild(cardNode);
            this._cardNodes.push(cardNode);
        }
    }

    /**
     * 设置 Widget 组件定位到右上角
     * 如果编辑器中已经设置了 Widget，则跳过
     */
    private setupWidget(): void {
        const existingWidget = this.node.getComponent(Widget);
        if (existingWidget) {
            // 编辑器中已经设置了 Widget，不覆盖
            console.log('[DeckPile] Using existing Widget from editor');
            return;
        }

        // 没有 Widget，创建并设置默认位置
        const widget = this.node.addComponent(Widget);
        const config = DeckPileConfig.widget;
        widget.isAlignTop = config.alignTop;
        widget.isAlignRight = config.alignRight;
        widget.top = config.top;
        widget.right = config.right;

        // 立即更新对齐
        widget.updateAlignment();

        console.log('[DeckPile] Widget created with top:', config.top, 'right:', config.right);
    }

    /**
     * 清除所有卡牌节点
     */
    private clearCards(): void {
        for (const cardNode of this._cardNodes) {
            cardNode.destroy();
        }
        this._cardNodes = [];
    }

    /**
     * 获取牌堆的世界坐标位置
     * @returns 牌堆中心的世界坐标
     */
    public getWorldPosition(): Vec3 {
        const worldPos = new Vec3();
        this.node.getWorldPosition(worldPos);
        return worldPos;
    }

    /**
     * 获取牌堆顶部卡牌的世界坐标
     * @returns 顶部卡牌的世界坐标
     */
    public getTopCardWorldPosition(): Vec3 {
        if (this._cardNodes.length > 0) {
            const topCard = this._cardNodes[this._cardNodes.length - 1];
            const worldPos = new Vec3();
            topCard.getWorldPosition(worldPos);
            return worldPos;
        }
        return this.getWorldPosition();
    }

    /**
     * 播放发牌视觉反馈动画
     * 顶部卡牌短暂缩小然后恢复
     */
    public playDealFeedback(): void {
        if (this._cardNodes.length === 0) return;

        const topCard = this._cardNodes[this._cardNodes.length - 1];
        const originalScale = topCard.scale.clone();

        // 短暂缩小动画
        tween(topCard)
            .to(0.05, { scale: new Vec3(originalScale.x * 0.9, originalScale.y * 0.9, 1) })
            .to(0.1, { scale: originalScale })
            .start();
    }

    /**
     * 获取扑克牌资源（供 DealingAnimator 使用）
     */
    public getPokerResources(): { sprites: Map<string, SpriteFrame>, prefab: Prefab | null } {
        return {
            sprites: this._pokerSprites,
            prefab: this._pokerPrefab
        };
    }

    /**
     * 显示牌堆
     */
    public show(): void {
        this.node.active = true;
        console.log('[DeckPile] Shown');
    }

    /**
     * 隐藏牌堆
     */
    public hide(): void {
        this.node.active = false;
        console.log('[DeckPile] Hidden');
    }

    /**
     * 更新牌堆显示的牌数量
     * @param deckSize 实际牌堆数量
     */
    public updateCardCount(deckSize: number): void {
        const maxDisplay = CardScale.stackDisplay.maxCards;
        const displayCount = Math.min(deckSize, maxDisplay);

        console.log(`[DeckPile] Updating card count: deckSize=${deckSize}, displayCount=${displayCount}`);

        // 更新每张牌的可见性
        for (let i = 0; i < this._cardNodes.length; i++) {
            this._cardNodes[i].active = i < displayCount;
        }
    }

    /**
     * 检查是否已初始化
     */
    public isInitialized(): boolean {
        return this._isInitialized;
    }

    protected onDestroy(): void {
        this.clearCards();
    }
}
