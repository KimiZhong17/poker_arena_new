import { _decorator, Component, Node, Vec3, tween, Tween, instantiate, Prefab, SpriteFrame, UITransform } from 'cc';
import { DeckPile } from './DeckPile';
import { Poker } from './Poker';
import { PokerFactory } from './PokerFactory';
import { DealingDuration, DealingEasing, CommunityCardsConfig } from '../Config/DealingAnimationConfig';
import { CardSpriteNames, CardScale } from '../Config/CardDisplayConfig';
import { logger } from '../Utils/Logger';

const log = logger('DealingAnimator');

const { ccclass, property } = _decorator;

/**
 * 发牌结果 - 用于返回发牌动画创建的卡牌节点
 */
export interface DealingResult {
    cardNodes: Node[];      // 创建的卡牌节点
    cardValues: number[];   // 对应的牌值
}

/**
 * DealingAnimator - 发牌动画控制器
 *
 * 职责：
 * - 管理从牌堆到玩家/公牌区的发牌动画
 * - 支持方案C：堆叠发牌 → 展开 → 翻牌 → 排序
 * - 提供可配置的动画参数
 */
@ccclass('DealingAnimator')
export class DealingAnimator extends Component {
    // ===== 属性配置 =====
    @property(DeckPile)
    public deckPile: DeckPile | null = null;

    @property(Node)
    public communityCardsNode: Node | null = null;

    @property(Node)
    public animationLayer: Node | null = null;  // 动画层（确保飞行的牌在最上层）

    // ===== 私有属性 =====
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab | null = null;
    private _isAnimating: boolean = false;
    private _currentTweens: Tween<Node>[] = [];

    // 玩家手牌位置获取回调
    private _getPlayerHandPosition: ((playerIndex: number) => Vec3) | null = null;
    private _getPlayerCount: (() => number) | null = null;

    /**
     * 初始化发牌动画器
     * @param pokerSprites 扑克牌精灵集合
     * @param pokerPrefab 扑克牌预制体
     * @param getPlayerHandPosition 获取玩家手牌位置的回调
     * @param getPlayerCount 获取玩家数量的回调
     */
    public init(
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        getPlayerHandPosition: (playerIndex: number) => Vec3,
        getPlayerCount: () => number
    ): void {
        log.debug('Initializing...');

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._getPlayerHandPosition = getPlayerHandPosition;
        this._getPlayerCount = getPlayerCount;

        // 创建动画层（如果不存在）
        this.setupAnimationLayer();

        log.debug('Initialized');
    }

    /**
     * 设置动画层
     */
    private setupAnimationLayer(): void {
        if (!this.animationLayer) {
            this.animationLayer = new Node('DealingAnimationLayer');
            this.animationLayer.addComponent(UITransform);
            this.animationLayer.layer = this.node.layer;

            // 添加到当前节点的父节点，确保在最上层
            const parent = this.node.parent;
            if (parent) {
                parent.addChild(this.animationLayer);
                // 设置为最后一个子节点（最上层）
                this.animationLayer.setSiblingIndex(parent.children.length - 1);
            }
        }
    }

    /**
     * 设置牌堆引用
     */
    public setDeckPile(deckPile: DeckPile): void {
        this.deckPile = deckPile;
    }

    /**
     * 设置公牌区节点
     */
    public setCommunityCardsNode(node: Node): void {
        this.communityCardsNode = node;
    }

    // ==================== 公共API ====================

    /**
     * 播放发公牌动画（点对点，依次飞到4个位置，全部发完后一起翻牌）
     * @param cards 公牌数组
     * @param onEachCardDealt 每张牌发完后的回调（用于显示背面卡牌）
     * @param onAllFlipped 全部翻牌完成后的回调
     */
    public async dealCommunityCards(
        cards: number[],
        onEachCardDealt?: (index: number, cardValue: number) => void,
        onAllFlipped?: () => void
    ): Promise<void> {
        if (!this.deckPile || !this.communityCardsNode) {
            log.warn('DeckPile or CommunityCardsNode not set');
            onAllFlipped?.();
            return;
        }

        log.debug('Dealing', cards.length, 'community cards (all face-down, then flip together)');

        this._isAnimating = true;

        const startPos = this.deckPile.getTopCardWorldPosition();
        const cardSpacing = CommunityCardsConfig.cardSpacing;
        const startX = -(cardSpacing * (cards.length - 1)) / 2;

        // 获取公牌区的世界坐标
        const communityWorldPos = new Vec3();
        this.communityCardsNode.getWorldPosition(communityWorldPos);

        // 阶段1：依次发每张公牌（背面朝上）
        for (let i = 0; i < cards.length; i++) {
            const cardValue = cards[i];

            // 计算目标位置
            const localX = startX + i * cardSpacing;
            const endPos = new Vec3(
                communityWorldPos.x + localX,
                communityWorldPos.y,
                communityWorldPos.z
            );

            // 创建飞行卡牌（背面）
            const flyingCard = this.createFlyingCard(cardValue, false);

            // 播放飞行动画（不翻牌）
            await this.animateCardFlight(
                flyingCard,
                startPos,
                endPos,
                DealingDuration.dealToCommunity,
                DealingEasing.dealToCommunity,
                CardScale.dealing.communityCard
            );

            // 移除飞行卡牌，通知外部显示背面卡牌
            flyingCard.destroy();
            onEachCardDealt?.(i, cardValue);

            // 等待间隔
            if (i < cards.length - 1) {
                await this.delay(DealingDuration.cardInterval);
            }
        }

        log.debug('All community cards dealt face-down');

        // 短暂停顿后一起翻牌
        await this.delay(0.2);

        // 阶段2：通知外部翻牌（由外部处理实际的翻牌动画）
        log.debug('Community cards ready to flip');

        this._isAnimating = false;
        onAllFlipped?.();
    }

    /**
     * 播放发牌给其他玩家的动画（背面，飞到手牌区）
     * @param playerIndex 玩家索引
     * @param cardCount 发牌数量
     * @param onComplete 完成回调
     * @param onEachCardDealt 每张牌发完后的回调（用于更新手牌数量显示）
     */
    public async dealToOtherPlayer(
        playerIndex: number,
        cardCount: number,
        onComplete?: () => void,
        onEachCardDealt?: (cardIndex: number) => void
    ): Promise<void> {
        if (!this.deckPile || !this._getPlayerHandPosition) {
            log.warn('Not properly initialized');
            onComplete?.();
            return;
        }

        log.debug(`Dealing ${cardCount} cards to other player ${playerIndex}`);

        this._isAnimating = true;

        const startPos = this.deckPile.getTopCardWorldPosition();
        const endPos = this._getPlayerHandPosition(playerIndex);

        // 依次发每张牌（背面）
        for (let i = 0; i < cardCount; i++) {
            // 创建飞行卡牌（背面，cardValue 用 -1 表示未知）
            const flyingCard = this.createFlyingCard(-1, false);

            // 计算堆叠偏移
            const stackOffset = i * DealingDuration.stackOffset;
            const targetPos = new Vec3(
                endPos.x + stackOffset,
                endPos.y + stackOffset,
                endPos.z
            );

            // 播放飞行动画
            await this.animateCardFlight(
                flyingCard,
                startPos,
                targetPos,
                DealingDuration.dealToPlayer,
                DealingEasing.dealToPlayer,
                CardScale.dealing.otherPlayerCard
            );

            // 移除飞行卡牌
            flyingCard.destroy();

            // 每张牌发完后回调（用于更新手牌数量）
            onEachCardDealt?.(i);

            // 等待间隔
            if (i < cardCount - 1) {
                await this.delay(DealingDuration.cardInterval);
            }
        }

        this._isAnimating = false;
        onComplete?.();
    }

    /**
     * 播放发牌给主玩家的动画（方案C：堆叠 → 展开 → 翻牌）
     * @param cards 发给主玩家的牌
     * @param onStackComplete 堆叠完成回调
     * @param onSpreadComplete 展开完成回调
     * @param onFlipComplete 翻牌完成回调
     * @returns 返回创建的卡牌节点（用于后续排序动画）
     */
    public async dealToMainPlayer(
        cards: number[],
        onStackComplete?: () => void,
        onSpreadComplete?: () => void,
        onFlipComplete?: () => void
    ): Promise<DealingResult> {
        if (!this.deckPile || !this._getPlayerHandPosition) {
            log.warn('Not properly initialized');
            return { cardNodes: [], cardValues: [] };
        }

        log.debug(`Dealing ${cards.length} cards to main player (stack → spread → flip)`);

        this._isAnimating = true;

        const startPos = this.deckPile.getTopCardWorldPosition();
        const handPos = this._getPlayerHandPosition(0);  // 主玩家索引为 0
        const cardNodes: Node[] = [];

        // ===== 阶段1：堆叠发牌（牌飞到手牌区中央，堆叠）=====
        log.debug('Phase 1: Stack dealing');
        for (let i = 0; i < cards.length; i++) {
            const cardValue = cards[i];

            // 创建飞行卡牌（背面）
            const flyingCard = this.createFlyingCard(cardValue, false);
            cardNodes.push(flyingCard);

            // 计算堆叠位置（每张牌有小偏移）
            const stackOffset = i * DealingDuration.stackOffset;
            const targetPos = new Vec3(
                handPos.x + stackOffset,
                handPos.y + stackOffset,
                handPos.z
            );

            // 播放飞行动画
            await this.animateCardFlight(
                flyingCard,
                startPos,
                targetPos,
                DealingDuration.dealToPlayer,
                DealingEasing.dealToPlayer,
                CardScale.dealing.playerCard
            );

            // 等待间隔
            if (i < cards.length - 1) {
                await this.delay(DealingDuration.cardInterval);
            }
        }

        onStackComplete?.();
        log.debug('Phase 1 complete: Cards stacked');

        // 短暂停顿
        await this.delay(0.2);

        // ===== 阶段2：展开动画 =====
        log.debug('Phase 2: Spread cards');
        const cardSpacing = 100;  // 手牌间距
        const totalWidth = (cards.length - 1) * cardSpacing;
        const spreadStartX = handPos.x - totalWidth / 2;

        // 同时展开所有牌
        const spreadPromises: Promise<void>[] = [];
        for (let i = 0; i < cardNodes.length; i++) {
            const targetX = spreadStartX + i * cardSpacing;
            const targetPos = new Vec3(targetX, handPos.y, handPos.z);

            spreadPromises.push(this.animateCardSpread(
                cardNodes[i],
                targetPos,
                DealingDuration.spreadDuration,
                i * DealingDuration.spreadInterval  // 每张牌有小延迟
            ));
        }
        await Promise.all(spreadPromises);

        onSpreadComplete?.();
        log.debug('Phase 2 complete: Cards spread');

        // 短暂停顿
        await this.delay(0.1);

        // ===== 阶段3：翻牌动画 =====
        log.debug('Phase 3: Flip cards');
        const flipPromises: Promise<void>[] = [];
        for (let i = 0; i < cardNodes.length; i++) {
            const poker = cardNodes[i].getComponent(Poker);
            if (poker) {
                // 设置正确的牌面
                const cardBack = this._pokerSprites.get(CardSpriteNames.back) ||
                                 this._pokerSprites.get(CardSpriteNames.backWithLogo);
                const spriteName = PokerFactory.getCardSpriteName(cards[i]);
                const cardFront = this._pokerSprites.get(spriteName);
                if (cardFront && cardBack) {
                    poker.init(cards[i], cardBack, cardFront);
                }

                flipPromises.push(this.animateCardFlipWithDelay(
                    cardNodes[i],
                    poker,
                    i * DealingDuration.spreadInterval  // 每张牌有小延迟
                ));
            }
        }
        await Promise.all(flipPromises);

        onFlipComplete?.();
        log.debug('Phase 3 complete: Cards flipped');

        this._isAnimating = false;

        return { cardNodes, cardValues: cards };
    }

    /**
     * 播放排序动画
     * @param cardNodes 卡牌节点数组
     * @param sortedCards 排序后的牌值数组
     * @param targetPositions 排序后的目标位置数组
     * @param onComplete 完成回调
     */
    public async animateSorting(
        cardNodes: Node[],
        sortedCards: number[],
        targetPositions: Vec3[],
        onComplete?: () => void
    ): Promise<void> {
        if (cardNodes.length === 0) {
            onComplete?.();
            return;
        }

        log.debug('Animating card sorting');

        // 创建牌值到节点的映射
        const cardValueToNode = new Map<number, Node>();
        for (let i = 0; i < cardNodes.length; i++) {
            const poker = cardNodes[i].getComponent(Poker);
            if (poker) {
                cardValueToNode.set(poker.getValue(), cardNodes[i]);
            }
        }

        // 同时移动所有牌到排序后的位置
        const sortPromises: Promise<void>[] = [];
        for (let i = 0; i < sortedCards.length; i++) {
            const cardValue = sortedCards[i];
            const node = cardValueToNode.get(cardValue);
            if (node && targetPositions[i]) {
                sortPromises.push(this.animateCardMove(
                    node,
                    targetPositions[i],
                    DealingDuration.sortDuration
                ));
            }
        }

        await Promise.all(sortPromises);

        log.debug('Sorting animation complete');
        onComplete?.();
    }

    /**
     * 播放补牌动画（牌直接飞到目标位置，然后翻牌）
     * @param newCards 新补的牌
     * @param targetPositions 目标位置数组（世界坐标）
     * @param onComplete 完成回调
     * @returns 返回创建的卡牌节点
     */
    public async refillToMainPlayer(
        newCards: number[],
        targetPositions: Vec3[],
        onComplete?: () => void
    ): Promise<DealingResult> {
        if (!this.deckPile || newCards.length === 0) {
            log.warn('DeckPile not set or no cards to refill');
            onComplete?.();
            return { cardNodes: [], cardValues: [] };
        }

        log.debug(`Refilling ${newCards.length} cards to main player`);

        this._isAnimating = true;

        const startPos = this.deckPile.getTopCardWorldPosition();
        const cardNodes: Node[] = [];

        // 阶段1：依次发牌到目标位置（背面）
        for (let i = 0; i < newCards.length; i++) {
            const cardValue = newCards[i];
            const targetPos = targetPositions[i] || targetPositions[targetPositions.length - 1];

            // 创建飞行卡牌（背面）
            const flyingCard = this.createFlyingCard(cardValue, false);
            cardNodes.push(flyingCard);

            // 播放飞行动画到目标位置
            await this.animateCardFlight(
                flyingCard,
                startPos,
                targetPos,
                DealingDuration.dealToPlayer,
                DealingEasing.dealToPlayer,
                CardScale.dealing.playerCard
            );

            // 等待间隔
            if (i < newCards.length - 1) {
                await this.delay(DealingDuration.cardInterval);
            }
        }

        log.debug('Refill cards dealt, now flipping...');

        // 短暂停顿
        await this.delay(0.1);

        // 阶段2：翻牌动画
        const flipPromises: Promise<void>[] = [];
        for (let i = 0; i < cardNodes.length; i++) {
            const poker = cardNodes[i].getComponent(Poker);
            if (poker) {
                // 设置正确的牌面
                const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                                 this._pokerSprites.get(CardSpriteNames.back);
                const spriteName = PokerFactory.getCardSpriteName(newCards[i]);
                const cardFront = this._pokerSprites.get(spriteName);
                if (cardFront && cardBack) {
                    poker.init(newCards[i], cardBack, cardFront);
                }

                flipPromises.push(this.animateCardFlipWithDelay(
                    cardNodes[i],
                    poker,
                    i * DealingDuration.spreadInterval
                ));
            }
        }
        await Promise.all(flipPromises);

        log.debug('Refill animation complete');

        this._isAnimating = false;
        onComplete?.();

        return { cardNodes, cardValues: newCards };
    }

    /**
     * 播放手牌排序动画（从 handDisplay 获取卡牌节点）
     * @param handDisplay 手牌显示组件
     * @param unsortedCards 未排序的牌值数组
     * @param sortedCards 排序后的牌值数组
     * @param onComplete 完成回调
     */
    public async animateSortCards(
        handDisplay: any,
        unsortedCards: number[],
        sortedCards: number[],
        onComplete?: () => void
    ): Promise<void> {
        if (!handDisplay || unsortedCards.length === 0) {
            onComplete?.();
            return;
        }

        log.debug('Animating sort cards from handDisplay');

        // 获取手牌容器中的卡牌节点
        const handContainer = handDisplay.getHandContainer();
        if (!handContainer) {
            log.warn('Hand container not found');
            onComplete?.();
            return;
        }

        const cardNodes: Node[] = handContainer.children.slice();
        if (cardNodes.length === 0) {
            log.warn('No card nodes in hand container');
            onComplete?.();
            return;
        }

        // 计算排序后的目标位置
        const targetPositions = handDisplay.getSortedCardPositions(sortedCards);

        // 调用现有的排序动画方法
        await this.animateSorting(cardNodes, sortedCards, targetPositions, onComplete);
    }

    /**
     * 对 animationLayer 上的飞行节点执行翻牌动画
     * @param cardValues 牌值数组（与 animationLayer 子节点一一对应）
     */
    public async flipAnimationCards(cardValues: number[]): Promise<void> {
        if (!this.animationLayer) return;

        const children = this.animationLayer.children;
        const flipPromises: Promise<void>[] = [];

        for (let i = 0; i < children.length && i < cardValues.length; i++) {
            const poker = children[i].getComponent(Poker);
            if (poker) {
                const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                                 this._pokerSprites.get(CardSpriteNames.back);
                const spriteName = PokerFactory.getCardSpriteName(cardValues[i]);
                const cardFront = this._pokerSprites.get(spriteName);
                if (cardFront && cardBack) {
                    poker.init(cardValues[i], cardBack, cardFront);
                }
                flipPromises.push(this.animateCardFlipWithDelay(
                    children[i],
                    poker,
                    i * DealingDuration.spreadInterval
                ));
            }
        }

        await Promise.all(flipPromises);
    }

    /**
     * 清理动画层中的卡牌节点
     */
    public clearAnimationCards(): void {
        if (this.animationLayer) {
            this.animationLayer.removeAllChildren();
        }
    }

    /**
     * 停止所有动画
     */
    public stopAllAnimations(): void {
        for (const t of this._currentTweens) {
            t.stop();
        }
        this._currentTweens = [];
        this._isAnimating = false;

        // 清除动画层中的所有节点
        this.clearAnimationCards();
    }

    /**
     * 检查是否正在播放动画
     */
    public isAnimating(): boolean {
        return this._isAnimating;
    }

    /**
     * 从牌堆发一张牌到指定位置（用于轮流发牌）
     * @param cardValue 牌值（-1 表示背面）
     * @param targetPos 目标世界坐标
     * @param scaleMultiplier 目标缩放倍数
     * @param keepAlive 是否保留节点不销毁（用于主玩家堆叠显示）
     * @returns 如果 keepAlive 为 true，返回牌节点；否则返回 null
     */
    public async dealSingleCardToPosition(
        cardValue: number,
        targetPos: Vec3,
        scaleMultiplier: number,
        keepAlive: boolean = false
    ): Promise<Node | null> {
        if (!this.deckPile) return null;

        const startPos = this.deckPile.getTopCardWorldPosition();
        const flyingCard = this.createFlyingCard(cardValue, false);

        await this.animateCardFlight(
            flyingCard,
            startPos,
            targetPos,
            DealingDuration.dealToPlayer,
            DealingEasing.dealToPlayer,
            scaleMultiplier
        );

        if (keepAlive) {
            return flyingCard;
        }
        flyingCard.destroy();
        return null;
    }

    /**
     * 在堆叠位置创建牌节点，然后展开+翻牌（用于轮流发牌完成后的揭牌）
     * 跳过飞行阶段，因为轮流发牌阶段已经把牌飞到手牌区了
     * @param cards 牌值数组
     * @param onSpreadComplete 展开完成回调
     * @param onFlipComplete 翻牌完成回调
     * @returns 返回创建的卡牌节点
     */
    public async spreadAndFlipMainPlayer(
        cards: number[],
        onSpreadComplete?: () => void,
        onFlipComplete?: () => void
    ): Promise<DealingResult> {
        if (!this._getPlayerHandPosition) {
            log.warn('Not properly initialized');
            return { cardNodes: [], cardValues: [] };
        }

        log.debug(`Spread and flip ${cards.length} cards for main player`);

        this._isAnimating = true;
        const handPos = this._getPlayerHandPosition(0);
        const cardNodes: Node[] = [];

        // 在堆叠位置创建牌节点（模拟刚到达的状态）
        for (let i = 0; i < cards.length; i++) {
            const flyingCard = this.createFlyingCard(cards[i], false);
            const stackOffset = i * DealingDuration.stackOffset;
            flyingCard.setWorldPosition(new Vec3(
                handPos.x + stackOffset,
                handPos.y + stackOffset,
                handPos.z
            ));
            // 设置为玩家手牌缩放
            const prefabScale = flyingCard.scale.clone();
            flyingCard.setScale(
                prefabScale.x * CardScale.dealing.playerCard,
                prefabScale.y * CardScale.dealing.playerCard,
                prefabScale.z
            );
            cardNodes.push(flyingCard);
        }

        // 短暂停顿
        await this.delay(0.15);

        // ===== 展开阶段 =====
        log.debug('Phase: Spread cards');
        const cardSpacing = 100;
        const totalWidth = (cards.length - 1) * cardSpacing;
        const spreadStartX = handPos.x - totalWidth / 2;

        const spreadPromises: Promise<void>[] = [];
        for (let i = 0; i < cardNodes.length; i++) {
            const targetX = spreadStartX + i * cardSpacing;
            const targetPos = new Vec3(targetX, handPos.y, handPos.z);
            spreadPromises.push(this.animateCardSpread(
                cardNodes[i],
                targetPos,
                DealingDuration.spreadDuration,
                i * DealingDuration.spreadInterval
            ));
        }
        await Promise.all(spreadPromises);
        onSpreadComplete?.();
        log.debug('Spread complete');

        await this.delay(0.1);

        // ===== 翻牌阶段 =====
        log.debug('Phase: Flip cards');
        const flipPromises: Promise<void>[] = [];
        for (let i = 0; i < cardNodes.length; i++) {
            const poker = cardNodes[i].getComponent(Poker);
            if (poker) {
                const cardBack = this._pokerSprites.get(CardSpriteNames.back) ||
                                 this._pokerSprites.get(CardSpriteNames.backWithLogo);
                const spriteName = PokerFactory.getCardSpriteName(cards[i]);
                const cardFront = this._pokerSprites.get(spriteName);
                if (cardFront && cardBack) {
                    poker.init(cards[i], cardBack, cardFront);
                }
                flipPromises.push(this.animateCardFlipWithDelay(
                    cardNodes[i],
                    poker,
                    i * DealingDuration.spreadInterval
                ));
            }
        }
        await Promise.all(flipPromises);
        onFlipComplete?.();
        log.debug('Flip complete');

        this._isAnimating = false;
        return { cardNodes, cardValues: cards };
    }

    // ==================== 旧版API（保持兼容）====================

    /**
     * 播放发牌给单个玩家的动画（旧版，保持兼容）
     */
    public async dealToPlayer(
        playerIndex: number,
        cards: number[],
        showFront: boolean,
        onComplete?: () => void
    ): Promise<void> {
        if (playerIndex === 0 && showFront) {
            // 主玩家使用新的方案C
            await this.dealToMainPlayer(cards);
            onComplete?.();
        } else {
            // 其他玩家使用简单动画
            await this.dealToOtherPlayer(playerIndex, cards.length, onComplete);
        }
    }

    /**
     * 播放发公牌动画（旧版，保持兼容）
     */
    public async dealToCommunity(
        cards: number[],
        onComplete?: () => void
    ): Promise<void> {
        await this.dealCommunityCards(cards, undefined, onComplete);
    }

    // ==================== 私有方法 ====================

    /**
     * 创建飞行中的卡牌节点
     */
    public createFlyingCard(cardValue: number, showFront: boolean): Node {
        if (!this._pokerPrefab) {
            throw new Error('[DealingAnimator] Poker prefab not set');
        }

        const cardNode = instantiate(this._pokerPrefab);
        const pokerCtrl = cardNode.addComponent(Poker);

        // 发牌动画使用有Logo的卡背
        const cardBack = this._pokerSprites.get(CardSpriteNames.backWithLogo) ||
                         this._pokerSprites.get(CardSpriteNames.back);

        if (showFront && cardValue >= 0) {
            const spriteName = PokerFactory.getCardSpriteName(cardValue);
            const cardFront = this._pokerSprites.get(spriteName);
            if (cardFront && cardBack) {
                pokerCtrl.init(cardValue, cardBack, cardFront);
                pokerCtrl.showFront();
            }
        } else {
            if (cardBack) {
                pokerCtrl.init(cardValue, cardBack, cardBack);
                pokerCtrl.showBack();
            }
        }

        // 设置层级
        if (this.animationLayer) {
            cardNode.layer = this.animationLayer.layer;
            this.animationLayer.addChild(cardNode);
        }

        return cardNode;
    }

    /**
     * 执行单张牌的飞行动画
     * 注意：缩放是相对于预制体原始缩放的倍数
     */
    public animateCardFlight(
        cardNode: Node,
        startPos: Vec3,
        endPos: Vec3,
        duration: number,
        easing: string,
        endScaleMultiplier: number
    ): Promise<void> {
        return new Promise((resolve) => {
            // 获取预制体的原始缩放
            const prefabScale = cardNode.scale.clone();

            // 设置初始位置和缩放（基于预制体原始缩放）
            cardNode.setWorldPosition(startPos);
            const startMultiplier = CardScale.dealing.deckPile;
            cardNode.setScale(
                prefabScale.x * startMultiplier,
                prefabScale.y * startMultiplier,
                prefabScale.z
            );

            // 计算结束缩放（基于预制体原始缩放）
            const endScale = new Vec3(
                prefabScale.x * endScaleMultiplier,
                prefabScale.y * endScaleMultiplier,
                prefabScale.z
            );

            // 创建飞行动画
            const flyTween = tween(cardNode)
                .to(duration, {
                    worldPosition: endPos,
                    scale: endScale
                }, {
                    easing: easing as any
                })
                .call(() => {
                    resolve();
                });

            this._currentTweens.push(flyTween);
            flyTween.start();
        });
    }

    /**
     * 执行展开动画
     */
    private animateCardSpread(
        cardNode: Node,
        targetPos: Vec3,
        duration: number,
        delay: number = 0
    ): Promise<void> {
        return new Promise((resolve) => {
            const spreadTween = tween(cardNode)
                .delay(delay)
                .to(duration, {
                    worldPosition: targetPos
                }, {
                    easing: 'quadOut'
                })
                .call(() => {
                    resolve();
                });

            this._currentTweens.push(spreadTween);
            spreadTween.start();
        });
    }

    /**
     * 执行翻牌动画
     */
    private animateCardFlip(cardNode: Node, poker: Poker): Promise<void> {
        return new Promise((resolve) => {
            const duration = DealingDuration.flipDuration;

            // 翻牌动画：先缩小X轴，切换牌面，再放大X轴
            const originalScale = cardNode.scale.clone();

            const flipTween = tween(cardNode)
                .delay(DealingDuration.flipDelay)
                .to(duration / 2, { scale: new Vec3(0, originalScale.y, 1) }, { easing: 'sineIn' })
                .call(() => {
                    poker.showFront();
                })
                .to(duration / 2, { scale: originalScale }, { easing: 'sineOut' })
                .call(() => {
                    resolve();
                });

            this._currentTweens.push(flipTween);
            flipTween.start();
        });
    }

    /**
     * 执行带延迟的翻牌动画
     */
    private animateCardFlipWithDelay(cardNode: Node, poker: Poker, delay: number): Promise<void> {
        return new Promise((resolve) => {
            const duration = DealingDuration.flipDuration;
            const originalScale = cardNode.scale.clone();

            const flipTween = tween(cardNode)
                .delay(delay)
                .to(duration / 2, { scale: new Vec3(0, originalScale.y, 1) }, { easing: 'sineIn' })
                .call(() => {
                    poker.showFront();
                })
                .to(duration / 2, { scale: originalScale }, { easing: 'sineOut' })
                .call(() => {
                    resolve();
                });

            this._currentTweens.push(flipTween);
            flipTween.start();
        });
    }

    /**
     * 执行卡牌移动动画（用于排序）
     */
    private animateCardMove(
        cardNode: Node,
        targetPos: Vec3,
        duration: number
    ): Promise<void> {
        return new Promise((resolve) => {
            const moveTween = tween(cardNode)
                .to(duration, {
                    worldPosition: targetPos
                }, {
                    easing: 'quadInOut'
                })
                .call(() => {
                    resolve();
                });

            this._currentTweens.push(moveTween);
            moveTween.start();
        });
    }

    /**
     * 延迟工具函数
     */
    private delay(seconds: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, seconds * 1000);
        });
    }

    protected onDestroy(): void {
        this.stopAllAnimations();
    }
}
