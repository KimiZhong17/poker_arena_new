import { GameModeClientBase, GameModeConfig } from "./GameModeClientBase";
import { Game } from "../../Game";
import { Player, PlayerInfo } from "../../LocalStore/LocalPlayerStore";
import { LocalRoomStore } from "../../LocalStore/LocalRoomStore";
import { Node, instantiate } from "cc";
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

    // UI 节点（游戏模式特定）
    private theDecreeContainerNode: Node | null = null;
    private communityCardsNode: Node | null = null;
    private theDecreeUIController: TheDecreeUIController | null = null;

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

        // 查找并缓存游戏模式特定的节点
        this.findModeSpecificNodes();

        // 升级 PlayerUIManager 到游戏模式
        this.upgradePlayerUIToPlayingMode();

        // 显示 UI
        this.showUI();

        // 注册网络事件监听器（使用基类方法）
        this.setupNetworkEvents();

        console.log('[TheDecreeModeClient] Waiting for server events...');
    }

    public onExit(): void {
        console.log('[TheDecreeModeClient] Exiting game mode');
        this.isActive = false;

        // 清除摊牌显示定时器
        this.clearShowdownTimer();

        // 注销网络事件监听器（使用基类方法）
        this.unregisterAllNetworkEvents();

        // 隐藏 UI
        this.hideUI();

        // 清除节点引用
        this.theDecreeContainerNode = null;
        this.communityCardsNode = null;
    }

    public cleanup(): void {
        console.log('[TheDecreeModeClient] Cleaning up');
        this.clearShowdownTimer();
        super.cleanup();
        this.unregisterAllNetworkEvents();
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

    // ==================== 事件处理器 ====================

    private onDealCards(data: DealCardsEvent): void {
        console.log('[TheDecreeModeClient] ========== Deal Cards Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received deal_cards event from server');
        console.log('[TheDecreeModeClient] Player ID:', data.playerId);
        console.log('[TheDecreeModeClient] Cards:', data.handCards);
        console.log('[TheDecreeModeClient] Card count:', data.handCards.length);
        console.log('[TheDecreeModeClient] All hand counts:', data.allHandCounts);
        console.log('[TheDecreeModeClient] Raw event data:', JSON.stringify(data));

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
                console.log(`[TheDecreeModeClient] Before update - handCards:`, player.handCards.length);

                player.setHandCards(data.handCards);

                console.log(`[TheDecreeModeClient] After update - handCards:`, player.handCards.length);
                console.log(`[TheDecreeModeClient] Calling updatePlayerHand...`);

                // 更新手牌显示
                playerUIManager.updatePlayerHand(playerIndex);

                console.log(`[TheDecreeModeClient] ✓ Hand display updated successfully`);

                // 如果是主玩家（index 0），启用卡牌选择功能（允许预选）
                if (playerIndex === 0) {
                    console.log('[TheDecreeModeClient] Enabling card selection for player 0 (pre-selection allowed)...');

                    // 通过 TheDecreeUIController 启用选牌（这样会正确更新 _selectedCardIndices）
                    if (this.theDecreeUIController) {
                        this.theDecreeUIController.enableCardSelection();
                        console.log('[TheDecreeModeClient] ✓ Card selection enabled via UI controller (pre-selection mode)');
                    } else {
                        console.warn('[TheDecreeModeClient] TheDecreeUIController not found, cannot enable card selection');
                    }
                }
            } else {
                console.error(`[TheDecreeModeClient] ✗ Player not found in PlayerUIController for index ${playerIndex}`);
            }
        } else {
            console.error(`[TheDecreeModeClient] ✗ PlayerUIController not found for index ${playerIndex}`);
        }

        // 如果包含所有玩家的手牌数量信息（补牌后），更新其他玩家的手牌显示
        if (data.allHandCounts) {
            console.log('[TheDecreeModeClient] Updating all players hand counts...');
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

        console.log('[TheDecreeModeClient] =====================================');
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

        // 显示公共牌
        console.log('[TheDecreeModeClient] Calling displayCommunityCards()...');
        this.displayCommunityCards();
        console.log('[TheDecreeModeClient] ✓ Community cards displayed');

        // 初始化所有玩家的手牌（如果还没有初始化的话）
        this.initializeAllPlayersHands();

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onRequestFirstDealerSelection(data: RequestFirstDealerSelectionEvent): void {
        console.log('[TheDecreeModeClient] ========== Request First Dealer Selection Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received request_first_dealer_selection event');
        console.log('[TheDecreeModeClient] Game state:', data.gameState);
        console.log('[TheDecreeModeClient] 💡 提示：请选择一张手牌，牌最大的成为首个庄家');

        // 设置游戏状态为首庄选择阶段
        this.gameState = data.gameState as TheDecreeGameState;

        // 显示消息提示
        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage('请选择一张手牌，牌最大的成为首个庄家', 3.0);
        }

        // 启用卡牌选择（只能选一张）
        // 选择后需要点击"出牌"按钮确认
        if (this.theDecreeUIController) {
            this.theDecreeUIController.enableCardSelection();
            console.log('[TheDecreeModeClient] ✓ Card selection enabled for first dealer selection');
        }

        console.log('[TheDecreeModeClient] =====================================');
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

        // 设置游戏状态
        this.gameState = data.gameState as TheDecreeGameState;

        // 显示所有玩家的牌型和结果
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

        // 遍历所有摊牌结果，更新每个玩家的显示
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

        // 设置定时器，3秒后自动清除摊牌显示
        this.clearShowdownTimer(); // 先清除之前的定时器
        this.showdownClearTimer = window.setTimeout(() => {
            console.log('[TheDecreeModeClient] Auto-clearing showdown display after 3 seconds');
            this.clearShowdownDisplay();
        }, 3000);

        console.log('[TheDecreeModeClient] =====================================');
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

        // 显示回合结果消息
        const winnerName = this.getPlayerName(data.winnerId);
        const loserName = this.getPlayerName(data.loserId);
        if (this.theDecreeUIController) {
            this.theDecreeUIController.showMessage(`${winnerName} 获胜！${loserName} 输了`, 3.0);
        }

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

        // 设置玩家 ID 映射（关键！）
        console.log('[TheDecreeModeClient] Setting up player ID mapping...');
        console.log('[TheDecreeModeClient] Room players:', currentRoom.players.map(p => ({
            id: p.id,
            name: p.name,
            seatIndex: p.seatIndex
        })));

        // 获取当前玩家的 ID 和 seatIndex
        const myPlayerId = localRoomStore.getMyPlayerId();
        const myPlayerInfo = currentRoom.players.find(p => p.id === myPlayerId);
        const mySeatIndex = myPlayerInfo?.seatIndex ?? 0;

        console.log('[TheDecreeModeClient] My player ID:', myPlayerId);
        console.log('[TheDecreeModeClient] My seat index:', mySeatIndex);

        // 重新映射玩家位置：让当前玩家总是显示在 index 0（底部）
        // 其他玩家按顺序显示在其他位置
        const remappedPlayers = [];
        for (let i = 0; i < currentRoom.players.length; i++) {
            const actualSeatIndex = (mySeatIndex + i) % currentRoom.players.length;
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

        // 创建4张公共牌
        const cardSpacing = 120; // 牌之间的间距
        const startX = -(cardSpacing * (this.communityCards.length - 1)) / 2; // 居中显示

        this.communityCards.forEach((card, index) => {
            // 创建扑克牌节点
            const pokerNode = instantiate(pokerPrefab);
            const pokerCtrl = pokerNode.addComponent(Poker);

            // 获取牌面图片
            const spriteName = PokerFactory.getCardSpriteName(card);
            const pokerFront = pokerSprites.get(spriteName);

            if (pokerFront && pokerBack) {
                pokerCtrl.init(card, pokerBack, pokerFront);
                pokerCtrl.showFront(); // 公共牌始终显示正面
            } else {
                console.warn(`[TheDecreeModeClient] Sprite not found: ${spriteName}`);
            }

            // 设置位置
            pokerNode.setPosition(startX + index * cardSpacing, 0, 0);

            // 添加到公共牌节点
            this.communityCardsNode.addChild(pokerNode);

            console.log(`[TheDecreeModeClient] Created community card ${index + 1}/${this.communityCards.length}: ${spriteName}`);
        });

        console.log(`[TheDecreeModeClient] Displayed ${this.communityCards.length} community cards`);
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
     * 将所有玩家的出牌显示恢复为手牌背面
     */
    private clearShowdownDisplay(): void {
        console.log('[TheDecreeModeClient] Clearing showdown display...');

        // 清除定时器
        this.clearShowdownTimer();

        const playerUIManager = this.game.playerUIManager;
        if (!playerUIManager) {
            console.warn('[TheDecreeModeClient] PlayerUIManager not found');
            return;
        }

        // 获取玩家数量
        const playerCount = playerUIManager.getPlayerCount();

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
}
