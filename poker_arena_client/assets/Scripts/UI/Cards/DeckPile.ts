import { _decorator, Component, Node, SpriteFrame, Vec3, UIOpacity, Widget, instantiate, Prefab } from 'cc';
import { DeckPileConfig } from '../../Config/DealingAnimationConfig';
import { CardScale, CardSpriteNames } from '../../Config/CardDisplayConfig';
import { Poker } from './Poker';
import { logger } from '../../Utils/Logger';

const log = logger('DeckPile');

const { ccclass, property } = _decorator;

/**
 * DeckPile - 牌堆UI组件
 *
 * 职责：
 * - 显示牌堆（多张牌背叠加效果）
 * - 提供牌堆位置供动画使用
 * - 发牌时的视觉反馈
 *
 * 复用 CardScale.deckPileDisplay 配置
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
        log.debug('Initializing...');

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;

        // 清除之前的卡牌节点
        this.clearCards();

        // 创建堆叠的牌背（复用 CardScale.deckPileDisplay 配置）
        this.createCardStack();

        // 设置 Widget 定位
        this.setupWidget();

        this._isInitialized = true;
        log.debug('Initialized with', CardScale.deckPileDisplay.maxCards, 'cards');
    }

    /**
     * 创建牌堆堆叠效果
     * 复用 CardScale.deckPileDisplay 配置和 PlayerHandDisplay 的创建逻辑
     */
    private createCardStack(): void {
        if (!this._pokerPrefab) {
            log.warn('No poker prefab set');
            return;
        }

        // 牌堆使用有Logo的卡背
        const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                         this._pokerSprites.get(CardSpriteNames.back);
        if (!cardBack) {
            log.warn('No card back sprite found');
            return;
        }

        const maxCards = CardScale.deckPileDisplay.maxCards;
        const stackOffset = CardScale.deckPileDisplay.offset;

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
            log.debug('Using existing Widget from editor');
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

        log.debug('Widget created with top:', config.top, 'right:', config.right);
    }

    /**
     * 清除所有卡牌节点
     */
    private clearCards(): void {
        if (!this._cardNodes) return;
        for (const cardNode of this._cardNodes) {
            if (cardNode && cardNode.isValid) {
                cardNode.destroy();
            }
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
        // 找到最顶部可见的牌
        if (this._cardNodes) {
            for (let i = this._cardNodes.length - 1; i >= 0; i--) {
                if (this._cardNodes[i].active) {
                    const worldPos = new Vec3();
                    this._cardNodes[i].getWorldPosition(worldPos);
                    return worldPos;
                }
            }
        }
        return this.getWorldPosition();
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
     * 显示牌堆（重置所有卡牌节点的可见性和状态）
     */
    public show(): void {
        this.node.active = true;
        // 重置所有卡牌节点状态（消失动画可能修改了 scale/opacity）
        if (!this._cardNodes) return;
        for (const cardNode of this._cardNodes) {
            cardNode.active = true;
            const uiOpacity = cardNode.getComponent(UIOpacity);
            if (uiOpacity) {
                uiOpacity.opacity = 255;
            }
        }
        log.debug('Shown');
    }

    /**
     * 隐藏牌堆
     */
    public hide(): void {
        this.node.active = false;
        log.debug('Hidden');
    }

    /**
     * 更新牌堆显示的牌数量
     * 发一张少一张，最后一张发出去时立即消失（飞行动画本身就是视觉反馈）
     * @param deckSize 实际牌堆数量
     */
    public updateCardCount(deckSize: number): void {
        if (!this._cardNodes) return;
        const maxDisplay = CardScale.deckPileDisplay.maxCards;
        const displayCount = Math.min(deckSize, maxDisplay);

        log.debug(`Updating card count: deckSize=${deckSize}, displayCount=${displayCount}`);

        // 如果需要显示的牌数超过当前节点数，动态创建新节点
        if (displayCount > this._cardNodes.length) {
            this.expandCardStack(displayCount);
        }

        for (let i = 0; i < this._cardNodes.length; i++) {
            this._cardNodes[i].active = i < displayCount;
        }
    }

    /**
     * 动态扩展牌堆节点数量
     * @param targetCount 目标节点数量
     */
    private expandCardStack(targetCount: number): void {
        if (!this._pokerPrefab) {
            log.warn('Cannot expand card stack: no poker prefab');
            return;
        }

        const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                         this._pokerSprites.get(CardSpriteNames.back);
        if (!cardBack) {
            log.warn('Cannot expand card stack: no card back sprite');
            return;
        }

        const stackOffset = CardScale.deckPileDisplay.offset;
        const currentCount = this._cardNodes.length;

        for (let i = currentCount; i < targetCount; i++) {
            const cardNode = instantiate(this._pokerPrefab);
            const pokerCtrl = cardNode.addComponent(Poker);

            pokerCtrl.init(0, cardBack, cardBack);
            pokerCtrl.showBack();

            const offsetX = i * stackOffset;
            const offsetY = i * stackOffset;
            cardNode.setPosition(offsetX, offsetY, 0);

            cardNode.layer = this.node.layer;

            this.node.addChild(cardNode);
            this._cardNodes.push(cardNode);
        }

        log.debug(`Expanded card stack from ${currentCount} to ${targetCount} nodes`);
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
