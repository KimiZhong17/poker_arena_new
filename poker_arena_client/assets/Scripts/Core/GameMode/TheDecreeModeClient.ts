import { GameModeClientBase, GameModeConfig } from "./GameModeClientBase";
import { Game } from "../../Game";
import { Player, PlayerInfo } from "../../LocalStore/LocalPlayerStore";
import { LocalRoomStore } from "../../LocalStore/LocalRoomStore";
import { Node, instantiate } from "cc";
import {
    DealCardsEvent,
    CommunityCardsEvent,
    DealerSelectedEvent,
    DealerCalledEvent,
    PlayerPlayedEvent,
    ShowdownEvent,
    RoundEndEvent,
    GameOverEvent
} from '../../Network/Messages';
import { LocalUserStore } from '../../LocalStore/LocalUserStore';
import { PokerFactory } from '../../UI/PokerFactory';
import { Poker } from '../../UI/Poker';

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

    // 自动出牌设置（仅用于 player_0）
    private isPlayer0AutoPlay: boolean = true;

    // UI 节点（游戏模式特定）
    private theDecreeContainerNode: Node | null = null;
    private communityCardsNode: Node | null = null;

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
            'dealer_selected': this.onDealerSelected,
            'dealer_called': this.onDealerCalled,
            'player_played': this.onPlayerPlayed,
            'showdown': this.onShowdown,
            'round_end': this.onRoundEnd,
            'game_over': this.onGameOver
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
        console.log('[TheDecreeModeClient] Raw event data:', JSON.stringify(data));

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
            } else {
                console.error(`[TheDecreeModeClient] ✗ Player not found in PlayerUIController for index ${playerIndex}`);
            }
        } else {
            console.error(`[TheDecreeModeClient] ✗ PlayerUIController not found for index ${playerIndex}`);
        }

        console.log('[TheDecreeModeClient] =====================================');
    }

    private onCommunityCards(data: CommunityCardsEvent): void {
        console.log('[TheDecreeModeClient] ========== Community Cards Event ==========');
        console.log('[TheDecreeModeClient] 📩 Received community_cards event from server');
        console.log('[TheDecreeModeClient] Cards:', data.cards);
        console.log('[TheDecreeModeClient] Card count:', data.cards.length);
        console.log('[TheDecreeModeClient] Raw event data:', JSON.stringify(data));

        this.communityCards = data.cards;

        // 显示公共牌
        console.log('[TheDecreeModeClient] Calling displayCommunityCards()...');
        this.displayCommunityCards();
        console.log('[TheDecreeModeClient] ✓ Community cards displayed');

        // 初始化所有玩家的手牌（如果还没有初始化的话）
        this.initializeAllPlayersHands();

        console.log('[TheDecreeModeClient] =====================================');
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
        console.log('[TheDecreeModeClient] Dealer selected:', data);
        this.dealerId = data.dealerId;
        this.currentRoundNumber = data.roundNumber;

        // 显示庄家指示器（使用基类的 getPlayerIndex）
        const dealerIndex = this.getPlayerIndex(data.dealerId);
        if (dealerIndex !== -1 && this.game.playerUIManager) {
            this.game.playerUIManager.showDealer(dealerIndex);
            console.log(`[TheDecreeModeClient] Round ${this.currentRoundNumber}, dealer: ${this.dealerId} (index: ${dealerIndex})`);
        }
    }

    private onDealerCalled(data: DealerCalledEvent): void {
        console.log('[TheDecreeModeClient] Dealer called:', data);
        this.cardsToPlay = data.cardsToPlay;

        // 如果当前玩家是庄家，隐藏叫牌按钮
        // 如果当前玩家不是庄家，启用选牌功能
        const localRoomStore = LocalRoomStore.getInstance();
        const currentPlayerId = localRoomStore.getMyPlayerId();

        if (currentPlayerId && currentPlayerId !== data.dealerId) {
            // 启用选牌 UI
            console.log(`[TheDecreeModeClient] Waiting for player to select ${this.cardsToPlay} cards`);
        }
    }

    private onPlayerPlayed(data: PlayerPlayedEvent): void {
        console.log('[TheDecreeModeClient] Player played:', data);

        // 更新 UI 显示其他玩家已出牌（不显示具体牌面）
        // TODO: 更新玩家状态指示
    }

    private onShowdown(data: ShowdownEvent): void {
        console.log('[TheDecreeModeClient] Showdown:', data);

        // 显示所有玩家的牌型和结果
        for (const result of data.results) {
            console.log(`Player ${result.playerId}: ${result.handTypeName} (${result.score} points)${result.isWinner ? ' WINNER!' : ''}`);
        }

        // TODO: 更新 UI 显示牌型
    }

    private onRoundEnd(data: RoundEndEvent): void {
        console.log('[TheDecreeModeClient] Round end:', data);

        // 更新所有玩家的分数
        // TODO: 更新分数显示
    }

    private onGameOver(data: GameOverEvent): void {
        console.log('[TheDecreeModeClient] Game over:', data);
        console.log(`Winner: ${data.winnerId} with ${data.scores[data.winnerId]} points`);

        // 切换到结束阶段
        // TODO: 通知 PlayingStage 游戏结束
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
            false // TheDecree 不启用分组堆叠
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
    public dealerCall(cardsToPlay: 1 | 2 | 3): void {
        console.log('[TheDecreeModeClient] Dealer calling', cardsToPlay, 'cards');

        // 使用基类的发送方法
        this.sendDealerCallRequest(cardsToPlay);
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
     * 获取游戏状态（网络版暂不支持）
     */
    public getState(): string {
        console.warn('[TheDecreeModeClient] getState() not supported in network mode');
        return 'unknown';
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
}
