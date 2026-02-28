import { Node, instantiate, Vec3, UITransform } from "cc";
import { GameModeClientBase } from "../GameModeClientBase";
import { DealCardsEvent, CommunityCardsEvent } from "../../../Network/Messages";
import { PokerFactory } from "../../../UI/Cards/PokerFactory";
import { Poker } from "../../../UI/Cards/Poker";
import { DeckPile } from "../../../UI/Cards/DeckPile";
import { DealingAnimator } from "../../../UI/Animation/DealingAnimator";
import { PlayerHandDisplay } from "../../../UI/Player/PlayerHandDisplay";
import { DealingOrderConfig, DealingDuration } from "../../../Config/DealingAnimationConfig";
import { CardScale } from "../../../Config/CardDisplayConfig";
import { logger } from "../../../Utils/Logger";

const log = logger('DealingHandler');

/**
 * 发牌动画 Handler
 * 负责：发牌动画系统初始化、公共牌展示、玩家发牌/补牌动画、待发牌队列
 */
export class DealingHandler {
    private mode: GameModeClientBase;

    // 发牌动画组件
    private deckPile: DeckPile | null = null;
    private dealingAnimator: DealingAnimator | null = null;
    private communityCardsNode: Node | null = null;

    // 动画队列控制
    private _communityCardsDealt: boolean = false;
    private _pendingPlayerDeals: Array<{ data: DealCardsEvent }> = [];

    // 初始发牌动画完成标志
    private _initialDealAnimationComplete: boolean = false;
    private _pendingMessage: { message: string; duration: number } | null = null;

    // 补牌事件 debounce 定时器
    private _refillDebounceTimer: number | null = null;

    // 发牌动画进行中标志（防止外部 updateDisplay 覆盖动画状态）
    private _isDealingAnimationInProgress: boolean = false;

    // 当前牌堆剩余数量（用于公牌发牌时递减）
    private _currentDeckSize: number = 0;

    constructor(mode: GameModeClientBase) {
        this.mode = mode;
    }

    // ==================== 状态访问 ====================

    public get communityCardsDealt(): boolean { return this._communityCardsDealt; }
    public set communityCardsDealt(v: boolean) { this._communityCardsDealt = v; }

    public get initialDealAnimationComplete(): boolean { return this._initialDealAnimationComplete; }
    public set initialDealAnimationComplete(v: boolean) { this._initialDealAnimationComplete = v; }

    public get isDealingAnimationInProgress(): boolean { return this._isDealingAnimationInProgress; }

    public getDeckPile(): DeckPile | null { return this.deckPile; }
    public getDealingAnimator(): DealingAnimator | null { return this.dealingAnimator; }
    public getCommunityCardsNode(): Node | null { return this.communityCardsNode; }

    public setPendingMessage(msg: { message: string; duration: number } | null): void {
        this._pendingMessage = msg;
    }

    // ==================== 初始化 ====================

    /**
     * 初始化发牌动画系统
     * @param containerNode 游戏模式容器节点（如 TheDecree 节点）
     * @param communityCardsNode 公共牌节点
     */
    public initDealingAnimation(containerNode: Node, communityCardsNode: Node | null): void {
        log.debug('Initializing dealing animation system...');
        this.communityCardsNode = communityCardsNode;

        const pokerFactory = PokerFactory.instance;
        if (!pokerFactory) {
            log.warn('PokerFactory not found, skipping dealing animation init');
            return;
        }

        const pokerSprites = pokerFactory.pokerSprites as Map<string, any>;
        const pokerPrefab = pokerFactory.pokerPrefab;

        if (!pokerSprites || !pokerPrefab) {
            log.warn('Poker resources not found');
            return;
        }

        // 查找/创建牌堆节点
        let deckPileNode = containerNode.getChildByName('DeckPileNode')
                        || containerNode.getChildByName('DeckPile');
        if (!deckPileNode) {
            log.debug('Creating DeckPile node dynamically');
            deckPileNode = new Node('DeckPileNode');
            deckPileNode.addComponent(UITransform);
            deckPileNode.layer = containerNode.layer;
            containerNode.addChild(deckPileNode);
        }

        this.deckPile = deckPileNode.getComponent(DeckPile) || deckPileNode.addComponent(DeckPile);
        this.deckPile.init(pokerSprites, pokerPrefab);
        this._currentDeckSize = CardScale.deckPileDisplay.maxCards;

        // 创建发牌动画控制器
        let animatorNode = containerNode.getChildByName('DealingAnimator');
        if (!animatorNode) {
            animatorNode = new Node('DealingAnimator');
            animatorNode.addComponent(UITransform);
            animatorNode.layer = containerNode.layer;
            containerNode.addChild(animatorNode);
        }

        this.dealingAnimator = animatorNode.getComponent(DealingAnimator) || animatorNode.addComponent(DealingAnimator);

        if (this.deckPile) {
            this.dealingAnimator.setDeckPile(this.deckPile);
        }
        if (this.communityCardsNode) {
            this.dealingAnimator.setCommunityCardsNode(this.communityCardsNode);
        }

        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        this.dealingAnimator.init(
            pokerSprites,
            pokerPrefab,
            (playerIndex: number) => this.getPlayerHandWorldPosition(playerIndex),
            () => playerUIManager?.getPlayerCount() || 0
        );

        log.debug('Dealing animation system ready');
    }

    /**
     * 重置运行时状态（新一局开始时调用）
     */
    public resetState(): void {
        this._communityCardsDealt = false;
        this._pendingPlayerDeals = [];
        this._initialDealAnimationComplete = false;
        this._pendingMessage = null;
        this._refillDebounceTimer = null;
        this._isDealingAnimationInProgress = false;
    }

    // ==================== 公共牌 ====================

    /**
     * 处理公共牌事件
     */
    public onCommunityCards(cards: number[]): void {
        // 清空之前的公共牌显示
        if (this.communityCardsNode) {
            this.communityCardsNode.removeAllChildren();
        }

        if (this.dealingAnimator && this.deckPile) {
            log.debug('Playing community cards deal animation...');
            this.deckPile.show();

            this.dealingAnimator.dealCommunityCards(
                cards,
                (index: number, cardValue: number) => {
                    this.displaySingleCommunityCard(index, cardValue, cards.length, false);
                    // 每张公牌飞出后递减牌堆（仅在已知牌堆数量时）
                    if (this._currentDeckSize > 0) {
                        this._currentDeckSize--;
                        this.deckPile!.updateCardCount(this._currentDeckSize);
                    }
                },
                () => {
                    log.debug('All community cards dealt, flipping...');
                    this.flipAllCommunityCards();
                    this._communityCardsDealt = true;
                    this.processPendingPlayerDeals();
                }
            );
        } else {
            this.displayCommunityCards(cards);
            this._communityCardsDealt = true;
            this.processPendingPlayerDeals();
        }
    }

    /**
     * 显示所有公共牌（无动画）
     */
    public displayCommunityCards(cards: number[]): void {
        if (!this.communityCardsNode) {
            log.warn('CommunityCardsNode not found');
            return;
        }
        if (cards.length === 0) return;

        this.communityCardsNode.removeAllChildren();
        for (let i = 0; i < cards.length; i++) {
            this.displaySingleCommunityCard(i, cards[i], cards.length, true);
        }
        log.debug(`Displayed ${cards.length} community cards`);
    }

    /**
     * 显示单张公共牌
     */
    private displaySingleCommunityCard(index: number, cardValue: number, totalCards: number, showFront: boolean): void {
        if (!this.communityCardsNode) return;

        const pokerFactory = PokerFactory.instance;
        if (!pokerFactory) return;

        const pokerSprites = pokerFactory.pokerSprites;
        const pokerPrefab = pokerFactory.pokerPrefab;
        const pokerBack = pokerSprites.get("CardBack3");
        if (!pokerPrefab) return;

        const cardSpacing = 120;
        const startX = -(cardSpacing * (totalCards - 1)) / 2;

        const pokerNode = instantiate(pokerPrefab);
        const pokerCtrl = pokerNode.addComponent(Poker);

        const spriteName = PokerFactory.getCardSpriteName(cardValue);
        const pokerFront = pokerSprites.get(spriteName);

        if (pokerFront && pokerBack) {
            pokerCtrl.init(cardValue, pokerBack, pokerFront);
            showFront ? pokerCtrl.showFront() : pokerCtrl.showBack();
        }

        pokerNode.setPosition(startX + index * cardSpacing, 0, 0);
        this.communityCardsNode.addChild(pokerNode);
    }

    /**
     * 翻转所有公共牌
     */
    private flipAllCommunityCards(): void {
        if (!this.communityCardsNode) return;

        const children = this.communityCardsNode.children;
        for (let i = 0; i < children.length; i++) {
            const pokerCtrl = children[i].getComponent(Poker);
            if (pokerCtrl) {
                const delay = i * 0.08;
                this.mode.registerTimeout(() => {
                    pokerCtrl.flip();
                }, delay * 1000);
            }
        }
    }

    // ==================== 玩家发牌 ====================

    /**
     * 处理 deal_cards 事件入口
     * 如果公共牌还没发完，先缓存；补牌事件用 debounce 收集齐后统一处理
     */
    public onDealCards(data: DealCardsEvent): void {
        if (!this._communityCardsDealt) {
            log.debug('Community cards not dealt yet, queuing player deal...');
            this._pendingPlayerDeals.push({ data });
            return;
        }

        // 补牌事件（有 allHandCounts）：队列收集，debounce 后统一处理
        if (data.allHandCounts) {
            this._pendingPlayerDeals.push({ data });
            this.scheduleRefillProcessing();
            return;
        }

        this.processPlayerDeal(data);
    }

    /**
     * 处理玩家发牌（实际执行）
     */
    public processPlayerDeal(data: DealCardsEvent): void {
        // 检查 playerId 是否在映射中
        if (!this.mode.getPlayerIdToIndexMap().has(data.playerId)) {
            log.warn(`Player ${data.playerId} not in mapping, reinitializing...`);
            this.mode.upgradePlayerUIToPlayingMode();
            if (!this.mode.getPlayerIdToIndexMap().has(data.playerId)) {
                log.error(`Failed to add player ${data.playerId} to mapping after reinit!`);
                return;
            }
        }

        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) {
            log.error('PlayerUIManager not found!');
            return;
        }

        const playerIndex = this.mode.getPlayerIndexByPlayerId(data.playerId);
        if (playerIndex === -1) return;

        const playerUIController = playerUIManager.getPlayerUINode(playerIndex);
        if (!playerUIController) {
            log.error(`PlayerUIController not found for index ${playerIndex}`);
            return;
        }

        const player = playerUIController.getPlayer();
        if (!player) {
            log.error(`Player not found in PlayerUIController for index ${playerIndex}`);
            return;
        }

        const oldHandCards = [...player.handCards];
        const oldHandCount = oldHandCards.length;
        const newCards = data.handCards.filter((c: number) => !oldHandCards.includes(c));
        const actualDealCount = newCards.length;
        const isMainPlayer = playerIndex === 0;
        const isInitialDeal = oldHandCount === 0;

        if (this.dealingAnimator && this.deckPile && actualDealCount > 0) {
            this.deckPile.show();

            if (isMainPlayer) {
                if (isInitialDeal) {
                    player.setHandCards(data.handCards);
                    this.playMainPlayerDealAnimation(newCards, data.handCards, playerUIManager, playerUIController);
                } else {
                    this.playMainPlayerRefillAnimation(newCards, data.handCards, oldHandCards, playerUIManager, playerUIController);
                }
            } else {
                player.setHandCards(data.handCards);
                const handDisplay = playerUIController.getHandDisplay();
                const startCount = oldHandCount;
                if (handDisplay) {
                    handDisplay.initStackForDealing(startCount);
                }
                this.dealingAnimator.dealToOtherPlayer(
                    playerIndex,
                    actualDealCount,
                    () => { playerUIManager.updatePlayerHand(playerIndex); },
                    (cardIndex: number) => {
                        if (handDisplay) {
                            handDisplay.updateCardCountLabel(startCount + cardIndex + 1);
                        }
                    }
                );
            }
        } else {
            player.setHandCards(data.handCards);
            playerUIManager.updatePlayerHand(playerIndex);

            if (isMainPlayer) {
                this.mode.onDealAnimationComplete();
            }
        }

        // 更新其他玩家的手牌显示
        this.updateOtherPlayersHands(data, playerIndex, playerUIManager);

        // 更新牌堆显示数量
        if (data.deckSize !== undefined && this.deckPile) {
            this.deckPile.updateCardCount(data.deckSize);
            this._currentDeckSize = data.deckSize;
        }
    }

    /**
     * 更新其他玩家手牌数量
     */
    private updateOtherPlayersHands(data: DealCardsEvent, playerIndex: number, playerUIManager: any): void {
        if (playerIndex === 0) {
            const playerCount = playerUIManager.getPlayerCount();
            const mainPlayerCardCount = data.handCards.length;

            for (let i = 1; i < playerCount; i++) {
                const otherCtrl = playerUIManager.getPlayerUINode(i);
                if (!otherCtrl) continue;
                const otherPlayer = otherCtrl.getPlayer();
                if (!otherPlayer) continue;

                const oldOtherHandCount = otherPlayer.handCards.length;
                let newOtherHandCount = mainPlayerCardCount;
                if (data.allHandCounts) {
                    for (const [playerId, count] of Object.entries(data.allHandCounts)) {
                        if (this.mode.getPlayerIndexByPlayerId(playerId) === i) {
                            newOtherHandCount = count;
                            break;
                        }
                    }
                }

                const otherDealCount = newOtherHandCount - oldOtherHandCount;
                const emptyCards = Array(newOtherHandCount).fill(-1);
                otherPlayer.setHandCards(emptyCards);

                if (this.dealingAnimator && this.deckPile && otherDealCount > 0) {
                    const otherHandDisplay = otherCtrl.getHandDisplay();
                    const otherStartCount = oldOtherHandCount;
                    if (otherHandDisplay) {
                        otherHandDisplay.initStackForDealing(otherStartCount);
                    }
                    this.dealingAnimator.dealToOtherPlayer(
                        i, otherDealCount,
                        () => { playerUIManager.updatePlayerHand(i); },
                        (cardIndex: number) => {
                            if (otherHandDisplay) {
                                otherHandDisplay.updateCardCountLabel(otherStartCount + cardIndex + 1);
                            }
                        }
                    );
                } else {
                    playerUIManager.updatePlayerHand(i);
                }
            }
        } else if (data.allHandCounts) {
            for (const [playerId, handCount] of Object.entries(data.allHandCounts)) {
                if (playerId === data.playerId) continue;

                const otherPlayerIndex = this.mode.getPlayerIndexByPlayerId(playerId);
                if (otherPlayerIndex === -1) continue;

                const otherCtrl = playerUIManager.getPlayerUINode(otherPlayerIndex);
                if (!otherCtrl) continue;
                const otherPlayer = otherCtrl.getPlayer();
                if (!otherPlayer) continue;

                const emptyCards = Array(handCount).fill(-1);
                otherPlayer.setHandCards(emptyCards);
                playerUIManager.updatePlayerHand(otherPlayerIndex);
            }
        }
    }

    // ==================== 主玩家发牌动画 ====================

    private async playMainPlayerDealAnimation(
        newCards: number[],
        allCards: number[],
        playerUIManager: any,
        playerUIController: any
    ): Promise<void> {
        if (!this.dealingAnimator) return;

        const result = await this.dealingAnimator.dealToMainPlayer(
            newCards,
            () => log.debug('Stack complete'),
            () => log.debug('Spread complete'),
            () => log.debug('Flip complete')
        );

        if (result.cardNodes.length > 0) {
            const sortedAllCards = PlayerHandDisplay.sortCards(allCards);
            const handDisplay = playerUIController.getHandDisplay();
            if (handDisplay) {
                const targetPositions = handDisplay.getSortedCardPositions(sortedAllCards);
                const newCardPositions: Vec3[] = [];
                const sortedNewCards: number[] = [];
                const remaining = [...newCards];
                for (let i = 0; i < sortedAllCards.length; i++) {
                    const idx = remaining.indexOf(sortedAllCards[i]);
                    if (idx !== -1) {
                        const pos = targetPositions[i];
                        newCardPositions.push(new Vec3(pos.x, pos.y, 0));
                        sortedNewCards.push(sortedAllCards[i]);
                        remaining.splice(idx, 1);
                    }
                }

                await this.dealingAnimator.animateSorting(
                    result.cardNodes,
                    sortedNewCards,
                    newCardPositions,
                    () => log.debug('Sort animation complete')
                );
            }
            this.dealingAnimator.clearAnimationCards();
        }

        const player = playerUIController.getPlayer();
        if (player) {
            player.setHandCards(PlayerHandDisplay.sortCards(allCards));
        }
        playerUIManager.updatePlayerHand(0);

        // 通知模式：发牌动画完成
        this.mode.onDealAnimationComplete();

        this._initialDealAnimationComplete = true;
        this.showPendingMessageIfReady();
    }

    private async playMainPlayerRefillAnimation(
        newCards: number[],
        allCards: number[],
        oldHandCards: number[],
        playerUIManager: any,
        playerUIController: any
    ): Promise<void> {
        if (!this.dealingAnimator) return;

        const handDisplay = playerUIController.getHandDisplay();
        if (!handDisplay) {
            playerUIManager.updatePlayerHand(0);
            return;
        }

        const player = playerUIController.getPlayer();
        if (!player) {
            playerUIManager.updatePlayerHand(0);
            return;
        }

        const displayedCards = handDisplay.getDisplayedCardValues();
        const playedCards = displayedCards.filter((c: number) => !allCards.includes(c));
        const remainingCards = displayedCards.filter((c: number) => allCards.includes(c));

        // 记录出掉的牌在原始显示中的索引（用于后续插入新牌）
        const playedIndices: number[] = [];
        const playedCopy = [...playedCards];
        for (let i = 0; i < displayedCards.length && playedCopy.length > 0; i++) {
            const idx = playedCopy.indexOf(displayedCards[i]);
            if (idx !== -1) {
                playedIndices.push(i);
                playedCopy.splice(idx, 1);
            }
        }

        const hiddenPositions = handDisplay.hideCardsWithoutRelayout(playedCards);

        const targetPositions: Vec3[] = [];
        for (let i = 0; i < newCards.length; i++) {
            if (i < hiddenPositions.length) {
                targetPositions.push(hiddenPositions[i]);
            } else {
                targetPositions.push(hiddenPositions[hiddenPositions.length - 1]);
            }
        }

        await this.dealingAnimator.refillToMainPlayer(
            newCards,
            targetPositions,
            () => log.debug('Refill flight animation complete')
        );

        this.dealingAnimator.clearAnimationCards();

        // 将新牌插入到出掉的牌的原始位置，排序动画更自然
        const unsortedAllCards: number[] = [...remainingCards];
        const newCardsToInsert = [...newCards];
        for (let i = 0; i < playedIndices.length && newCardsToInsert.length > 0; i++) {
            const insertIdx = Math.min(playedIndices[i], unsortedAllCards.length);
            unsortedAllCards.splice(insertIdx, 0, newCardsToInsert.shift()!);
        }
        unsortedAllCards.push(...newCardsToInsert);
        player.setHandCards(unsortedAllCards);
        playerUIManager.updatePlayerHand(0);

        const sortedAllCards = PlayerHandDisplay.sortCards(allCards);
        await this.dealingAnimator.animateSortCards(handDisplay, unsortedAllCards, sortedAllCards);

        player.setHandCards(sortedAllCards);
        playerUIManager.updatePlayerHand(0);

        // 通知模式：发牌动画完成
        this.mode.onDealAnimationComplete();
    }

    // ==================== 辅助方法 ====================

    /**
     * 处理待发的玩家牌（公共牌发完后调用）
     * 根据配置选择同时发牌或轮流发牌
     */
    private processPendingPlayerDeals(): void {
        if (this._pendingPlayerDeals.length === 0) return;

        log.debug(`Processing ${this._pendingPlayerDeals.length} pending player deals...`);

        // 根据配置选择发牌模式
        if (DealingOrderConfig.mode === 'sequential') {
            this.processSequentialDeal();
        } else {
            this.processSimultaneousDeals();
        }
    }

    /**
     * 同时发牌（原有逻辑）
     */
    private processSimultaneousDeals(): void {
        for (const pending of this._pendingPlayerDeals) {
            this.processPlayerDeal(pending.data);
        }
        this._pendingPlayerDeals = [];
    }

    /**
     * 轮流发牌（Round-robin）
     */
    private async processSequentialDeal(): Promise<void> {
        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager || !this.dealingAnimator || !this.deckPile) {
            // Fallback: 同时发牌
            this.processSimultaneousDeals();
            return;
        }

        this.deckPile.show();

        // 1. 收集所有玩家发牌数据
        const playerDeals = new Map<number, { data: DealCardsEvent; newCards: number[]; oldHandCount: number }>();
        let isRefill = false;

        for (const pending of this._pendingPlayerDeals) {
            const playerIndex = this.mode.getPlayerIndexByPlayerId(pending.data.playerId);
            if (playerIndex === -1) continue;

            // 确保玩家映射存在
            if (!this.mode.getPlayerIdToIndexMap().has(pending.data.playerId)) {
                this.mode.upgradePlayerUIToPlayingMode();
            }

            const ctrl = playerUIManager.getPlayerUINode(playerIndex);
            const player = ctrl?.getPlayer();
            const oldHand = player ? [...player.handCards] : [];
            const oldHandCount = oldHand.length;
            const newCards = pending.data.handCards.filter((c: number) => !oldHand.includes(c));

            if (oldHandCount > 0) {
                isRefill = true;
            }

            playerDeals.set(playerIndex, { data: pending.data, newCards, oldHandCount });
        }

        // 2. 推断其他玩家的发牌数据（初始发牌或补牌时）
        const playerCount = playerUIManager.getPlayerCount();
        if (playerDeals.has(0) && playerDeals.size === 1) {
            const mainEntry = playerDeals.get(0)!;
            const mainCardCount = mainEntry.data.handCards.length;

            // 从 allHandCounts 获取其他玩家的手牌数量（补牌时）
            // 如果没有 allHandCounts，则假设所有玩家手牌数量相同（初始发牌时）
            for (let i = 1; i < playerCount; i++) {
                const ctrl = playerUIManager.getPlayerUINode(i);
                const player = ctrl?.getPlayer();
                const oldHandCount = player ? player.handCards.length : 0;

                // 获取该玩家的新手牌数量
                let newHandCount = mainCardCount; // 默认与主玩家相同
                if (mainEntry.data.allHandCounts) {
                    // 从 allHandCounts 中查找该玩家的手牌数量
                    for (const [playerId, count] of Object.entries(mainEntry.data.allHandCounts)) {
                        if (this.mode.getPlayerIndexByPlayerId(playerId) === i) {
                            newHandCount = count;
                            break;
                        }
                    }
                }

                const dealCount = newHandCount - oldHandCount;
                if (dealCount > 0) {
                    // 其他玩家的牌值未知，用 -1 填充
                    const fakeNewCards = Array(dealCount).fill(-1);
                    const fakeHandCards = Array(newHandCount).fill(-1);
                    playerDeals.set(i, {
                        data: { playerId: '', handCards: fakeHandCards } as DealCardsEvent,
                        newCards: fakeNewCards,
                        oldHandCount
                    });
                }
            }
        }

        // 3. 计算发牌顺序
        const dealingOrder = this.buildDealingOrder(playerCount);

        // 4. 找出最大发牌轮数
        let maxRounds = 0;
        for (const [, entry] of playerDeals) {
            maxRounds = Math.max(maxRounds, entry.newCards.length);
        }

        // 4.5 提前清除摊牌显示（此时 handCards 还是旧数据，updateDisplay 不会显示错误数量）
        //     防止 showdown 定时器在后续动画期间触发 updateDisplay 覆盖动画状态
        this.mode.flushShowdownCleanup();

        // 标记发牌动画进行中（防止 onDealerCalled 等外部事件触发 updateDisplay 覆盖动画）
        this._isDealingAnimationInProgress = true;

        // 5. 提前更新所有玩家的 handCards 数据
        //    其他玩家：防止动画期间外部 updateDisplay 用旧牌数重建显示
        //    主玩家：确保 dealer_selected 事件到达时 showCallButtons 能读到正确的手牌数
        for (const [playerIndex, entry] of playerDeals) {
            const ctrl = playerUIManager.getPlayerUINode(playerIndex);
            const player = ctrl?.getPlayer();
            if (player) {
                player.setHandCards(entry.data.handCards);
            }
        }

        // 6. 初始化其他玩家的 stack 显示（视觉上仍从旧牌数开始，逐张递增）
        for (const [playerIndex, entry] of playerDeals) {
            if (playerIndex === 0) continue;
            const ctrl = playerUIManager.getPlayerUINode(playerIndex);
            if (!ctrl) continue;
            const handDisplay = ctrl.getHandDisplay();
            if (handDisplay) {
                handDisplay.initStackForDealing(entry.oldHandCount);
            }
        }

        // 7. 主玩家补牌：隐藏出掉的牌，获取空位，记录出牌位置索引
        let mainPlayerTargetPositions: Vec3[] = [];
        let mainPlayerPlayedIndices: number[] = [];  // 出掉的牌在原始显示中的索引
        const mainPlayerEntry = playerDeals.get(0);
        if (isRefill && mainPlayerEntry) {
            const ctrl = playerUIManager.getPlayerUINode(0);
            const handDisplay = ctrl?.getHandDisplay();
            if (handDisplay) {
                const displayedCards = handDisplay.getDisplayedCardValues();
                const playedCards = displayedCards.filter((c: number) => !mainPlayerEntry.data.handCards.includes(c));

                // 记录出掉的牌在原始显示中的索引（用于后续插入新牌）
                const playedCopy = [...playedCards];
                for (let i = 0; i < displayedCards.length && playedCopy.length > 0; i++) {
                    const idx = playedCopy.indexOf(displayedCards[i]);
                    if (idx !== -1) {
                        mainPlayerPlayedIndices.push(i);
                        playedCopy.splice(idx, 1);
                    }
                }

                const hiddenPositions = handDisplay.hideCardsWithoutRelayout(playedCards);
                mainPlayerTargetPositions = hiddenPositions;
            }
        }

        // 8. 轮流发牌循环
        const mainPlayerDealtCards: number[] = [];
        const cardCounters = new Map<number, number>();

        for (const [playerIndex, entry] of playerDeals) {
            cardCounters.set(playerIndex, entry.oldHandCount);
        }

        // 计算总发牌数，推算牌堆起始数量（用于逐张递减牌堆厚度）
        let totalCardsToDeal = 0;
        for (const [, entry] of playerDeals) {
            totalCardsToDeal += entry.newCards.length;
        }
        const lastEvent = this._pendingPlayerDeals[this._pendingPlayerDeals.length - 1];
        const finalDeckSize = lastEvent?.data.deckSize ?? 0;
        let currentDeckSize = finalDeckSize + totalCardsToDeal;

        // 先用推算的起始数量更新牌堆显示
        if (this.deckPile) {
            this.deckPile.updateCardCount(currentDeckSize);
        }
        this._currentDeckSize = currentDeckSize;

        for (let round = 0; round < maxRounds; round++) {
            for (const playerIndex of dealingOrder) {
                const entry = playerDeals.get(playerIndex);
                if (!entry || round >= entry.newCards.length) continue;

                const currentCount = cardCounters.get(playerIndex) || 0;
                const cardValue = entry.newCards[round];

                // 牌飞出前就递减牌堆，视觉上与动画同步
                currentDeckSize--;
                this._currentDeckSize = currentDeckSize;
                if (this.deckPile) {
                    this.deckPile.updateCardCount(currentDeckSize);
                }

                if (playerIndex === 0) {
                    // 主玩家：始终保留飞行节点（初始发牌堆叠，补牌停留在空位等翻牌）
                    let targetPos: Vec3;
                    if (isRefill && mainPlayerTargetPositions.length > 0) {
                        // 补牌：飞到空位
                        const posIndex = Math.min(round, mainPlayerTargetPositions.length - 1);
                        targetPos = mainPlayerTargetPositions[posIndex];
                    } else {
                        // 初始发牌：飞到堆叠区
                        const handPos = this.getPlayerHandWorldPosition(0);
                        const stackOff = mainPlayerDealtCards.length * DealingDuration.stackOffset;
                        targetPos = new Vec3(
                            handPos.x + stackOff,
                            handPos.y + stackOff,
                            handPos.z
                        );
                    }
                    await this.dealingAnimator.dealSingleCardToPosition(
                        cardValue,
                        targetPos,
                        CardScale.dealing.playerCard,
                        true // keepAlive: 保留节点
                    );
                    mainPlayerDealtCards.push(cardValue);
                } else {
                    // 其他玩家：飞到手牌区
                    const handPos = this.getPlayerHandWorldPosition(playerIndex);
                    const stackOff = round * DealingDuration.stackOffset;
                    const targetPos = new Vec3(
                        handPos.x + stackOff,
                        handPos.y + stackOff,
                        handPos.z
                    );

                    await this.dealingAnimator.dealSingleCardToPosition(
                        -1,
                        targetPos,
                        CardScale.dealing.otherPlayerCard
                    );

                    // 飞行动画完成后再更新计数标签和堆叠厚度，避免牌还没到就已经增长
                    const ctrl = playerUIManager.getPlayerUINode(playerIndex);
                    const handDisplay = ctrl?.getHandDisplay();
                    if (handDisplay) {
                        handDisplay.updateCardCountLabel(currentCount + 1);
                    }
                }

                cardCounters.set(playerIndex, currentCount + 1);

                // 每张牌之间的间隔
                await this.delay(DealingOrderConfig.sequentialCardInterval);
            }
        }

        // 9. 主玩家揭牌
        if (mainPlayerEntry && mainPlayerDealtCards.length > 0) {
            await this.delay(0.2);

            const ctrl = playerUIManager.getPlayerUINode(0);
            const player = ctrl?.getPlayer();
            const handDisplay = ctrl?.getHandDisplay();

            if (isRefill) {
                // 补牌：翻牌飞行节点 → 清理 → 更新手牌 → 重排序
                await this.dealingAnimator.flipAnimationCards(mainPlayerDealtCards);
                await this.delay(0.15);
                this.dealingAnimator.clearAnimationCards();

                // 构建 unsortedAllCards：将新牌插入到出掉的牌的原始位置
                // 这样 updatePlayerHand 后新牌在视觉上出现在原来出牌的位置，排序动画更自然
                const displayedCards = handDisplay?.getDisplayedCardValues() || [];
                const remainingCards = displayedCards.filter((c: number) => mainPlayerEntry.data.handCards.includes(c));
                const unsortedAllCards: number[] = [...remainingCards];
                const newCardsToInsert = [...mainPlayerDealtCards];
                for (let i = 0; i < mainPlayerPlayedIndices.length && newCardsToInsert.length > 0; i++) {
                    const insertIdx = Math.min(mainPlayerPlayedIndices[i], unsortedAllCards.length);
                    unsortedAllCards.splice(insertIdx, 0, newCardsToInsert.shift()!);
                }
                // 如果还有剩余新牌（新牌比出牌多），追加到末尾
                unsortedAllCards.push(...newCardsToInsert);

                if (player) {
                    player.setHandCards(unsortedAllCards);
                }
                playerUIManager.updatePlayerHand(0);

                const sortedAllCards = PlayerHandDisplay.sortCards(mainPlayerEntry.data.handCards);
                if (handDisplay) {
                    await this.dealingAnimator.animateSortCards(handDisplay, unsortedAllCards, sortedAllCards);
                }

                if (player) {
                    player.setHandCards(sortedAllCards);
                }
                playerUIManager.updatePlayerHand(0);
            } else {
                // 初始发牌：展开 + 翻牌 + 排序
                // 先清理飞行阶段保留的堆叠牌（spreadAndFlipMainPlayer 会在同一位置重新创建）
                this.dealingAnimator.clearAnimationCards();
                const result = await this.dealingAnimator.spreadAndFlipMainPlayer(
                    mainPlayerDealtCards,
                    () => log.debug('Spread complete'),
                    () => log.debug('Flip complete')
                );

                if (result.cardNodes.length > 0) {
                    const sortedAllCards = PlayerHandDisplay.sortCards(mainPlayerEntry.data.handCards);
                    if (handDisplay) {
                        const targetPositions = handDisplay.getSortedCardPositions(sortedAllCards);
                        const newCardPositions: Vec3[] = [];
                        const sortedNewCards: number[] = [];
                        const remaining = [...mainPlayerDealtCards];

                        for (let i = 0; i < sortedAllCards.length; i++) {
                            const idx = remaining.indexOf(sortedAllCards[i]);
                            if (idx !== -1) {
                                const pos = targetPositions[i];
                                newCardPositions.push(new Vec3(pos.x, pos.y, 0));
                                sortedNewCards.push(sortedAllCards[i]);
                                remaining.splice(idx, 1);
                            }
                        }

                        await this.dealingAnimator.animateSorting(
                            result.cardNodes,
                            sortedNewCards,
                            newCardPositions,
                            () => log.debug('Sort animation complete')
                        );
                    }
                    this.dealingAnimator.clearAnimationCards();
                }

                if (player) {
                    player.setHandCards(PlayerHandDisplay.sortCards(mainPlayerEntry.data.handCards));
                }
                playerUIManager.updatePlayerHand(0);

                this._initialDealAnimationComplete = true;
                this.showPendingMessageIfReady();
            }
        } else if (mainPlayerEntry) {
            // 无新牌（牌堆已空）：直接更新主玩家手牌显示（重新居中布局）
            const ctrl = playerUIManager.getPlayerUINode(0);
            const player = ctrl?.getPlayer();
            if (player) {
                player.setHandCards(mainPlayerEntry.data.handCards);
            }
            playerUIManager.updatePlayerHand(0);
        }

        // 10. 刷新所有其他玩家的手牌显示（handCards 已在步骤5提前更新）
        for (const [playerIndex] of playerDeals) {
            if (playerIndex === 0) continue;
            playerUIManager.updatePlayerHand(playerIndex);
        }

        // 发牌动画完成，解除保护
        this._isDealingAnimationInProgress = false;

        // 11. 牌堆数量已在发牌循环中逐张递减，无需再次更新

        // 12. 清空队列并通知完成
        this._pendingPlayerDeals = [];

        if (mainPlayerEntry) {
            this.mode.onDealAnimationComplete();
        }
    }

    /**
     * 构建发牌顺序（从庄家左边开始顺时针）
     * 所有客户端看到的绝对座位顺序一致
     */
    private buildDealingOrder(playerCount: number): number[] {
        const dealerId = this.mode.getDealerId();
        let startIndex = 0;

        if (dealerId) {
            const idx = this.mode.getPlayerIndexByPlayerId(dealerId);
            if (idx !== -1) {
                startIndex = idx;
            }
        } else {
            // 初始发牌没有庄家：用 playerId 字典序最小的玩家作为固定起始点
            // 所有客户端的 playerId 集合相同，排序结果一致，保证绝对顺序一致
            const playerIds = Array.from(this.mode.getPlayerIdToIndexMap().keys()).sort();
            if (playerIds.length > 0) {
                const idx = this.mode.getPlayerIndexByPlayerId(playerIds[0]);
                if (idx !== -1) {
                    startIndex = idx;
                }
            }
        }

        // 从庄家左边第一个玩家开始（标准发牌规则）
        const firstPlayer = DealingOrderConfig.startFromDealerLeft
            ? (startIndex + 1) % playerCount
            : startIndex;

        const order: number[] = [];
        for (let i = 0; i < playerCount; i++) {
            order.push((firstPlayer + i) % playerCount);
        }
        return order;
    }

    /**
     * 延迟工具函数
     */
    private delay(seconds: number): Promise<void> {
        return new Promise(resolve => {
            this.mode.registerTimeout(() => resolve(), seconds * 1000);
        });
    }

    /**
     * 补牌事件 debounce：等待 100ms 收集所有玩家的补牌事件
     */
    private scheduleRefillProcessing(): void {
        if (this._refillDebounceTimer !== null) return;

        this._refillDebounceTimer = setTimeout(() => {
            this._refillDebounceTimer = null;
            this.processPendingPlayerDeals();
        }, 100) as unknown as number;
    }

    /**
     * 立即处理待处理的补牌事件（取消 debounce 定时器）
     * 在需要最新 handCards 数据时调用（如显示 call 按钮前）
     */
    public flushPendingDeals(): void {
        if (this._refillDebounceTimer !== null) {
            clearTimeout(this._refillDebounceTimer);
            this._refillDebounceTimer = null;
            this.processPendingPlayerDeals();
        }
    }

    /**
     * 检查并显示待显示的消息
     */
    public showPendingMessageIfReady(): void {
        if (this._initialDealAnimationComplete && this._pendingMessage) {
            this.mode.showMessage(this._pendingMessage.message, this._pendingMessage.duration);
            this._pendingMessage = null;
        }
    }

    /**
     * 获取玩家手牌区域的世界坐标
     */
    private getPlayerHandWorldPosition(playerIndex: number): Vec3 {
        const game = this.mode.getGame();
        const playerUIManager = game.playerUIManager;
        if (!playerUIManager) return new Vec3(0, 0, 0);

        const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
        if (playerUINode) {
            const handContainerPos = playerUINode.getHandContainerWorldPosition();
            return new Vec3(handContainerPos.x, handContainerPos.y, 0);
        }

        const pos = playerUIManager.getPlayerWorldPosition(playerIndex);
        if (pos) return new Vec3(pos.x, pos.y, 0);
        return new Vec3(0, 0, 0);
    }
}
