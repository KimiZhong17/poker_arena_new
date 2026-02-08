import { GameModeClientBase, GameModeConfig } from "./GameModeClientBase";
import { Game } from "../../Game";
import { Player, PlayerInfo } from "../../LocalStore/LocalPlayerStore";
import { LocalRoomStore } from "../../LocalStore/LocalRoomStore";
import { Node, instantiate, Vec3, UITransform } from "cc";
import {
    DealCardsEvent,
    CommunityCardsEvent,
    RequestFirstDealerSelectionEvent,
    PlayerSelectedCardEvent,
    FirstDealerRevealEvent,
    DealerSelectedEvent,
    DealerCalledEvent,
    PlayerPlayedEvent,
    ShowdownEvent,
    ShowdownResult,
    RoundEndEvent,
    GameOverEvent,
    PlayerAutoChangedEvent,
    ClientMessageType,
    SetAutoRequest
} from '../../Network/Messages';
import { LocalUserStore } from '../../LocalStore/LocalUserStore';
import { LocalGameStore } from '../../LocalStore/LocalGameStore';
import { PokerFactory } from '../../UI/PokerFactory';
import { Poker } from '../../UI/Poker';
import { TheDecreeUIController } from '../../UI/TheDecreeUIController';
import { TheDecreeGameState } from './TheDecreeGameState';
import { DeckPile } from '../../UI/DeckPile';
import { DealingAnimator, DealingResult } from '../../UI/DealingAnimator';
import { PlayerHandDisplay } from '../../UI/PlayerHandDisplay';
import { SeatLayoutConfig } from '../../Config/SeatConfig';
import { EventCenter, GameEvents } from '../../Utils/EventCenter';

/**
 * The Decree game mode - Network/Client version
 * 网络版未定之数游戏模式（客户端）
 *
 * 职责：
 * - 监听服务器事件并更新 UI
 * - 管理游戏模式特定的 UI 节点（communityCardsNode 等）
 * - 不包含任何游戏逻辑（逻辑在服务器）
 * - 通过 NetworkClient 发送玩家操作到服务器
 */
export class TheDecreeModeClient extends GameModeClientBase {
    // 游戏状态数据（从服务器同步）
    private communityCards: number[] = [];
    private dealerId: string = '';
    private currentRoundNumber: number = 0;
    private cardsToPlay: number = 0;
    private gameState: TheDecreeGameState = TheDecreeGameState.SETUP; // 服务器的游戏状态

    // 自动出牌设置（仅用于 player_0）
    private isPlayer0AutoPlay: boolean = true;

    // 摊牌显示清除定时器
    private showdownClearTimer: number | null = null;

    // 摊牌展示配置
    private readonly SHOWDOWN_INTERVAL_MS = 1000;  // 每个玩家牌型展示间隔（毫秒）
    private readonly WINNER_MESSAGE_DURATION = 3.0;  // 赢家消息显示时长（秒）
    private readonly WINNER_COLOR = '#FFD700';  // 赢家牌型颜色（金色）

    // UI 节点（游戏模式特定）
    private theDecreeContainerNode: Node | null = null;
    private communityCardsNode: Node | null = null;
    private theDecreeUIController: TheDecreeUIController | null = null;

    // 发牌动画相关
    private deckPile: DeckPile | null = null;
    private dealingAnimator: DealingAnimator | null = null;

    // 动画队列控制
    private _communityCardsDealt: boolean = false;
    private _pendingPlayerDeals: Array<{ data: DealCardsEvent }> = [];

    // 初始发牌动画完成标志
    private _initialDealAnimationComplete: boolean = false;
    private _pendingMessage: { message: string; duration: number } | null = null;

    // 摊牌动画进行中标志（用于延迟处理 GameOver 事件）
    private _isShowdownInProgress: boolean = false;
    private _pendingGameOver: GameOverEvent | null = null;

    constructor(game: Game, config?: GameModeConfig) {
        const defaultConfig: GameModeConfig = {
            id: "the_decree",
            name: "TheDecree",
            displayName: "未定之数",
            minPlayers: 2,
            maxPlayers: 4,
            deckCount: 1,
            initialHandSize: 5,
            description: "Network multiplayer poker game"
        };

        super(game, config || defaultConfig);
    }

    // ==================== 生命周期方法 ====================

    public onEnter(): void {
        console.log('[TheDecreeModeClient] Entering game mode');
        this.isActive = true;

        // 重置动画状态标志
        this._initialDealAnimationComplete = false;
        this._pendingMessage = null;

        // 查找并缓存游戏模式特定的节点
        this.findModeSpecificNodes();

        // 升级 PlayerUIManager 到游戏模式
        this.upgradePlayerUIToPlayingMode();

        // 显示 UI
        this.showUI();

        // 注册网络事件监听器（使用基类方法）
        this.setupNetworkEvents();
        this.setupLocalEvents();

        // 检查是否是重连场景，如果是则恢复游戏状态
        this.checkAndRestoreReconnectState();

        console.log('[TheDecreeModeClient] Waiting for server events...');
    }

    public onExit(): void {
        console.log('[TheDecreeModeClient] Exiting game mode');
        this.isActive = false;

        // 清除摊牌显示定时器
        this.clearShowdownTimer();

        // 清除待处理的 GameOver 事件
        this._pendingGameOver = null;
        this._isShowdownInProgress = false;

        // 注销网络事件监听器（使用基类方法）
        this.unregisterAllNetworkEvents();
        this.cleanupLocalEvents();

        // 隐藏 UI
        this.hideUI();

        // 清理公牌节点的子元素（重要：防止再来一局时看到上一局的公牌）
        // 注意：需要检查 isValid，因为在场景销毁时节点可能已经被销毁
        if (this.communityCardsNode && this.communityCardsNode.isValid) {
            console.log('[TheDecreeModeClient] Clearing community cards node children');
            this.communityCardsNode.removeAllChildren();
        }

        // 清除节点引用
        this.theDecreeContainerNode = null;
        this.communityCardsNode = null;
    }

    public cleanup(): void {
        console.log('[TheDecreeModeClient] Cleaning up');
        this.clearShowdownTimer();
        super.cleanup();
        this.unregisterAllNetworkEvents();
        this.cleanupLocalEvents();
    }

    // ==================== 节点查找 ====================

    /**
     * 查找游戏模式特定的节点
     */
    private findModeSpecificNodes(): void {
        // 查找 TheDecree 容器节点
        this.theDecreeContainerNode = this.findNodeByName(this.game.node, 'TheDecree');
        if (this.theDecreeContainerNode) {
            console.log('[TheDecreeModeClient] Found TheDecree container node');

            // 查找 TheDecreeUIController 组件
            this.theDecreeUIController = this.theDecreeContainerNode.getComponent(TheDecreeUIController);
            if (this.theDecreeUIController) {
                console.log('[TheDecreeModeClient] Found TheDecreeUIController');
            } else {
                console.warn('[TheDecreeModeClient] TheDecreeUIController component not found');
            }
        } else {
            console.warn('[TheDecreeModeClient] TheDecree container node not found');
        }

        // 查找公共牌节点
        this.communityCardsNode = this.findNodeByName(this.game.node, 'CommunityCardsNode');
        if (this.communityCardsNode) {
            console.log('[TheDecreeModeClient] Found CommunityCardsNode');
        } else {
            console.warn('[TheDecreeModeClient] CommunityCardsNode not found');
        }

        // 初始化发牌动画系统
        this.initDealingAnimation();
    }

    /**
     * 递归查找节点
     */
    private findNodeByName(root: Node, name: string): Node | null {
        if (root.name === name) {
            return root;
        }

        for (const child of root.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * 初始化发牌动画系统
     */
    private initDealingAnimation(): void {
        console.log('[TheDecreeModeClient] Initializing dealing animation system...');

        const pokerFactory = PokerFactory.instance;
        if (!pokerFactory) {
            console.warn('[TheDecreeModeClient] PokerFactory not found, skipping dealing animation init');
            return;
        }

        const pokerSprites = pokerFactory['_pokerSprites'] as Map<string, any>;
        const pokerPrefab = pokerFactory['_pokerPrefab'];

        if (!pokerSprites || !pokerPrefab) {
            console.warn('[TheDecreeModeClient] Poker resources not found');
            return;
        }

        // 查找牌堆节点（优先使用编辑器中创建的 DeckPileNode）
        if (this.theDecreeContainerNode) {
            let deckPileNode = this.theDecreeContainerNode.getChildByName('DeckPileNode')
                            || this.theDecreeContainerNode.getChildByName('DeckPile');
            if (!deckPileNode) {
                console.log('[TheDecreeModeClient] Creating DeckPile node dynamically');
                deckPileNode = new Node('DeckPileNode');
                deckPileNode.addComponent(UITransform);
                deckPileNode.layer = this.theDecreeContainerNode.layer;
                this.theDecreeContainerNode.addChild(deckPileNode);
            } else {
                console.log('[TheDecreeModeClient] Found existing DeckPile node:', deckPileNode.name);
            }

            this.deckPile = deckPileNode.getComponent(DeckPile) || deckPileNode.addComponent(DeckPile);
            this.deckPile.init(pokerSprites, pokerPrefab);
            console.log('[TheDecreeModeClient] DeckPile initialized');
        }

        // 创建发牌动画控制器
        if (this.theDecreeContainerNode) {
            let animatorNode = this.theDecreeContainerNode.getChildByName('DealingAnimator');
            if (!animatorNode) {
                animatorNode = new Node('DealingAnimator');
                animatorNode.addComponent(UITransform);
                animatorNode.layer = this.theDecreeContainerNode.layer;
                this.theDecreeContainerNode.addChild(animatorNode);
            }

            this.dealingAnimator = animatorNode.getComponent(DealingAnimator) || animatorNode.addComponent(DealingAnimator);

            // 设置牌堆和公牌区引用
            if (this.deckPile) {
                this.dealingAnimator.setDeckPile(this.deckPile);
            }
            if (this.communityCardsNode) {
                this.dealingAnimator.setCommunityCardsNode(this.communityCardsNode);
            }

            // 初始化动画器
            const playerUIManager = this.game.playerUIManager;
            this.dealingAnimator.init(
                pokerSprites,
                pokerPrefab,
                (playerIndex: number) => this.getPlayerHandWorldPosition(playerIndex),
                () => playerUIManager?.getPlayerCount() || 0
            );

            console.log('[TheDecreeModeClient] DealingAnimator initialized');
        }

        console.log('[TheDecreeModeClient] Dealing animation system ready');
    }

    /**
     * 获取玩家手牌区域的世界坐标
     * 对于其他玩家，需要使用手牌容器位置（已包含 handPileOffset）
     */
    private getPlayerHandWorldPosition(playerIndex: number): Vec3 {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            return new Vec3(0, 0, 0);
        }

        const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
        if (playerUINode) {
            // 获取手牌容器的世界坐标（已包含 handPileOffset）
            const handContainerPos = playerUINode.getHandContainerWorldPosition();
            return new Vec3(handContainerPos.x, handContainerPos.y, 0);
        }

        // 回退：使用座位节点位置
        const pos = playerUIManager.getPlayerWorldPosition(playerIndex);
        if (pos) {
            return new Vec3(pos.x, pos.y, 0);
        }
        return new Vec3(0, 0, 0);
    }

    // ==================== UI 控制 ====================

    public showUI(): void {
        console.log('[TheDecreeModeClient] Showing UI');

        // 显示 TheDecree 容器
        if (this.theDecreeContainerNode) {
            this.theDecreeContainerNode.active = true;
        }

        // 显示公共牌节点
        if (this.communityCardsNode) {
            this.communityCardsNode.active = true;
        }

        // 显示自动出牌开关
        if (this.theDecreeUIController && this.theDecreeUIController.autoPlaySwitch) {
            this.theDecreeUIController.autoPlaySwitch.node.active = true;
            console.log('[TheDecreeModeClient] Auto-play switch shown');
        }

        // 隐藏其他游戏模式的节点（如果存在）
        const guandanNode = this.findNodeByName(this.game.node, 'Guandan');
        if (guandanNode) {
            guandanNode.active = false;
        }
    }

    public hideUI(): void {
        console.log('[TheDecreeModeClient] Hiding UI');

        if (this.theDecreeContainerNode) {
            this.theDecreeContainerNode.active = false;
        }

        if (this.communityCardsNode) {
            this.communityCardsNode.active = false;
        }
    }

    // ==================== 网络事件监听 ====================

    /**
     * 设置网络事件（使用基类的批量注册方法）
     */
    protected setupNetworkEvents(): void {
        console.log('[TheDecreeModeClient] ========== Setting up network events ==========');
        console.log('[TheDecreeModeClient] Registering event handlers...');

        this.registerNetworkEvents({
            'deal_cards': this.onDealCards,
            'community_cards': this.onCommunityCards,
            'request_first_dealer_selection': this.onRequestFirstDealerSelection,
            'player_selected_card': this.onPlayerSelectedCard,
            'first_dealer_reveal': this.onFirstDealerReveal,
            'dealer_selected': this.onDealerSelected,
            'dealer_called': this.onDealerCalled,
            'player_played': this.onPlayerPlayed,
            'showdown': this.onShowdown,
            'round_end': this.onRoundEnd,
            'game_over': this.onGameOver,
            'player_auto_changed': this.onPlayerAutoChanged
        });

        console.log('[TheDecreeModeClient] ✓ All network events registered');
        console.log('[TheDecreeModeClient] ========================================');
    }

    private setupLocalEvents(): void {
        EventCenter.on(GameEvents.GAME_RECONNECTED, this.onGameReconnected, this);
        EventCenter.on(GameEvents.PLAYER_AUTO_CHANGED, this.onPlayerAutoChangedEvent, this);
    }

    private cleanupLocalEvents(): void {
        EventCenter.off(GameEvents.GAME_RECONNECTED, this.onGameReconnected, this);
        EventCenter.off(GameEvents.PLAYER_AUTO_CHANGED, this.onPlayerAutoChangedEvent, this);
    }

    private onGameReconnected = () => {
        console.log('[TheDecreeModeClient] Game reconnected, resyncing UI/state...');
        console.log('[TheDecreeModeClient] game instance:', {
            node: this.game?.node?.name,
            uuid: this.game?.node?.uuid,
            scene: this.game?.node?.scene?.name,
            holdLoading: (this.game as any)?._holdLoadingForReconnect
        });
        console.log('[TheDecreeModeClient] playerUIManager exists:', !!this.game.playerUIManager);
        console.log('[TheDecreeModeClient] current room:', !!LocalRoomStore.getInstance().getCurrentRoom());

        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager && playerUIManager.getPlayerCount() === 0) {
            this.upgradePlayerUIToPlayingMode();
        } else {
            this.refreshPlayerIdMapping();
        }

        this.checkAndRestoreReconnectState(true);
    };

    private onPlayerAutoChangedEvent = (data: PlayerAutoChangedEvent) => {
        const playerIndex = this.getPlayerIndex(data.playerId);
        if (playerIndex === -1) return;

        const playerUIManager = this.game.playerUIManager;
        if (playerUIManager) {
            playerUIManager.setPlayerAutoStatus(playerIndex, data.isAuto, data.reason);
        }
    };

    // ==================== 事件处理器 ====================

    private onDealCards(data: DealCardsEvent): void {
        console.log('[TheDecreeModeClient] ========== Deal Cards Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received deal_cards event from server');
        console.log('[TheDecreeModeClient] Player ID:', data.playerId);
        console.log('[TheDecreeModeClient] Cards:', data.handCards);
        console.log('[TheDecreeModeClient] Card count:', data.handCards.length);
        console.log('[TheDecreeModeClient] All hand counts:', data.allHandCounts);
        console.log('[TheDecreeModeClient] Raw event data:', JSON.stringify(data));

        // 如果公共牌还没发完，先缓存玩家发牌事件
        if (!this._communityCardsDealt) {
            console.log('[TheDecreeModeClient] Community cards not dealt yet, queuing player deal...');
            this._pendingPlayerDeals.push({ data });
            return;
        }

        // 执行实际的发牌处理
        this.processPlayerDeal(data);

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 处理玩家发牌（实际执行）
     */
    private processPlayerDeal(data: DealCardsEvent): void {
        // 检查 playerId 是否在映射中，如果不在，重新初始化映射
        if (!this.playerIdToIndexMap.has(data.playerId)) {
            console.warn(`[TheDecreeModeClient] Player ${data.playerId} not in mapping, reinitializing...`);
            console.log('[TheDecreeModeClient] Current mapping before reinit:', Array.from(this.playerIdToIndexMap.entries()));
            this.upgradePlayerUIToPlayingMode();
            console.log('[TheDecreeModeClient] Current mapping after reinit:', Array.from(this.playerIdToIndexMap.entries()));

            // 再次检查是否成功添加
            if (!this.playerIdToIndexMap.has(data.playerId)) {
                console.error(`[TheDecreeModeClient] Failed to add player ${data.playerId} to mapping after reinit!`);
                console.error('[TheDecreeModeClient] This means the player is not in LocalRoomStore');
                return;
            }
        }

        // 服务器发送的是当前玩家的手牌
        // 更新 Player 数据和 PlayerUIManager 显示
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found!');
            return;
        }

        // 获取玩家相对索引
        const playerIndex = this.getPlayerIndex(data.playerId);
        console.log(`[TheDecreeModeClient] Player index (relative): ${playerIndex}`);

        if (playerIndex === -1) {
            console.warn(`[TheDecreeModeClient] Player ${data.playerId} not found in player list`);
            return;
        }

        // 更新 Player 数据（从 PlayerUIController 获取）
        const playerUIController = playerUIManager.getPlayerUINode(playerIndex);
        if (playerUIController) {
            const player = playerUIController.getPlayer();
            if (player) {
                console.log(`[TheDecreeModeClient] Found player: ${player.name}`);

                // 保存旧手牌（用于补牌动画）
                const oldHandCards = [...player.handCards];
                const oldHandCount = oldHandCards.length;
                const newHandCount = data.handCards.length;

                // 计算实际的新牌（在新手牌中但不在旧手牌中的牌）
                const newCards = data.handCards.filter((c: number) => !oldHandCards.includes(c));
                const actualDealCount = newCards.length;

                console.log(`[TheDecreeModeClient] Before update - handCards: ${oldHandCount}`);
                console.log(`[TheDecreeModeClient] New hand count: ${newHandCount}, Actual new cards: ${actualDealCount}`);

                // 使用发牌动画（如果可用且有新牌）
                const isMainPlayer = playerIndex === 0;
                const isInitialDeal = oldHandCount === 0;  // 初始发牌：旧手牌为0

                if (this.dealingAnimator && this.deckPile && actualDealCount > 0) {
                    console.log(`[TheDecreeModeClient] Playing deal animation for ${actualDealCount} cards (isInitialDeal: ${isInitialDeal})...`);
                    this.deckPile.show();

                    if (isMainPlayer) {
                        if (isInitialDeal) {
                            // 初始发牌：先设置手牌，再播放动画
                            player.setHandCards(data.handCards);
                            this.playMainPlayerDealAnimation(newCards, data.handCards, playerUIManager, playerUIController);
                        } else {
                            // 补牌：传入旧手牌，动画方法内部处理手牌更新
                            this.playMainPlayerRefillAnimation(newCards, data.handCards, oldHandCards, playerUIManager, playerUIController);
                        }
                    } else {
                        // 其他玩家：先设置手牌
                        player.setHandCards(data.handCards);
                        // 获取手牌显示组件用于更新数量
                        const handDisplay = playerUIController.getHandDisplay();
                        const startCount = oldHandCount;
                        // 其他玩家使用简单动画，只发补牌数量
                        this.dealingAnimator.dealToOtherPlayer(
                            playerIndex,
                            actualDealCount,
                            () => {
                                console.log('[TheDecreeModeClient] Other player deal animation complete');
                                playerUIManager.updatePlayerHand(playerIndex);
                            },
                            (cardIndex: number) => {
                                // 每发一张牌，更新手牌数量显示
                                if (handDisplay) {
                                    const newCount = startCount + cardIndex + 1;
                                    handDisplay.updateCardCountLabel(newCount);
                                }
                            }
                        );
                    }
                } else {
                    // 无动画或无新牌，直接更新显示
                    if (actualDealCount <= 0) {
                        console.log(`[TheDecreeModeClient] No new cards to deal (actualDealCount: ${actualDealCount}), updating display directly`);
                    } else {
                        console.log(`[TheDecreeModeClient] Calling updatePlayerHand (no animation)...`);
                    }
                    playerUIManager.updatePlayerHand(playerIndex);

                    console.log(`[TheDecreeModeClient] ✓ Hand display updated successfully`);

                    // 如果是主玩家（index 0），启用卡牌选择功能（允许预选）
                    if (isMainPlayer) {
                        console.log('[TheDecreeModeClient] Enabling card selection for player 0 (pre-selection allowed)...');

                        // 通过 TheDecreeUIController 启用选牌（这样会正确更新 _selectedCardIndices）
                        if (this.theDecreeUIController) {
                            this.theDecreeUIController.enableCardSelection();
                            console.log('[TheDecreeModeClient] ✓ Card selection enabled via UI controller (pre-selection mode)');
                        } else {
                            console.warn('[TheDecreeModeClient] TheDecreeUIController not found, cannot enable card selection');
                        }
                    }
                }
            } else {
                console.error(`[TheDecreeModeClient] ✗ Player not found in PlayerUIController for index ${playerIndex}`);
            }
        } else {
            console.error(`[TheDecreeModeClient] ✗ PlayerUIController not found for index ${playerIndex}`);
        }

        // 更新其他玩家的手牌显示
        // 如果有 allHandCounts，使用它；否则假设所有玩家牌数与主玩家相同
        if (playerIndex === 0) {
            const playerCount = playerUIManager.getPlayerCount();
            const mainPlayerCardCount = data.handCards.length;

            console.log(`[TheDecreeModeClient] Updating other players hand displays (${playerCount - 1} players)...`);

            for (let i = 1; i < playerCount; i++) {
                const otherPlayerUIController = playerUIManager.getPlayerUINode(i);
                if (otherPlayerUIController) {
                    const otherPlayer = otherPlayerUIController.getPlayer();
                    if (otherPlayer) {
                        // 获取旧的手牌数量
                        const oldOtherHandCount = otherPlayer.handCards.length;

                        // 获取新的手牌数量：优先使用 allHandCounts，否则使用主玩家的牌数
                        let newOtherHandCount = mainPlayerCardCount;
                        if (data.allHandCounts) {
                            // 需要找到对应的 playerId
                            for (const [playerId, count] of Object.entries(data.allHandCounts)) {
                                if (this.getPlayerIndex(playerId) === i) {
                                    newOtherHandCount = count;
                                    break;
                                }
                            }
                        }

                        // 计算补牌数量
                        const otherDealCount = newOtherHandCount - oldOtherHandCount;

                        console.log(`[TheDecreeModeClient] Player ${otherPlayer.name} at index ${i}: old=${oldOtherHandCount}, new=${newOtherHandCount}, deal=${otherDealCount}`);

                        // 更新其他玩家的手牌数量（使用 -1 表示未知的牌）
                        const emptyCards = Array(newOtherHandCount).fill(-1);
                        otherPlayer.setHandCards(emptyCards);

                        // 播放发牌动画（如果可用且有补牌）
                        if (this.dealingAnimator && this.deckPile && otherDealCount > 0) {
                            const otherHandDisplay = otherPlayerUIController?.getHandDisplay();
                            const otherStartCount = oldOtherHandCount;
                            this.dealingAnimator.dealToOtherPlayer(
                                i,
                                otherDealCount,
                                () => {
                                    console.log(`[TheDecreeModeClient] Other player ${i} deal animation complete`);
                                    playerUIManager.updatePlayerHand(i);
                                },
                                (cardIndex: number) => {
                                    // 每发一张牌，更新手牌数量显示
                                    if (otherHandDisplay) {
                                        const newCount = otherStartCount + cardIndex + 1;
                                        otherHandDisplay.updateCardCountLabel(newCount);
                                    }
                                }
                            );
                        } else {
                            // 无动画或无补牌，直接更新显示
                            playerUIManager.updatePlayerHand(i);
                        }

                        console.log(`[TheDecreeModeClient] ✓ Updated hand count for player at index ${i}`);
                    }
                }
            }
            console.log('[TheDecreeModeClient] ✓ All other players hand counts updated');
        } else if (data.allHandCounts) {
            // 非主玩家的 deal_cards 事件（补牌场景），更新其他玩家
            console.log('[TheDecreeModeClient] Updating all players hand counts from allHandCounts...');
            for (const [playerId, handCount] of Object.entries(data.allHandCounts)) {
                // 跳过当前玩家（已经更新过了）
                if (playerId === data.playerId) {
                    continue;
                }

                const otherPlayerIndex = this.getPlayerIndex(playerId);
                if (otherPlayerIndex === -1) {
                    console.warn(`[TheDecreeModeClient] Player ${playerId} not found in mapping`);
                    continue;
                }

                const otherPlayerUIController = playerUIManager.getPlayerUINode(otherPlayerIndex);
                if (otherPlayerUIController) {
                    const otherPlayer = otherPlayerUIController.getPlayer();
                    if (otherPlayer) {
                        console.log(`[TheDecreeModeClient] Updating hand count for player ${otherPlayer.name}: ${handCount} cards`);

                        // 更新其他玩家的手牌数量（使用 -1 表示未知的牌）
                        const emptyCards = Array(handCount).fill(-1);
                        otherPlayer.setHandCards(emptyCards);

                        // 更新显示
                        playerUIManager.updatePlayerHand(otherPlayerIndex);

                        console.log(`[TheDecreeModeClient] ✓ Updated hand count for player at index ${otherPlayerIndex}`);
                    }
                }
            }
            console.log('[TheDecreeModeClient] ✓ All players hand counts updated');
        }

        // 更新牌堆显示数量
        if (data.deckSize !== undefined && this.deckPile) {
            console.log(`[TheDecreeModeClient] Updating deck pile display: ${data.deckSize} cards remaining`);
            this.deckPile.updateCardCount(data.deckSize);
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 播放主玩家发牌动画（方案C：堆叠 → 展开 → 翻牌 → 排序）
     * @param newCards 新发的牌（用于动画）
     * @param allCards 所有手牌（用于最终显示）
     */
    private async playMainPlayerDealAnimation(
        newCards: number[],
        allCards: number[],
        playerUIManager: any,
        playerUIController: any
    ): Promise<void> {
        if (!this.dealingAnimator) return;

        console.log(`[TheDecreeModeClient] Playing main player deal animation for ${newCards.length} new cards (Plan C)...`);

        // 阶段1-3：堆叠 → 展开 → 翻牌（只对新发的牌）
        const result = await this.dealingAnimator.dealToMainPlayer(
            newCards,
            () => console.log('[TheDecreeModeClient] Stack complete'),
            () => console.log('[TheDecreeModeClient] Spread complete'),
            () => console.log('[TheDecreeModeClient] Flip complete')
        );

        // 阶段4：排序动画
        if (result.cardNodes.length > 0) {
            console.log('[TheDecreeModeClient] Starting sort animation...');

            // 获取排序后的所有牌
            const sortedAllCards = PlayerHandDisplay.sortCards(allCards);
            console.log('[TheDecreeModeClient] Sorted all cards:', sortedAllCards.map(c => '0x' + c.toString(16)));

            // 获取手牌显示组件来计算目标位置
            const handDisplay = playerUIController.getHandDisplay();
            if (handDisplay) {
                // 计算新发的牌在排序后的位置
                const targetPositions = handDisplay.getSortedCardPositions(sortedAllCards);

                // 找出新发的牌在排序后数组中的位置
                const newCardPositions: { x: number; y: number }[] = [];
                const sortedNewCards: number[] = [];
                for (let i = 0; i < sortedAllCards.length; i++) {
                    if (newCards.includes(sortedAllCards[i])) {
                        // 从 newCards 中移除已匹配的牌，避免重复匹配
                        const idx = newCards.indexOf(sortedAllCards[i]);
                        if (idx !== -1) {
                            newCardPositions.push(targetPositions[i]);
                            sortedNewCards.push(sortedAllCards[i]);
                            newCards.splice(idx, 1);
                        }
                    }
                }

                // 播放排序动画
                await this.dealingAnimator.animateSorting(
                    result.cardNodes,
                    sortedNewCards,
                    newCardPositions,
                    () => console.log('[TheDecreeModeClient] Sort animation complete')
                );
            }

            // 清理动画层的卡牌
            this.dealingAnimator.clearAnimationCards();
        }

        // 更新实际的手牌显示（使用排序后的所有牌）
        const player = playerUIController.getPlayer();
        if (player) {
            const sortedAllCards = PlayerHandDisplay.sortCards(allCards);
            player.setHandCards(sortedAllCards);
        }
        playerUIManager.updatePlayerHand(0);

        // 启用卡牌选择功能
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            console.log('[TheDecreeModeClient] ✓ Card selection enabled via UI controller');
        }

        console.log('[TheDecreeModeClient] Main player deal animation complete');

        // 标记初始发牌动画完成
        this._initialDealAnimationComplete = true;

        // 检查是否有待显示的消息
        this.showPendingMessageIfReady();
    }

    /**
     * 播放主玩家补牌动画（直接飞到目标位置 → 翻牌 → 排序）
     * @param newCards 新补的牌（用于动画）
     * @param allCards 所有手牌（用于最终显示）
     * @param oldHandCards 旧手牌（补牌前的手牌，用于计算打出的牌）
     */
    private async playMainPlayerRefillAnimation(
        newCards: number[],
        allCards: number[],
        oldHandCards: number[],
        playerUIManager: any,
        playerUIController: any
    ): Promise<void> {
        if (!this.dealingAnimator) return;

        console.log(`[TheDecreeModeClient] Playing main player refill animation for ${newCards.length} new cards...`);

        // 获取手牌显示组件
        const handDisplay = playerUIController.getHandDisplay();
        if (!handDisplay) {
            console.error('[TheDecreeModeClient] HandDisplay not found');
            playerUIManager.updatePlayerHand(0);
            return;
        }

        const player = playerUIController.getPlayer();
        if (!player) {
            console.error('[TheDecreeModeClient] Player not found');
            playerUIManager.updatePlayerHand(0);
            return;
        }

        // 从显示组件获取当前显示的牌（因为 player.handCards 可能已经被更新了）
        const displayedCards = handDisplay.getDisplayedCardValues();

        // 使用显示的牌计算打出的牌（显示的牌中不在新手牌里的）
        const playedCards = displayedCards.filter((c: number) => !allCards.includes(c));
        // 剩余的牌（显示的牌中在新手牌里的）
        const remainingCards = displayedCards.filter((c: number) => allCards.includes(c));

        console.log(`[TheDecreeModeClient] Displayed cards: ${displayedCards.map((c: number) => '0x' + c.toString(16)).join(',')}`);
        console.log(`[TheDecreeModeClient] All cards (new hand): ${allCards.map(c => '0x' + c.toString(16)).join(',')}`);
        console.log(`[TheDecreeModeClient] Played cards: ${playedCards.map((c: number) => '0x' + c.toString(16)).join(',')}`);
        console.log(`[TheDecreeModeClient] Remaining: ${remainingCards.length}, New cards: ${newCards.length}`);

        // 步骤1：隐藏打出的牌（不重新布局，剩余牌保持原位置）
        const hiddenPositions = handDisplay.hideCardsWithoutRelayout(playedCards);
        console.log(`[TheDecreeModeClient] Hidden ${hiddenPositions.length} played cards, positions preserved`);

        // 步骤2：新牌飞到打出的牌的位置（空出的位置）
        const targetPositions: Vec3[] = [];
        for (let i = 0; i < newCards.length; i++) {
            if (i < hiddenPositions.length) {
                targetPositions.push(hiddenPositions[i]);
            } else {
                // 如果新牌比打出的牌多，使用最后一个位置
                targetPositions.push(hiddenPositions[hiddenPositions.length - 1]);
            }
        }

        console.log(`[TheDecreeModeClient] Target positions for new cards: ${targetPositions.length}`);

        // 步骤3：播放补牌动画（飞到空位置，然后翻牌）
        await this.dealingAnimator.refillToMainPlayer(
            newCards,
            targetPositions,
            () => console.log('[TheDecreeModeClient] Refill flight animation complete')
        );

        // 步骤4：清理动画层，然后更新手牌显示（显示所有牌，未排序）
        this.dealingAnimator.clearAnimationCards();

        const unsortedAllCards = [...remainingCards, ...newCards];
        player.setHandCards(unsortedAllCards);
        playerUIManager.updatePlayerHand(0);

        // 步骤5：播放排序动画
        const sortedAllCards = PlayerHandDisplay.sortCards(allCards);
        console.log('[TheDecreeModeClient] Playing sort animation...');

        await this.dealingAnimator.animateSortCards(
            handDisplay,
            unsortedAllCards,
            sortedAllCards
        );

        // 更新最终的手牌显示（排序后）
        player.setHandCards(sortedAllCards);
        playerUIManager.updatePlayerHand(0);

        // 启用卡牌选择功能
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            console.log('[TheDecreeModeClient] ✓ Card selection enabled via UI controller');
        }

        console.log('[TheDecreeModeClient] Main player refill animation complete');
    }

    /**
     * 处理待发的玩家牌（公共牌发完后调用）
     */
    private processPendingPlayerDeals(): void {
        if (this._pendingPlayerDeals.length === 0) {
            console.log('[TheDecreeModeClient] No pending player deals to process');
            return;
        }

        console.log(`[TheDecreeModeClient] Processing ${this._pendingPlayerDeals.length} pending player deals...`);

        // 依次处理所有待发的玩家牌
        for (const pending of this._pendingPlayerDeals) {
            this.processPlayerDeal(pending.data);
        }

        // 清空队列
        this._pendingPlayerDeals = [];
        console.log('[TheDecreeModeClient] All pending player deals processed');
    }

    private onCommunityCards(data: CommunityCardsEvent): void {
        console.log('[TheDecreeModeClient] ========== Community Cards Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received community_cards event from server');
        console.log('[TheDecreeModeClient] Cards:', data.cards);
        console.log('[TheDecreeModeClient] Card count:', data.cards.length);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);
        console.log('[TheDecreeModeClient] Raw event data:', JSON.stringify(data));

        this.communityCards = data.cards;
        this.gameState = data.gameState as TheDecreeGameState;

        // 清空之前的公共牌显示
        if (this.communityCardsNode) {
            this.communityCardsNode.removeAllChildren();
        }

        // 使用发牌动画显示公共牌（如果可用）
        if (this.dealingAnimator && this.deckPile) {
            console.log('[TheDecreeModeClient] Playing community cards deal animation (all face-down, then flip)...');
            this.deckPile.show();

            // 使用新的点对点发牌动画
            this.dealingAnimator.dealCommunityCards(
                data.cards,
                // 每张牌发完后的回调 - 显示背面卡牌
                (index: number, cardValue: number) => {
                    console.log(`[TheDecreeModeClient] Community card ${index + 1} dealt (face-down): 0x${cardValue.toString(16)}`);
                    this.displaySingleCommunityCard(index, cardValue, false); // 显示背面
                },
                // 全部发完后的回调 - 一起翻牌，然后处理待发的玩家牌
                () => {
                    console.log('[TheDecreeModeClient] All community cards dealt, flipping together...');
                    this.flipAllCommunityCards();

                    // 标记公共牌已发完
                    this._communityCardsDealt = true;

                    // 处理待发的玩家牌
                    this.processPendingPlayerDeals();
                }
            );
        } else {
            // 无动画，直接显示
            console.log('[TheDecreeModeClient] Calling displayCommunityCards() (no animation)...');
            this.displayCommunityCards();
            console.log('[TheDecreeModeClient] ✓ Community cards displayed');

            // 标记公共牌已发完
            this._communityCardsDealt = true;

            // 处理待发的玩家牌
            this.processPendingPlayerDeals();
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onRequestFirstDealerSelection(data: RequestFirstDealerSelectionEvent): void {
        console.log('[TheDecreeModeClient] ========== Request First Dealer Selection Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received request_first_dealer_selection event');
        console.log('[TheDecreeModeClient] Game state:', data.gameState);
        console.log('[TheDecreeModeClient] 💡 提示：请选择一张手牌，牌最大的成为首个庄家');

        // 设置游戏状态为首庄选择阶段
        this.gameState = data.gameState as TheDecreeGameState;

        // 缓存消息，等发牌动画完成后再显示
        this._pendingMessage = { message: '请选择一张手牌，牌最大的成为首个庄家', duration: 3.0 };
        this.showPendingMessageIfReady();

        // 启用卡牌选择（只能选一张）
        // 选择后需要点击"出牌"按钮确认
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            console.log('[TheDecreeModeClient] ✓ Card selection enabled for first dealer selection');
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 检查并显示待显示的消息（如果发牌动画已完成）
     */
    private showPendingMessageIfReady(): void {
        if (this._initialDealAnimationComplete && this._pendingMessage) {
            if (this.theDecreeUIController) {
                this.theDecreeUIController.showMessage(this._pendingMessage.message, this._pendingMessage.duration);
            }
            this._pendingMessage = null;
        }
    }

    private onPlayerSelectedCard(data: PlayerSelectedCardEvent): void {
        console.log('[TheDecreeModeClient] ========== Player Selected Card Event ==========');
        console.log('[TheDecreeModeClient] 📩 Player selected a card:', data.playerId);

        // 显示其他玩家已经选择的状态
        const playerName = this.getPlayerName(data.playerId);
        console.log(`[TheDecreeModeClient] 👤 ${playerName} 已选择`);

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onFirstDealerReveal(data: FirstDealerRevealEvent): void {
        console.log('[TheDecreeModeClient] ========== First Dealer Reveal Event ==========');
        console.log('[TheDecreeModeClient] 📩 Revealing first dealer selection');
        console.log('[TheDecreeModeClient] Dealer ID:', data.dealerId);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);
        console.log('[TheDecreeModeClient] All selections:', data.selections);

        // 构建显示信息
        console.log('[TheDecreeModeClient] 🎴 所有玩家的选择：');

        for (const selection of data.selections) {
            const playerName = this.getPlayerName(selection.playerId);
            const cardName = this.getCardName(selection.card);
            const isDealer = selection.playerId === data.dealerId;

            console.log(`[TheDecreeModeClient]   ${isDealer ? '👑' : '  '} ${playerName}: ${cardName}`);
        }

        // 找到dealer的名字
        const dealerName = this.getPlayerName(data.dealerId);
        console.log(`[TheDecreeModeClient] 🎉 ${dealerName} 成为首个庄家！`);

        // 显示消息提示
        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage(`${dealerName} 成为首个庄家！`, 2.5);
        }

        // 存储dealer ID
        this.dealerId = data.dealerId;
        this.currentRoundNumber = 1;

        // 设置游戏状态
        this.gameState = data.gameState as TheDecreeGameState;

        // === 在UI上显示所有玩家选择的牌 ===
        this.displayFirstDealerSelections(data.selections, data.dealerId);

        // 延迟后清除选择状态和显示的牌，准备游戏
        setTimeout(() => {
            const playerUIManager = this.game.playerUIManager;
            if (playerUIManager) {
                // 清除手牌的选中状态
                playerUIManager.clearSelection(0);

                // 隐藏显示的选牌
                this.hideFirstDealerSelections();
            }

            // 3秒后，如果当前玩家是庄家，显示 dealer call 按钮
            const localRoomStore = LocalRoomStore.getInstance();
            const currentPlayerId = localRoomStore.getMyPlayerId();

            if (currentPlayerId === data.dealerId) {
                console.log('[TheDecreeModeClient] 3 seconds passed, showing dealer call buttons...');
                if (this.theDecreeUIController) {
                    this.theDecreeUIController.updateCallButtonsVisibility();
                    console.log('[TheDecreeModeClient] ✓ Dealer call buttons shown');
                }
            }
        }, 3000);

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 在UI上显示所有玩家选择的首庄牌
     * 使用每个玩家自己手牌区域的出牌显示效果
     */
    private displayFirstDealerSelections(selections: { playerId: string; card: number }[], dealerId: string): void {
        console.log('[TheDecreeModeClient] Displaying first dealer selections in each player\'s hand area');

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.warn('[TheDecreeModeClient] PlayerUIManager not found');
            return;
        }

        // 为每个玩家显示他们选择的牌（使用出牌显示效果）
        for (const selection of selections) {
            const playerIndex = this.getPlayerIndex(selection.playerId);
            if (playerIndex === -1) {
                console.warn(`[TheDecreeModeClient] Player ${selection.playerId} not found in mapping`);
                continue;
            }

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) {
                console.warn(`[TheDecreeModeClient] PlayerUINode not found for index ${playerIndex}`);
                continue;
            }

            const handDisplay = playerUINode.getHandDisplay();
            if (!handDisplay) {
                console.warn(`[TheDecreeModeClient] HandDisplay not found for index ${playerIndex}`);
                continue;
            }

            // 对于主玩家（index 0），不需要重新创建卡牌，因为已经显示了高亮状态
            // 只需要为其他玩家更新显示（显示他们选择的牌）
            if (playerIndex === 0) {
                console.log(`[TheDecreeModeClient] Skipping updateDisplay for main player (index 0) - card already displayed with highlight`);
            } else {
                // 使用出牌的显示效果：传入选择的牌作为 playedCards
                // 这样会在玩家手牌区域显示"已出的牌"效果
                handDisplay.updateDisplay([selection.card]);
            }

            const playerName = this.getPlayerName(selection.playerId);
            const isDealer = selection.playerId === dealerId;
            console.log(`[TheDecreeModeClient] Displayed selection for ${playerName}: ${this.getCardName(selection.card)}${isDealer ? ' (Dealer 👑)' : ''}`);
        }

        console.log('[TheDecreeModeClient] ✓ All selections displayed in hand areas');
    }

    /**
     * 隐藏首庄选牌显示（重新更新手牌显示，不带出牌效果）
     */
    private hideFirstDealerSelections(): void {
        console.log('[TheDecreeModeClient] Hiding first dealer selections');

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            return;
        }

        // 为所有玩家重新更新手牌显示，移除出牌效果
        const playerCount = playerUIManager.getPlayerCount();
        for (let i = 0; i < playerCount; i++) {
            const playerUINode = playerUIManager.getPlayerUINode(i);
            if (playerUINode) {
                const handDisplay = playerUINode.getHandDisplay();
                if (handDisplay) {
                    // 重新显示手牌，不带出牌效果（传入空数组）
                    handDisplay.updateDisplay([]);
                }
            }
        }

        // ⚠️ 重要：重新启用主玩家的卡牌选择功能
        // 因为在首庄选择时手动禁用了触摸事件，需要重新启用以便后续游戏阶段可以选牌
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            console.log('[TheDecreeModeClient] ✓ Card selection re-enabled for main player');
        }

        console.log('[TheDecreeModeClient] First dealer selections hidden');
    }

    /**
     * 根据playerId获取玩家名字
     */
    private getPlayerName(playerId: string): string {
        const room = LocalRoomStore.getInstance().getCurrentRoom();
        if (room) {
            const playerInfo = room.players.find(p => p.id === playerId);
            if (playerInfo) {
                return playerInfo.name;
            }
        }
        return 'Unknown';
    }

    /**
     * 根据卡牌编码获取卡牌名称（用于显示）
     */
    private getCardName(card: number): string {
        const suits = ['♠', '♥', '♣', '♦'];
        const points = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        const suit = (card & 0xF0) >> 4;
        const point = card & 0x0F;

        if (suit >= 0 && suit < 4 && point >= 1 && point <= 13) {
            return suits[suit] + points[point];
        }

        return '未知牌';
    }

    /**
     * 初始化所有玩家的手牌（给没有手牌数据的玩家设置默认数量）
     * 用于显示其他玩家的手牌背面
     */
    private initializeAllPlayersHands(): void {
        console.log('[TheDecreeModeClient] Initializing all players hands...');

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found!');
            return;
        }

        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            console.error('[TheDecreeModeClient] No current room found!');
            return;
        }

        // 给每个玩家设置初始手牌（如果还没有的话）
        for (let i = 0; i < currentRoom.players.length; i++) {
            const playerInfo = currentRoom.players[i];
            const playerUIController = playerUIManager.getPlayerUINode(i);

            if (playerUIController) {
                const player = playerUIController.getPlayer();
                if (player && player.handCards.length === 0) {
                    // 这个玩家还没有手牌数据，给他设置默认的5张空牌（用于显示背面）
                    console.log(`[TheDecreeModeClient] Initializing ${this.config.initialHandSize} cards for player ${i} (${playerInfo.name})`);
                    const emptyCards = Array(this.config.initialHandSize).fill(-1); // -1 表示未知的牌（显示背面）
                    player.setHandCards(emptyCards);
                    playerUIManager.updatePlayerHand(i);
                }
            }
        }

        console.log('[TheDecreeModeClient] ✓ All players hands initialized');
    }

    private onDealerSelected(data: DealerSelectedEvent): void {
        console.log('[TheDecreeModeClient] ========== Dealer Selected Event ==========');
        console.log('[TheDecreeModeClient] Dealer selected:', data);
        console.log('[TheDecreeModeClient] Dealer ID:', data.dealerId);
        console.log('[TheDecreeModeClient] Round number:', data.roundNumber);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);

        this.dealerId = data.dealerId;
        this.currentRoundNumber = data.roundNumber;
        this.gameState = data.gameState as TheDecreeGameState;

        // 重置 cardsToPlay 为 0，防止玩家在新回合 dealer call 之前使用上一回合的数值出牌
        this.cardsToPlay = 0;
        console.log('[TheDecreeModeClient] Reset cardsToPlay to 0 for new round');

        // 更新 UI 状态，禁用出牌按钮
        if (this.theDecreeUIController) {
            this.theDecreeUIController.updateUIState();
            console.log('[TheDecreeModeClient] UI state updated - play button should be disabled');
        }

        // 显示庄家指示器（使用基类的 getPlayerIndex）
        const dealerIndex = this.getPlayerIndex(data.dealerId);
        if (dealerIndex !== -1 && this.game.playerUIManager) {
            this.game.playerUIManager.showDealer(dealerIndex);
            console.log(`[TheDecreeModeClient] Round ${this.currentRoundNumber}, dealer: ${this.dealerId} (index: ${dealerIndex})`);
        }

        // 如果是第一回合（首庄选择），不立即显示 call 按钮
        // call 按钮会在 onFirstDealerReveal 的 3 秒延迟后显示
        if (data.roundNumber === 1) {
            console.log('[TheDecreeModeClient] First round - dealer call buttons will be shown after first dealer reveal (3s delay)');
            console.log('[TheDecreeModeClient] =====================================');
            return;
        }

        // 后续回合：如果本地玩家是庄家，立即显示叫牌按钮
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        console.log('[TheDecreeModeClient] Current player ID:', currentPlayerId);
        console.log('[TheDecreeModeClient] Is current player dealer?', currentPlayerId === data.dealerId);

        if (currentPlayerId === data.dealerId) {
            console.log('[TheDecreeModeClient] Current player is dealer, showing call buttons...');
            if (this.theDecreeUIController) {
                this.theDecreeUIController.updateCallButtonsVisibility();
                console.log('[TheDecreeModeClient] ✓ Call buttons visibility updated');
            } else {
                console.error('[TheDecreeModeClient] ✗ TheDecreeUIController not found, cannot show call buttons');
            }
        } else {
            console.log('[TheDecreeModeClient] Current player is NOT dealer, hiding call buttons');
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onDealerCalled(data: DealerCalledEvent): void {
        console.log('[TheDecreeModeClient] ========== Dealer Called Event ==========');
        console.log('[TheDecreeModeClient] Dealer ID:', data.dealerId);
        console.log('[TheDecreeModeClient] Cards to play:', data.cardsToPlay);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);

        this.cardsToPlay = data.cardsToPlay;
        this.gameState = data.gameState as TheDecreeGameState;

        // 清除上一回合的摊牌显示
        this.clearShowdownDisplay();

        // 获取当前玩家ID
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();
        console.log('[TheDecreeModeClient] Current player ID:', currentPlayerId);

        const isDealer = currentPlayerId === data.dealerId;
        console.log('[TheDecreeModeClient] Is current player the dealer?', isDealer);

        // 显示消息提示
        const dealerName = this.getPlayerName(data.dealerId);
        const message = isDealer
            ? `你叫了 ${data.cardsToPlay} 张牌`
            : `庄家 ${dealerName} 叫了 ${data.cardsToPlay} 张牌`;

        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage(message, 2.5);
            console.log(`[TheDecreeModeClient] Showing message: "${message}"`);
        }

        // 卡牌选择功能已经在 onDealCards 时启用了
        // 这里只需要更新 UI 状态（启用出牌按钮等）
        console.log(`[TheDecreeModeClient] Dealer called ${data.cardsToPlay} cards, updating UI state...`);

        if (this.theDecreeUIController) {
            // 如果是非dealer玩家，隐藏call按钮（因为dealer已经叫牌了）
            if (!isDealer) {
                console.log('[TheDecreeModeClient] Non-dealer: hiding call buttons');
                this.theDecreeUIController.updateCallButtonsVisibility();
            }

            // 更新 UI 状态（这会根据选牌数量启用/禁用出牌按钮）
            this.theDecreeUIController.updateUIState();
            console.log('[TheDecreeModeClient] ✓ UI state updated');
        } else {
            console.warn('[TheDecreeModeClient] TheDecreeUIController not found');
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onPlayerPlayed(data: PlayerPlayedEvent): void {
        console.log('[TheDecreeModeClient] Player played:', data);

        // 获取玩家名字
        const playerName = this.getPlayerName(data.playerId);

        // 获取当前玩家ID
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        // 如果不是自己出牌，显示提示
        if (data.playerId !== currentPlayerId) {
            if (this.theDecreeUIController) {
                this.theDecreeUIController.showMessage(`${playerName} 已出牌`, 1.5);
            }
        }

        // 更新 UI 显示其他玩家已出牌（不显示具体牌面）
        // TODO: 更新玩家状态指示
    }

    private onShowdown(data: ShowdownEvent): void {
        console.log('[TheDecreeModeClient] ========== Showdown Event ==========');
        console.log('[TheDecreeModeClient] Showdown results:', data);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);

        // 标记摊牌动画开始
        this._isShowdownInProgress = true;
        console.log('[TheDecreeModeClient] Showdown animation started');

        // 设置游戏状态
        this.gameState = data.gameState as TheDecreeGameState;

        // 显示所有玩家的牌型和结果（日志）
        for (const result of data.results) {
            console.log(`[TheDecreeModeClient] Player ${result.playerId}: ${result.handTypeName} (${result.score} points)${result.isWinner ? ' WINNER!' : ''}`);
            console.log(`[TheDecreeModeClient]   Cards:`, result.cards);
            console.log(`[TheDecreeModeClient]   Hand Type:`, result.handType, '-', result.handTypeName);
        }

        // 更新所有玩家的手牌显示，显示他们出的牌
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found');
            return;
        }

        console.log('[TheDecreeModeClient] Updating showdown display for all players');

        // 先更新所有玩家的手牌显示（立即显示出的牌）
        for (const result of data.results) {
            console.log(`[TheDecreeModeClient] Processing result for player ${result.playerId}`);
            console.log(`[TheDecreeModeClient]   Cards (hex):`, result.cards.map(c => '0x' + c.toString(16)));

            // 使用 getPlayerIndex 获取相对索引（重要！）
            const playerIndex = this.getPlayerIndex(result.playerId);
            if (playerIndex === -1) {
                console.warn(`[TheDecreeModeClient] Player ${result.playerId} not found in player mapping`);
                continue;
            }

            console.log(`[TheDecreeModeClient] Showing cards for player ${result.playerId} at relative index ${playerIndex}`);

            // 获取玩家的 UI 控制器（使用相对索引）
            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) {
                console.warn(`[TheDecreeModeClient] PlayerUINode not found for index ${playerIndex}`);
                continue;
            }

            // 获取玩家的 HandDisplay
            const handDisplay = playerUINode.getHandDisplay();
            if (!handDisplay) {
                console.warn(`[TheDecreeModeClient] HandDisplay not found for index ${playerIndex}`);
                continue;
            }

            // 检查是否是自己
            const myId = LocalGameStore.getInstance().getMyPlayerId();
            const isMe = result.playerId === myId;

            if (isMe) {
                // 自己的牌：检查是否托管
                const isAuto = LocalGameStore.getInstance().isPlayerAuto(myId);

                if (isAuto) {
                    // 托管出牌：需要显示出的牌（因为之前没有高亮）
                    console.log(`[TheDecreeModeClient] Showing my auto-played cards:`, result.cards);

                    // 1. 先找到这些牌在手牌中的索引
                    const player = playerUINode.getPlayer();
                    const handCards = player ? player.handCards : [];
                    const indicesToSelect: number[] = [];

                    for (const playedCard of result.cards) {
                        const index = handCards.indexOf(playedCard);
                        if (index !== -1) {
                            indicesToSelect.push(index);
                        }
                    }

                    console.log(`[TheDecreeModeClient] Auto-played card indices:`, indicesToSelect);

                    // 2. 选中这些牌
                    if (indicesToSelect.length > 0) {
                        handDisplay.selectCards(indicesToSelect);
                    }

                    // 3. 高亮显示自己出的牌（锁定未选中的牌）
                    playerUIManager.lockUnselectedCards(0);
                } else {
                    // 手动出牌：牌已经高亮显示了，不需要更新
                    console.log(`[TheDecreeModeClient] Skipping updateDisplay for my manual play - cards already highlighted`);
                }
            } else {
                // 其他玩家的牌：显示正面
                handDisplay.updateDisplay(result.cards);
                console.log(`[TheDecreeModeClient] ✓ Updated cards display for player at relative index ${playerIndex}, cards:`, result.cards);
            }
        }

        // 从所有玩家手牌中移除已出的牌（重要：这样补牌时才能正确计算 dealCount）
        // 这一步在所有玩家展示完牌之后进行
        console.log('[TheDecreeModeClient] Removing played cards from all players...');
        for (const result of data.results) {
            const playerIndex = this.getPlayerIndex(result.playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (!playerUINode) continue;

            const player = playerUINode.getPlayer();
            if (player) {
                const oldHandCount = player.handCards.length;
                const remainingCards = player.handCards.filter(card => !result.cards.includes(card));
                player.setHandCards(remainingCards);
                console.log(`[TheDecreeModeClient] Removed played cards from player ${result.playerId}: ${oldHandCount} -> ${remainingCards.length}`);
            }
        }

        // 清除之前的定时器
        this.clearShowdownTimer();

        // 按牌型强度排序（从弱到强）
        const sortedResults = [...data.results].sort((a, b) => a.handType - b.handType);
        console.log('[TheDecreeModeClient] Sorted results (weak to strong):', sortedResults.map(r => `${r.playerId}: ${r.handTypeName}`));

        // 依次展示每个玩家的牌型
        this.showHandTypesSequentially(sortedResults, 0);

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 依次展示玩家牌型（从弱到强）
     * @param sortedResults 按牌型强度排序的结果数组
     * @param index 当前展示的索引
     */
    private showHandTypesSequentially(sortedResults: ShowdownResult[], index: number): void {
        if (index >= sortedResults.length) {
            // 所有牌型展示完毕，显示赢家消息
            console.log('[TheDecreeModeClient] All hand types displayed, showing winner message');
            this.showWinnerMessageAndCleanup(sortedResults);
            return;
        }

        const result = sortedResults[index];
        const playerIndex = this.getPlayerIndex(result.playerId);

        if (playerIndex === -1) {
            // 跳过找不到的玩家，继续下一个
            this.showHandTypesSequentially(sortedResults, index + 1);
            return;
        }

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            return;
        }

        // 构建牌型显示文本
        const scoreText = result.isWinner
            ? `${result.handTypeName} +${result.score}+1`
            : `${result.handTypeName} +${result.score}`;

        // 赢家使用金色，其他玩家使用默认颜色
        const color = result.isWinner ? this.WINNER_COLOR : this.getHandTypeColor(result.handType);

        // 显示牌型
        playerUIManager.updatePlayerHandType(playerIndex, scoreText, color);
        console.log(`[TheDecreeModeClient] Displayed hand type for player ${result.playerId} at index ${playerIndex}: ${scoreText}`);

        // 延迟展示下一个玩家
        this.showdownClearTimer = window.setTimeout(() => {
            this.showHandTypesSequentially(sortedResults, index + 1);
        }, this.SHOWDOWN_INTERVAL_MS);
    }

    /**
     * 显示赢家消息并在消息结束后清理
     */
    private showWinnerMessageAndCleanup(sortedResults: ShowdownResult[]): void {
        // 找到赢家
        const winner = sortedResults.find(r => r.isWinner);
        if (!winner) {
            console.warn('[TheDecreeModeClient] No winner found in results');
            this.clearShowdownDisplay();
            return;
        }

        // 获取赢家名称
        const winnerName = this.getPlayerName(winner.playerId);

        // 显示赢家消息
        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage(`${winnerName} 获胜！`, this.WINNER_MESSAGE_DURATION);
        }

        // 在消息显示完毕后清除所有牌型显示
        this.showdownClearTimer = window.setTimeout(() => {
            console.log('[TheDecreeModeClient] Winner message finished, clearing showdown display');
            this.clearShowdownDisplay();
        }, this.WINNER_MESSAGE_DURATION * 1000);
    }

    /**
     * 根据牌型强度获取显示颜色
     * @param handType 牌型枚举值
     * @returns 颜色字符串
     */
    private getHandTypeColor(handType: number): string {
        // 0-2: 普通（白色）, 3-5: 较好（绿色）, 6-7: 很好（蓝色）, 8-9: 极好（金色）
        if (handType >= 8) return '#FFD700';  // 金色 - 同花顺/皇家同花顺
        if (handType >= 6) return '#4169E1';  // 蓝色 - 葫芦/四条
        if (handType >= 3) return '#32CD32';  // 绿色 - 三条/顺子/同花
        return '#FFFFFF';  // 白色 - 高牌/一对/两对
    }

    private onRoundEnd(data: RoundEndEvent): void {
        console.log('[TheDecreeModeClient] ========== Round End Event ==========');
        console.log('[TheDecreeModeClient] Winner ID:', data.winnerId);
        console.log('[TheDecreeModeClient] Loser ID:', data.loserId);
        console.log('[TheDecreeModeClient] Scores:', data.scores);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);

        // 设置游戏状态
        this.gameState = data.gameState as TheDecreeGameState;

        // 重置 cardsToPlay 为 0，准备下一回合
        this.cardsToPlay = 0;
        console.log('[TheDecreeModeClient] Reset cardsToPlay to 0 at round end');

        // 注意：赢家消息已经在 showWinnerMessageAndCleanup 中显示了
        // 这里只更新分数，不再重复显示消息

        // 更新所有玩家的分数显示
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found, cannot update scores');
            return;
        }

        // 获取房间信息，从中获取玩家列表
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();

        if (!currentRoom || !currentRoom.players) {
            console.error('[TheDecreeModeClient] No room data or players found');
            return;
        }

        const players = currentRoom.players;
        console.log('[TheDecreeModeClient] Updating scores for players:', players.length);

        // 获取本地玩家的座位索引
        const mySeatIndex = localRoomStore.getMyPlayerId();
        const myPlayer = players.find(p => p.id === mySeatIndex);
        const myAbsoluteSeat = myPlayer ? myPlayer.seatIndex : 0;
        const totalSeats = players.length;

        console.log(`[TheDecreeModeClient] My absolute seat: ${myAbsoluteSeat}, total seats: ${totalSeats}`);

        // 遍历所有分数，更新对应玩家的 UI
        for (const player of players) {
            const score = data.scores[player.id];
            if (score !== undefined) {
                console.log(`[TheDecreeModeClient] Updating score for player ${player.id} (${player.name}): ${score}`);

                // 将绝对座位索引转换为相对座位索引
                const relativeSeat = playerUIManager.getRelativeSeatIndex(player.seatIndex, myAbsoluteSeat, totalSeats);
                console.log(`[TheDecreeModeClient] Player ${player.name} absolute seat: ${player.seatIndex}, relative seat: ${relativeSeat}`);

                // 根据相对座位索引获取 PlayerUIController
                const playerUINode = playerUIManager.getPlayerUINode(relativeSeat);
                if (playerUINode) {
                    playerUINode.updateScore(score);
                    console.log(`[TheDecreeModeClient] ✓ Score updated for player at relative seat ${relativeSeat}`);
                } else {
                    console.warn(`[TheDecreeModeClient] PlayerUINode not found for relative seat ${relativeSeat}`);
                }
            } else {
                console.warn(`[TheDecreeModeClient] No score found for player ${player.id}`);
            }
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onGameOver(data: GameOverEvent): void {
        console.log('[TheDecreeModeClient] ========== Game Over Event ==========');
        console.log('[TheDecreeModeClient] Game over:', data);
        console.log('[TheDecreeModeClient] Winner ID:', data.winnerId);
        console.log('[TheDecreeModeClient] Total rounds:', data.totalRounds);
        console.log('[TheDecreeModeClient] Game state:', data.gameState);
        console.log(`[TheDecreeModeClient] Winner: ${data.winnerId} with ${data.scores[data.winnerId]} points`);

        // 设置游戏状态
        this.gameState = data.gameState as TheDecreeGameState;

        // 检查摊牌动画是否正在进行
        if (this._isShowdownInProgress) {
            console.log('[TheDecreeModeClient] Showdown animation in progress, deferring GameOver processing');
            this._pendingGameOver = data;
            return;
        }

        // 直接处理 GameOver
        this.processGameOver(data);

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 处理游戏结束事件
     */
    private processGameOver(data: GameOverEvent): void {
        console.log('[TheDecreeModeClient] Processing GameOver event');

        // 准备游戏结果数据
        const gameResult = this.prepareGameResult(data);

        // 通过 StageManager 获取 PlayingStage 并通知游戏结束
        const stageManager = this.game.stageManager;
        if (stageManager) {
            const playingStage = stageManager.getCurrentStage();
            if (playingStage && typeof (playingStage as any).onGameFinished === 'function') {
                console.log('[TheDecreeModeClient] Notifying PlayingStage that game is finished');
                (playingStage as any).onGameFinished(gameResult);
            } else {
                console.error('[TheDecreeModeClient] PlayingStage not found or onGameFinished method missing!');
            }
        } else {
            console.error('[TheDecreeModeClient] StageManager not found! Cannot switch to EndStage');
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    /**
     * 准备游戏结果数据（用于 EndStage 显示）
     */
    private prepareGameResult(data: GameOverEvent): any {
        // 获取所有玩家信息
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();

        if (!currentRoom || !currentRoom.players) {
            console.error('[TheDecreeModeClient] No room data or players found');
            return {
                rankings: [],
                winnerId: data.winnerId,
                totalRounds: data.totalRounds
            };
        }

        const players = currentRoom.players;

        // 构建排名数组（按分数降序排序）
        const rankings = players.map(player => ({
            name: player.name,
            score: data.scores[player.id] || 0,
            isWinner: player.id === data.winnerId
        })).sort((a, b) => b.score - a.score);

        console.log('[TheDecreeModeClient] Game result prepared:', rankings);

        return {
            rankings: rankings,
            winnerId: data.winnerId,
            totalRounds: data.totalRounds
        };
    }

    // ==================== UI 辅助方法 ====================

    /**
     * 升级 PlayerUIManager 到游戏模式
     * 将 ReadyStage 的 InfoPanel (ROOM 模式) 升级为 PlayingStage 的完整游戏 UI (GAME 模式)
     */
    private upgradePlayerUIToPlayingMode(): void {
        console.log('[TheDecreeModeClient] Upgrading PlayerUIManager to Playing mode...');

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found!');
            return;
        }

        // 从 LocalRoomStore 获取玩家信息
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            console.error('[TheDecreeModeClient] No current room found!');
            return;
        }

        // 获取当前玩家的 ID 和 seatIndex
        const myPlayerId = localRoomStore.getMyPlayerId();
        const myPlayerInfo = currentRoom.players.find(p => p.id === myPlayerId);
        const mySeatIndex = myPlayerInfo?.seatIndex ?? 0;

        // 检查 PlayerUIManager 是否已初始化（重连场景可能跳过了 ReadyStage）
        // @ts-ignore - accessing private property
        if (playerUIManager._maxSeats === 0) {
            console.log('[TheDecreeModeClient] PlayerUIManager not initialized, calling initForReadyStage first...');
            const layoutConfig = SeatLayoutConfig.getLayout(currentRoom.maxPlayers);
            playerUIManager.initForReadyStage(
                currentRoom.players,
                currentRoom.maxPlayers,
                mySeatIndex,
                layoutConfig
            );
            console.log('[TheDecreeModeClient] PlayerUIManager initialized for reconnect scenario');
        }

        // 设置玩家 ID 映射（关键！）
        console.log('[TheDecreeModeClient] Setting up player ID mapping...');
        console.log('[TheDecreeModeClient] Room players:', currentRoom.players.map(p => ({
            id: p.id,
            name: p.name,
            seatIndex: p.seatIndex
        })));

        console.log('[TheDecreeModeClient] My player ID:', myPlayerId);
        console.log('[TheDecreeModeClient] My seat index:', mySeatIndex);

        // 重新映射玩家位置：让当前玩家总是显示在 index 0（底部）
        // 其他玩家按顺序显示在其他位置
        const totalSeats = currentRoom.maxPlayers;
        const remappedPlayers = [];
        for (let i = 0; i < totalSeats; i++) {
            const actualSeatIndex = (mySeatIndex + i) % totalSeats;
            const playerInfo = currentRoom.players.find(p => p.seatIndex === actualSeatIndex);
            if (playerInfo) {
                remappedPlayers.push({
                    ...playerInfo,
                    displayIndex: i // 新的显示位置
                });
            }
        }

        console.log('[TheDecreeModeClient] Remapped players:', remappedPlayers.map(p => ({
            id: p.id,
            name: p.name,
            seatIndex: p.seatIndex,
            displayIndex: p.displayIndex
        })));

        // 设置映射：playerId -> displayIndex
        this.playerIdToIndexMap.clear();
        for (const player of remappedPlayers) {
            this.playerIdToIndexMap.set(player.id, player.displayIndex);
        }

        console.log('[TheDecreeModeClient] Player ID mapping:', Array.from(this.playerIdToIndexMap.entries()));

        // 将 PlayerInfo 转换为 Player 对象（使用重新映射后的顺序）
        const players = remappedPlayers.map(playerInfo => new Player(playerInfo));

        // 获取 poker 资源（从 Game 获取）
        // @ts-ignore - accessing private property
        const pokerSprites = this.game['_pokerSprites'];
        // @ts-ignore - accessing private property
        const pokerPrefab = this.game['_pokerPrefab'];
        // @ts-ignore - accessing private property
        const glowMaterial = this.game['_glowMaterial'];

        if (!pokerSprites || !pokerPrefab) {
            console.error('[TheDecreeModeClient] Poker resources not loaded!');
            return;
        }

        // 调用 upgradeToPlayingMode
        playerUIManager.upgradeToPlayingMode(
            players,
            pokerSprites,
            pokerPrefab,
            0, // levelRank
            false, // TheDecree 不启用分组堆叠
            glowMaterial // 边缘光材质
        );

        console.log('[TheDecreeModeClient] PlayerUIManager upgraded to Playing mode');
    }

    /**
     * 显示公共牌
     */
    private displayCommunityCards(): void {
        console.log('[TheDecreeModeClient] Displaying community cards:', this.communityCards);

        if (!this.communityCardsNode) {
            console.warn('[TheDecreeModeClient] CommunityCardsNode not found, cannot display cards');
            return;
        }

        if (this.communityCards.length === 0) {
            console.warn('[TheDecreeModeClient] No community cards to display');
            return;
        }

        // 清空之前的公共牌
        this.communityCardsNode.removeAllChildren();

        // 显示所有公共牌
        for (let i = 0; i < this.communityCards.length; i++) {
            this.displaySingleCommunityCard(i, this.communityCards[i]);
        }

        console.log(`[TheDecreeModeClient] Displayed ${this.communityCards.length} community cards`);
    }

    /**
     * 显示单张公共牌（用于动画回调）
     * @param index 公共牌索引（0-3）
     * @param cardValue 牌值
     * @param showFront 是否显示正面（默认true）
     */
    private displaySingleCommunityCard(index: number, cardValue: number, showFront: boolean = true): void {
        if (!this.communityCardsNode) {
            console.warn('[TheDecreeModeClient] CommunityCardsNode not found');
            return;
        }

        // 获取 PokerFactory 实例
        const pokerFactory = PokerFactory.instance;
        if (!pokerFactory) {
            console.error('[TheDecreeModeClient] PokerFactory instance not found!');
            return;
        }

        // 获取扑克牌资源
        const pokerSprites = pokerFactory['_pokerSprites'];
        const pokerPrefab = pokerFactory['_pokerPrefab'];
        const pokerBack = pokerSprites.get("CardBack3");

        if (!pokerPrefab) {
            console.error('[TheDecreeModeClient] Poker prefab not found!');
            return;
        }

        // 计算位置
        const cardSpacing = 120; // 牌之间的间距
        const totalCards = this.communityCards.length || 4;
        const startX = -(cardSpacing * (totalCards - 1)) / 2; // 居中显示

        // 创建扑克牌节点
        const pokerNode = instantiate(pokerPrefab);
        const pokerCtrl = pokerNode.addComponent(Poker);

        // 获取牌面图片
        const spriteName = PokerFactory.getCardSpriteName(cardValue);
        const pokerFront = pokerSprites.get(spriteName);

        if (pokerFront && pokerBack) {
            pokerCtrl.init(cardValue, pokerBack, pokerFront);
            if (showFront) {
                pokerCtrl.showFront();
            } else {
                pokerCtrl.showBack();
            }
        } else {
            console.warn(`[TheDecreeModeClient] Sprite not found: ${spriteName}`);
        }

        // 设置位置
        pokerNode.setPosition(startX + index * cardSpacing, 0, 0);

        // 添加到公共牌节点
        this.communityCardsNode.addChild(pokerNode);

        console.log(`[TheDecreeModeClient] Created community card ${index + 1}: ${spriteName} (${showFront ? 'front' : 'back'})`);
    }

    /**
     * 翻转所有公共牌（播放翻牌动画）
     */
    private flipAllCommunityCards(): void {
        if (!this.communityCardsNode) {
            console.warn('[TheDecreeModeClient] CommunityCardsNode not found');
            return;
        }

        const children = this.communityCardsNode.children;
        console.log(`[TheDecreeModeClient] Flipping ${children.length} community cards`);

        for (let i = 0; i < children.length; i++) {
            const pokerCtrl = children[i].getComponent(Poker);
            if (pokerCtrl) {
                // 使用延迟让翻牌有层次感
                const delay = i * 0.08;
                setTimeout(() => {
                    pokerCtrl.flip();
                }, delay * 1000);
            }
        }
    }

    /**
     * 清除摊牌显示定时器
     */
    private clearShowdownTimer(): void {
        if (this.showdownClearTimer !== null) {
            window.clearTimeout(this.showdownClearTimer);
            this.showdownClearTimer = null;
            console.log('[TheDecreeModeClient] Showdown clear timer cancelled');
        }
    }

    /**
     * 清除摊牌显示
     * 将所有玩家的出牌显示恢复为手牌背面，并清除牌型显示
     */
    private clearShowdownDisplay(): void {
        console.log('[TheDecreeModeClient] Clearing showdown display...');

        // 清除定时器
        this.clearShowdownTimer();

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.warn('[TheDecreeModeClient] PlayerUIManager not found');
            this.onShowdownAnimationComplete();
            return;
        }

        // 获取玩家数量
        const playerCount = playerUIManager.getPlayerCount();

        // 清除所有玩家的牌型显示
        playerUIManager.clearAllHandTypes();
        console.log('[TheDecreeModeClient] ✓ All hand types cleared');

        // 遍历所有玩家（除了主玩家 index 0）
        for (let i = 1; i < playerCount; i++) {
            const playerUINode = playerUIManager.getPlayerUINode(i);
            if (playerUINode) {
                const handDisplay = playerUINode.getHandDisplay();
                if (handDisplay) {
                    // 清除出牌显示，恢复为手牌背面
                    handDisplay.updateDisplay([]);
                    console.log(`[TheDecreeModeClient] Cleared showdown display for player at index ${i}`);
                }
            }
        }

        console.log('[TheDecreeModeClient] ✓ Showdown display cleared for all players');

        // 标记摊牌动画完成，检查是否有待处理的 GameOver 事件
        this.onShowdownAnimationComplete();
    }

    /**
     * 摊牌动画完成后的处理
     * 检查是否有待处理的 GameOver 事件
     */
    private onShowdownAnimationComplete(): void {
        console.log('[TheDecreeModeClient] Showdown animation completed');
        this._isShowdownInProgress = false;

        // 检查是否有待处理的 GameOver 事件
        if (this._pendingGameOver) {
            console.log('[TheDecreeModeClient] Processing pending GameOver event');
            const pendingData = this._pendingGameOver;
            this._pendingGameOver = null;
            this.processGameOver(pendingData);
        }
    }

    // ==================== 游戏逻辑接口（空实现，逻辑在服务器）====================

    public initGame(playerInfos: PlayerInfo[]): void {
        console.log('[TheDecreeModeClient] initGame called with', playerInfos.length, 'players');

        // 设置玩家 ID 映射
        this.setupPlayerIdMapping(playerInfos);

        // 不需要初始化游戏逻辑，等待服务器事件
    }

    public dealCards(): void {
        console.log('[TheDecreeModeClient] dealCards called - waiting for server');
        // 不需要发牌，服务器会发送 DEAL_CARDS 事件
    }

    public isValidPlay(cards: number[], playerId: string): boolean {
        // 客户端不做验证，服务器会验证
        return true;
    }

    public playCards(cards: number[], playerId: string): boolean {
        console.log('[TheDecreeModeClient] playCards called - sending to server');

        // 使用基类的发送方法
        return this.sendPlayCardsRequest(cards);
    }

    public isGameOver(): boolean {
        // 服务器会发送 GAME_OVER 事件
        return false;
    }

    public getCurrentLevelRank(): number {
        return 0;
    }

    // ==================== 公共方法供 UI 调用 ====================

    /**
     * 庄家叫牌（由 UI 调用）
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): boolean {
        console.log('[TheDecreeModeClient] Dealer calling', cardsToPlay, 'cards');

        // 使用基类的发送方法
        const success = this.sendDealerCallRequest(cardsToPlay);

        if (success) {
            console.log('[TheDecreeModeClient] ✓ Dealer call request sent successfully');
        } else {
            console.error('[TheDecreeModeClient] ✗ Failed to send dealer call request');
        }

        return success;
    }

    /**
     * 获取当前要出的牌数
     */
    public getCardsToPlay(): number {
        return this.cardsToPlay;
    }

    /**
     * 获取当前庄家 ID
     */
    public getDealerId(): string {
        return this.dealerId;
    }

    /**
     * 检查当前玩家是否是庄家
     */
    public isCurrentPlayerDealer(): boolean {
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();
        return currentPlayerId ? currentPlayerId === this.dealerId : false;
    }

    /**
     * 获取 player_0 自动出牌状态
     */
    public isPlayer0AutoPlayEnabled(): boolean {
        return this.isPlayer0AutoPlay;
    }

    /**
     * 设置 player_0 自动出牌状态
     */
    public setPlayer0AutoPlay(enabled: boolean): void {
        this.isPlayer0AutoPlay = enabled;
        console.log(`[TheDecreeModeClient] Player_0 auto-play ${enabled ? 'enabled' : 'disabled'}`);
    }

    // ==================== Legacy 兼容方法（供 Game.ts 调用）====================
    // 这些方法在网络版中大多返回空值或默认值，因为游戏逻辑在服务器端

    /**
     * 获取公共牌（客户端版本）
     */
    public getCommunityCards(): number[] {
        return [...this.communityCards];
    }

    /**
     * 获取玩家信息（网络版不支持）
     */
    public getPlayer(playerId: string): any | undefined {
        console.warn('[TheDecreeModeClient] getPlayer() not supported in network mode');
        return undefined;
    }

    /**
     * 获取分数（网络版暂不支持）
     */
    public getScores(): Map<string, number> {
        console.warn('[TheDecreeModeClient] getScores() not supported in network mode');
        return new Map();
    }

    /**
     * 获取游戏状态
     */
    public getState(): TheDecreeGameState {
        return this.gameState;
    }

    /**
     * 获取当前回合信息（网络版暂不支持）
     */
    public getCurrentRound(): any | null {
        console.warn('[TheDecreeModeClient] getCurrentRound() not supported in network mode');
        return null;
    }

    /**
     * 选择首庄（网络版不支持，由服务器处理）
     */
    public selectFirstDealer(revealedCards: Map<string, number>): string {
        console.warn('[TheDecreeModeClient] selectFirstDealer() not supported in network mode');
        return '';
    }

    /**
     * 开始新回合（网络版不支持，由服务器处理）
     */
    public startNewRound(dealerId: string): void {
        console.warn('[TheDecreeModeClient] startNewRound() not supported in network mode - controlled by server');
    }

    /**
     * 补牌（网络版不支持，由服务器处理）
     */
    public refillHands(): void {
        console.warn('[TheDecreeModeClient] refillHands() not supported in network mode - controlled by server');
    }

    // ==================== 托管相关方法 ====================

    /**
     * 处理玩家托管状态变化事件
     */
    private onPlayerAutoChanged(data: PlayerAutoChangedEvent): void {
        console.log('[TheDecreeModeClient] ========== Player Auto Changed Event ==========');
        console.log('[TheDecreeModeClient] Player ID:', data.playerId);
        console.log('[TheDecreeModeClient] Is Auto:', data.isAuto);
        console.log('[TheDecreeModeClient] Reason:', data.reason);

        // 更新 LocalGameStore
        LocalGameStore.getInstance().setPlayerAuto(
            data.playerId,
            data.isAuto,
            data.reason
        );

        console.log('[TheDecreeModeClient] ✓ Player auto state updated');
        console.log('[TheDecreeModeClient] ========================================');
    }

    /**
     * 切换托管状态
     */
    public toggleAuto(): void {
        const myId = LocalGameStore.getInstance().getMyPlayerId();
        const isAuto = LocalGameStore.getInstance().isPlayerAuto(myId);

        this.setAuto(!isAuto);
    }

    /**
     * 设置托管状态
     * @param isAuto 是否托管
     */
    public setAuto(isAuto: boolean): void {
        const request: SetAutoRequest = {
            isAuto
        };

        // 使用 game.networkClient 发送消息
        const networkClient = this.game.networkClient;
        if (!networkClient) {
            console.error('[TheDecreeModeClient] Network client not available');
            return;
        }

        networkClient.send(ClientMessageType.SET_AUTO, request);

        console.log(`[TheDecreeModeClient] Set auto mode: ${isAuto}`);
    }

    
    // ==================== 重连恢复方法 ====================

    /**
     * 检查并恢复重连状态
     * 如果 LocalGameStore 中有游戏数据，说明是重连场景，需要恢复 UI
     */
    private checkAndRestoreReconnectState(force: boolean = false): void {
        console.log('[TheDecreeModeClient] checkAndRestoreReconnectState, force:', force);
        console.log('[TheDecreeModeClient] game instance:', {
            node: this.game?.node?.name,
            uuid: this.game?.node?.uuid,
            scene: this.game?.node?.scene?.name,
            holdLoading: (this.game as any)?._holdLoadingForReconnect
        });
        try {
            const gameStore = LocalGameStore.getInstance();
            const communityCards = gameStore.getCommunityCards();
            const myHandCards = gameStore.getMyHandCards();
            console.log('[TheDecreeModeClient] reconnect snapshot:', {
                communityCards: communityCards.length,
                myHandCards: myHandCards.length,
                gameState: gameStore.getGameState(),
                dealerId: gameStore.getDealerId(),
                cardsToPlay: gameStore.getCardsToPlay(),
                round: gameStore.getCurrentRound()
            });

            // 如果没有公共牌数据，说明不是重连场景
            if (!force && communityCards.length === 0 && myHandCards.length === 0) {
                console.log('[TheDecreeModeClient] No reconnect data found, waiting for server events');
                return;
            }

            console.log('[TheDecreeModeClient] ========== Restoring Reconnect State ==========');
            console.log('[TheDecreeModeClient] Community cards:', communityCards);
            console.log('[TheDecreeModeClient] My hand cards:', myHandCards.length);

            this.refreshPlayerIdMapping();

            // 1. 恢复游戏状态
            const savedGameState = gameStore.getGameState();
            if (savedGameState) {
                this.gameState = savedGameState;
                console.log('[TheDecreeModeClient] Restored game state:', this.gameState);
            }

            // 2. 恢复庄家信息
            const savedDealerId = gameStore.getDealerId();
            if (savedDealerId) {
                this.dealerId = savedDealerId;
                console.log('[TheDecreeModeClient] Restored dealer ID:', this.dealerId);

                // 显示庄家指示器
                const dealerIndex = this.getPlayerIndex(savedDealerId);
                if (dealerIndex !== -1 && this.game.playerUIManager) {
                    this.game.playerUIManager.showDealer(dealerIndex);
                }
            }

            // 3. 恢复叫牌数
            const savedCardsToPlay = gameStore.getCardsToPlay();
            if (savedCardsToPlay > 0) {
                this.cardsToPlay = savedCardsToPlay;
                console.log('[TheDecreeModeClient] Restored cards to play:', this.cardsToPlay);
            }

            // 4. 恢复回合数
            const savedRound = gameStore.getCurrentRound();
            if (savedRound > 0) {
                this.currentRoundNumber = savedRound;
                console.log('[TheDecreeModeClient] Restored round number:', this.currentRoundNumber);
            }

            // 5. 恢复公共牌显示
            if (communityCards.length > 0) {
                this.communityCards = communityCards;
                this._communityCardsDealt = true;  // 标记公共牌已发
                this.displayCommunityCards();
                console.log('[TheDecreeModeClient] Restored community cards display');
            }

            // 6. 恢复手牌显示
            if (myHandCards.length > 0) {
                this._initialDealAnimationComplete = true;  // 跳过发牌动画
                this.restoreHandCardsDisplay(myHandCards);
                console.log('[TheDecreeModeClient] Restored hand cards display');
            }
            if (myHandCards.length === 0) {
                this.restoreHandCardsDisplay(myHandCards);
                console.log('[TheDecreeModeClient] Restored hand cards display (empty hand)');
            }

            // 7. 恢复分数显示
            this.restoreScoresDisplay();
            this.applyAutoStatesFromGameStore();

            // 8. 更新 UI 状态（启用/禁用按钮等）
            if (this.theDecreeUIController) {
                this.theDecreeUIController.updateUIState();
                this.theDecreeUIController.updateCallButtonsVisibility();
            }

            console.log('[TheDecreeModeClient] ========== Reconnect State Restored ==========');
        } catch (error) {
            console.error('[TheDecreeModeClient] Failed to restore reconnect state:', error);
        } finally {
            console.log('[TheDecreeModeClient] finishing reconnect loading');
            this.game.finishReconnectLoading();
        }
    }

    /**
     * 恢复手牌显示
     */
    private restoreHandCardsDisplay(myHandCards: number[]): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.error('[TheDecreeModeClient] PlayerUIManager not found');
            return;
        }

        // 恢复主玩家手牌
        const playerUIController = playerUIManager.getPlayerUINode(0);
        if (playerUIController) {
            const player = playerUIController.getPlayer();
            if (player) {
                player.setHandCards(myHandCards);
                playerUIManager.updatePlayerHand(0);
                console.log('[TheDecreeModeClient] Main player hand restored:', myHandCards.length, 'cards');

                // 应用 glow 特效（重连场景可能在 glow material 加载后才恢复手牌）
                // @ts-ignore - accessing private property
                const glowMaterial = this.game['_glowMaterial'];
                if (glowMaterial) {
                    const handDisplay = playerUIController.getHandDisplay();
                    if (handDisplay) {
                        handDisplay.setGlowMaterialAndApply(glowMaterial);
                    }
                }
            }
        }

        // 恢复其他玩家手牌数量
        const gameStore = LocalGameStore.getInstance();
        const allPlayerData = gameStore.getAllPlayerGameData();

        for (const playerData of allPlayerData) {
            const playerIndex = this.getPlayerIndex(playerData.playerId);
            if (playerIndex <= 0) continue;  // 跳过主玩家和未找到的玩家

            const otherPlayerUIController = playerUIManager.getPlayerUINode(playerIndex);
            if (otherPlayerUIController) {
                const otherPlayer = otherPlayerUIController.getPlayer();
                if (otherPlayer) {
                    // 设置手牌数量（用 -1 表示未知牌）
                    const emptyCards = Array(playerData.cardCount).fill(-1);
                    otherPlayer.setHandCards(emptyCards);
                    playerUIManager.updatePlayerHand(playerIndex);
                    console.log(`[TheDecreeModeClient] Player ${playerIndex} hand count restored: ${playerData.cardCount}`);
                }
            }
        }

        // 启用卡牌选择
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
        }
    }

    /**
     * 恢复分数显示
     */
    private restoreScoresDisplay(): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) return;

        const gameStore = LocalGameStore.getInstance();
        const allScores = gameStore.getAllScores();

        for (const [playerId, score] of allScores) {
            const playerIndex = this.getPlayerIndex(playerId);
            if (playerIndex === -1) continue;

            const playerUINode = playerUIManager.getPlayerUINode(playerIndex);
            if (playerUINode) {
                playerUINode.updateScore(score);
                console.log(`[TheDecreeModeClient] Restored score for player ${playerIndex}: ${score}`);
            }
        }
    }

    private applyAutoStatesFromGameStore(): void {
        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) return;

        const gameStore = LocalGameStore.getInstance();
        const allPlayerData = gameStore.getAllPlayerGameData();

        for (const playerData of allPlayerData) {
            const playerIndex = this.getPlayerIndex(playerData.playerId);
            if (playerIndex === -1) continue;
            playerUIManager.setPlayerAutoStatus(playerIndex, playerData.isAuto, playerData.autoReason);
        }
    }

    private refreshPlayerIdMapping(): void {
        const localRoomStore = LocalRoomStore.getInstance();
        const currentRoom = localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            console.warn('[TheDecreeModeClient] No current room for player mapping');
            return;
        }

        const myPlayerId = localRoomStore.getMyPlayerId();
        const myPlayerInfo = currentRoom.players.find(p => p.id === myPlayerId);
        const mySeatIndex = myPlayerInfo?.seatIndex ?? 0;
        const totalSeats = currentRoom.maxPlayers;

        this.playerIdToIndexMap.clear();
        for (const playerInfo of currentRoom.players) {
            const relativeIndex = (playerInfo.seatIndex - mySeatIndex + totalSeats) % totalSeats;
            this.playerIdToIndexMap.set(playerInfo.id, relativeIndex);
        }

        console.log('[TheDecreeModeClient] Player ID mapping refreshed:', Array.from(this.playerIdToIndexMap.entries()));
    }
}
