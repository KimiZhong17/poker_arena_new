import { NetworkClient } from '../Network/NetworkClient';
import {
    ClientMessageType,
    ServerMessageType,
    DealCardsEvent,
    DealerSelectedEvent,
    DealerCalledEvent,
    PlayerPlayedEvent,
    ShowdownEvent,
    RoundEndEvent,
    GameOverEvent,
    GameStateUpdateEvent,
    CommunityCardsEvent
} from '../Network/Messages';
import { NetworkManager } from '../Network/NetworkManager';
import { NetworkConfig } from '../Config/NetworkConfig';
import { EventCenter, GameEvents } from '../Utils/EventCenter';
import { LocalGameStore } from '../LocalStore/LocalGameStore';
import { LocalRoomStore } from '../LocalStore/LocalRoomStore';
import { TheDecreeGameState } from '../Core/GameMode/TheDecreeGameState';

/**
 * GameService - 游戏服务
 *
 * 职责：
 * - 监听游戏相关的网络事件
 * - 处理游戏玩法相关的业务逻辑
 * - 发送游戏操作请求（出牌、叫牌等）
 * - 发送 EventCenter 事件通知 UI 层
 *
 * 注意：
 * - 不负责游戏状态管理（由 GameModeClient 负责）
 * - 不直接操作 UI（通过 EventCenter 解耦）
 */
export class GameService {
    private static instance: GameService;

    private constructor() {
        this.initNetworkListeners();
    }

    public static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService();
        }
        return GameService.instance;
    }

    /**
     * 初始化网络监听
     */
    private initNetworkListeners(): void {
        const net = NetworkManager.getInstance().getClient(NetworkConfig.getServerUrl());

        // --- 先解绑，防止重复 ---
        net.off(ServerMessageType.GAME_START, this.onGameStart);
        net.off(ServerMessageType.DEAL_CARDS, this.onDealCards);
        net.off(ServerMessageType.COMMUNITY_CARDS, this.onCommunityCards);
        net.off(ServerMessageType.DEALER_SELECTED, this.onDealerSelected);
        net.off(ServerMessageType.DEALER_CALLED, this.onDealerCalled);
        net.off(ServerMessageType.PLAYER_PLAYED, this.onPlayerPlayed);
        net.off(ServerMessageType.SHOWDOWN, this.onShowdown);
        net.off(ServerMessageType.ROUND_END, this.onRoundEnd);
        net.off(ServerMessageType.GAME_OVER, this.onGameOver);
        net.off(ServerMessageType.GAME_STATE_UPDATE, this.onGameStateUpdate);

        // --- 再绑定 ---
        net.on(ServerMessageType.GAME_START, this.onGameStart);
        net.on(ServerMessageType.DEAL_CARDS, this.onDealCards);
        net.on(ServerMessageType.COMMUNITY_CARDS, this.onCommunityCards);
        net.on(ServerMessageType.DEALER_SELECTED, this.onDealerSelected);
        net.on(ServerMessageType.DEALER_CALLED, this.onDealerCalled);
        net.on(ServerMessageType.PLAYER_PLAYED, this.onPlayerPlayed);
        net.on(ServerMessageType.SHOWDOWN, this.onShowdown);
        net.on(ServerMessageType.ROUND_END, this.onRoundEnd);
        net.on(ServerMessageType.GAME_OVER, this.onGameOver);
        net.on(ServerMessageType.GAME_STATE_UPDATE, this.onGameStateUpdate);
    }

    // ==================== 网络事件处理器 ====================

    /**
     * 游戏开始事件
     */
    private onGameStart = (data: any) => {
        console.log('[GameService] Game started! Switching to Playing stage...', data);

        // 重置游戏状态
        const gameStore = LocalGameStore.getInstance();
        gameStore.resetGame();
        gameStore.setGameActive(true);
        gameStore.setGameState(TheDecreeGameState.SETUP);

        // 初始化玩家数据
        const roomStore = LocalRoomStore.getInstance();
        const currentRoom = roomStore.getCurrentRoom();
        const myPlayerId = roomStore.getMyPlayerId();

        if (currentRoom && myPlayerId) {
            const playerIds = currentRoom.players.map(p => p.id);
            gameStore.initializePlayers(playerIds, myPlayerId);
            console.log(`[GameService] Initialized ${playerIds.length} players in LocalGameStore`);
        }

        // 触发阶段切换到 Playing
        EventCenter.emit('SWITCH_TO_PLAYING_STAGE');
    };

    /**
     * 发牌事件
     */
    private onDealCards = (data: DealCardsEvent) => {
        console.log('[GameService] ========== DEAL_CARDS EVENT ==========');
        console.log('[GameService] Deal cards:', data);
        console.log('[GameService] Player ID:', data.playerId);
        console.log('[GameService] Cards:', data.handCards);
        console.log('[GameService] ===========================================');

        // 存储到 LocalGameStore（使用新方法）
        const gameStore = LocalGameStore.getInstance();
        gameStore.setPlayerHandCards(data.playerId, data.handCards);

        EventCenter.emit(GameEvents.GAME_DEAL_CARDS, data);
    };

    /**
     * 公共牌事件
     */
    private onCommunityCards = (data: CommunityCardsEvent) => {
        console.log('[GameService] Community cards:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setCommunityCards(data.cards);
        gameStore.setGameState(data.gameState as TheDecreeGameState);

        EventCenter.emit(GameEvents.GAME_COMMUNITY_CARDS, data);
    };

    /**
     * 选庄事件
     */
    private onDealerSelected = (data: DealerSelectedEvent) => {
        console.log('[GameService] Dealer selected:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setDealerId(data.dealerId);
        gameStore.setCurrentRound(data.roundNumber);
        gameStore.setGameState(data.gameState as TheDecreeGameState);
        gameStore.setPlayerIsDealer(data.dealerId, true);

        EventCenter.emit(GameEvents.GAME_DEALER_SELECTED, data);
    };

    /**
     * 庄家叫牌事件
     */
    private onDealerCalled = (data: DealerCalledEvent) => {
        console.log('[GameService] Dealer called:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setCardsToPlay(data.cardsToPlay);
        gameStore.setGameState(data.gameState as TheDecreeGameState);

        EventCenter.emit(GameEvents.GAME_DEALER_CALLED, data);
    };

    /**
     * 玩家出牌事件
     */
    private onPlayerPlayed = (data: PlayerPlayedEvent) => {
        console.log('[GameService] Player played:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setPlayerCardCount(data.playerId, data.cardCount);

        EventCenter.emit(GameEvents.GAME_PLAYER_PLAYED, data);
    };

    /**
     * 摊牌事件
     */
    private onShowdown = (data: ShowdownEvent) => {
        console.log('[GameService] Showdown:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setGameState(data.gameState as TheDecreeGameState);

        EventCenter.emit(GameEvents.GAME_SHOWDOWN, data);
    };

    /**
     * 回合结束事件
     */
    private onRoundEnd = (data: RoundEndEvent) => {
        console.log('[GameService] Round end:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setScores(data.scores);
        gameStore.setGameState(data.gameState as TheDecreeGameState);

        // 添加回合历史记录
        const currentRound = gameStore.getCurrentRound();
        gameStore.addRoundHistory({
            roundNumber: currentRound,
            dealerId: gameStore.getDealerId(),
            cardsToPlay: gameStore.getCardsToPlay(),
            winnerId: data.winnerId,
            loserId: data.loserId,
            showdownResults: [], // 摊牌结果在 onShowdown 中已经处理
            scores: data.scores,
            timestamp: Date.now()
        });

        EventCenter.emit(GameEvents.GAME_ROUND_END, data);
    };

    /**
     * 游戏结束事件
     */
    private onGameOver = (data: GameOverEvent) => {
        console.log('[GameService] Game over:', data);

        // 存储到 LocalGameStore
        const gameStore = LocalGameStore.getInstance();
        gameStore.setScores(data.scores);
        gameStore.setGameState(data.gameState as TheDecreeGameState);
        gameStore.setGameActive(false);

        EventCenter.emit(GameEvents.GAME_OVER, data);
    };

    /**
     * 游戏状态更新事件
     */
    private onGameStateUpdate = (data: GameStateUpdateEvent) => {
        console.log('[GameService] Game state update:', data);

        // 存储到 LocalGameStore（全量同步）
        const gameStore = LocalGameStore.getInstance();
        gameStore.setCurrentRound(data.roundNumber);
        gameStore.setDeckSize(data.deckSize);

        if (data.dealerId) {
            gameStore.setDealerId(data.dealerId);
        }

        if (data.cardsToPlay) {
            gameStore.setCardsToPlay(data.cardsToPlay);
        }

        if (data.lastPlayedCards) {
            // 注意：这里只更新最后出的牌，不添加到出牌记录
            // 因为这是快照同步，不是实时出牌事件
        }

        // 更新所有玩家的手牌数量
        if (data.players) {
            for (const player of data.players) {
                gameStore.setPlayerCardCount(player.id, player.cardCount);
                gameStore.setPlayerTurn(player.id, player.isTurn);
            }
        }

        EventCenter.emit(GameEvents.GAME_STATE_UPDATE, data);
    };

    // ==================== 业务接口（发送请求）====================

    private getNetworkClient(): NetworkClient | null {
        const client = NetworkManager.getInstance().getClient(NetworkConfig.getServerUrl());
        if (!client || !client.getIsConnected()) return null;
        return client;
    }

    // ==================== The Decree 模式相关 ====================

    /**
     * 庄家叫牌
     * @param cardsToPlay 要打的牌数 (1, 2, 或 3)
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot dealer call: not connected');
            return;
        }

        console.log('[GameService] Dealer call:', cardsToPlay);
        // TODO: 添加 roomId 和 playerId
        // client.send(ClientMessageType.DEALER_CALL, { roomId, playerId, cardsToPlay });
    }

    /**
     * 出牌
     * @param cards 要打出的牌（牌的编码数组）
     */
    public playCards(cards: number[]): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot play cards: not connected');
            return;
        }

        console.log('[GameService] Play cards:', cards);
        // TODO: 添加 roomId 和 playerId
        // client.send(ClientMessageType.PLAY_CARDS, { roomId, playerId, cards });
    }

    // ==================== Guandan 模式相关 ====================

    /**
     * 过牌
     * 只在 Guandan 模式中使用
     */
    public pass(): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot pass: not connected');
            return;
        }

        console.log('[GameService] Pass');
        // TODO: 添加 PASS 消息类型
        // client.send(ClientMessageType.PASS, {});
    }

    // ==================== 通用游戏操作 ====================

    /**
     * 投降/认输
     */
    public surrender(): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot surrender: not connected');
            return;
        }

        console.log('[GameService] Surrender');
        // TODO: 添加 SURRENDER 消息类型
        // client.send(ClientMessageType.SURRENDER, {});
    }

    /**
     * 请求提示
     * 向服务器请求可以打出的牌型提示
     */
    public requestHint(): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot request hint: not connected');
            return;
        }

        console.log('[GameService] Request hint');
        // TODO: 添加 REQUEST_HINT 消息类型
        // client.send(ClientMessageType.REQUEST_HINT, {});
    }

    /**
     * 准备下一轮
     * 在回合结束后，准备进入下一轮
     */
    public readyForNextRound(): void {
        const client = this.getNetworkClient();
        if (!client) {
            console.error('[GameService] Cannot ready for next round: not connected');
            return;
        }

        console.log('[GameService] Ready for next round');
        // TODO: 添加消息类型
        // client.send(ClientMessageType.READY_NEXT_ROUND, {});
    }
}
