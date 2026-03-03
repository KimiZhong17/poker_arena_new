import { TheDecreeGameState } from '../Core/GameMode/TheDecreeGameState';
import { ShowdownResult } from '../Network/Messages';
import { PlayerState } from './PlayerStore';
import { EventCenter, GameEvents } from '../Utils/EventCenter';
import { logger } from '../Utils/Logger';

const log = logger('LocalGameStore');

/**
 * 玩家游戏数据
 * 存储单个玩家在游戏中的状态
 */
export interface PlayerGameData {
    playerId: string;          // 玩家ID（对应 PlayerInfo.id）
    handCards: number[];       // 手牌（只有自己能看到具体牌，其他玩家只知道数量）
    cardCount: number;         // 手牌数量
    score: number;             // 分数
    state: PlayerState;        // 游戏状态
    isDealer: boolean;         // 是否庄家
    isTurn: boolean;           // 是否轮到
    isAuto: boolean;           // 是否托管中
    autoReason?: 'manual' | 'timeout' | 'disconnect'; // 托管原因
}

/**
 * 回合历史记录
 */
export interface RoundHistory {
    roundNumber: number;
    dealerId: string;
    cardsToPlay: number;
    winnerId: string;
    loserId: string;
    showdownResults: ShowdownResult[];
    scores: { [playerId: string]: number };
    timestamp: number;
}

/**
 * 玩家出牌记录
 */
export interface PlayRecord {
    playerId: string;
    cards: number[];
    cardCount: number;
    timestamp: number;
}

/**
 * LocalGameStore - 游戏状态存储
 *
 * 职责：
 * - 存储游戏进行中的所有状态数据（包括所有玩家）
 * - 提供统一的数据访问接口
 * - 作为游戏状态的单一数据源（Single Source of Truth）
 *
 * 数据层级：
 * - LocalUserStore: 账户信息（持久化，跨房间）
 * - LocalRoomStore: 房间玩家信息（临时，房间内）
 * - LocalGameStore: 游戏状态数据（更临时，游戏中）
 *
 * 数据流：
 * NetworkClient → GameService → LocalGameStore → EventCenter → UI
 *
 * 注意：
 * - 只存储数据，不包含游戏逻辑
 * - 数据由 GameService 更新（从服务器同步）
 * - UI 组件通过 EventCenter 监听变化，通过 LocalGameStore 查询数据
 */
export class LocalGameStore {
    private static instance: LocalGameStore;

    // ==================== 游戏基础状态 ====================
    private gameState: TheDecreeGameState = TheDecreeGameState.SETUP;
    private currentRound: number = 0;
    private isGameActive: boolean = false;

    // ==================== 玩家游戏数据（核心）====================
    private players: Map<string, PlayerGameData> = new Map(); // 所有玩家的游戏数据
    private myPlayerId: string = '';                          // 我的玩家ID（用于快速查询）

    // ==================== 牌相关 ====================
    private myHandCards: number[] = [];             // 我的手牌（兼容旧逻辑）
    private communityCards: number[] = [];           // 公共牌（4张）
    private deckSize: number = 0;                    // 牌堆剩余牌数

    // ==================== 庄家相关 ====================
    private dealerId: string = '';                   // 当前庄家ID
    private cardsToPlay: number = 0;                 // 本回合要出的牌数（1, 2, 或 3）

    // ==================== 回合记录 ====================
    private currentRoundPlays: PlayRecord[] = [];    // 当前回合的出牌记录
    private roundHistory: RoundHistory[] = [];       // 历史回合结果
    private lastPlayedCards: number[] = [];          // 桌面上最后出的牌
    private lastPlayerId: string = '';               // 最后出牌的玩家ID

    private constructor() {}

    public static getInstance(): LocalGameStore {
        if (!LocalGameStore.instance) {
            LocalGameStore.instance = new LocalGameStore();
        }
        return LocalGameStore.instance;
    }

    // ==================== 玩家数据管理（新架构）====================

    /**
     * 初始化玩家（游戏开始时调用）
     * @param playerIds 所有玩家的ID列表
     * @param myPlayerId 当前玩家的ID
     */
    public initializePlayers(playerIds: string[], myPlayerId: string): void {
        this.myPlayerId = myPlayerId;
        this.players.clear();

        for (const playerId of playerIds) {
            this.players.set(playerId, {
                playerId,
                handCards: [],
                cardCount: 0,
                score: 0,
                state: PlayerState.WAITING,
                isDealer: false,
                isTurn: false,
                isAuto: false,
                autoReason: undefined
            });
        }

        if (this.myPlayerId && this._pendingHandCards.length > 0) {
            this.setPlayerHandCards(this.myPlayerId, this._pendingHandCards);
            this.myHandCards = [...this._pendingHandCards];
            log.debug(`Applied pending hand cards: ${this._pendingHandCards.length} cards`);
            this._pendingHandCards = [];
        }

        log.debug(`Initialized ${playerIds.length} players, myPlayerId: ${myPlayerId}`);
    }

    /**
     * 获取玩家游戏数据
     */
    public getPlayerGameData(playerId: string): PlayerGameData | undefined {
        return this.players.get(playerId);
    }

    /**
     * 获取所有玩家游戏数据
     */
    public getAllPlayerGameData(): PlayerGameData[] {
        return Array.from(this.players.values());
    }

    /**
     * 获取我的玩家ID
     */
    public getMyPlayerId(): string {
        return this.myPlayerId;
    }

    /**
     * 获取我的游戏数据
     */
    public getMyGameData(): PlayerGameData | undefined {
        return this.players.get(this.myPlayerId);
    }

    /**
     * 设置玩家手牌
     * @param playerId 玩家ID
     * @param cards 手牌
     */
    public setPlayerHandCards(playerId: string, cards: number[]): void {
        const player = this.players.get(playerId);
        if (player) {
            player.handCards = [...cards];
            player.cardCount = cards.length;
            log.debug(`Player ${playerId} hand cards: ${cards.length} cards`);
        } else {
            log.warn(`Player ${playerId} not found`);
        }
    }

    /**
     * 获取玩家手牌
     */
    public getPlayerHandCards(playerId: string): number[] {
        const player = this.players.get(playerId);
        return player ? [...player.handCards] : [];
    }

    /**
     * 设置玩家手牌数量（用于其他玩家，不知道具体牌）
     */
    public setPlayerCardCount(playerId: string, count: number): void {
        const player = this.players.get(playerId);
        if (player) {
            player.cardCount = count;
            // 如果不是自己，清空手牌数组（只保留数量）
            if (playerId !== this.myPlayerId) {
                player.handCards = Array(count).fill(-1); // -1 表示未知牌
            }
            log.debug(`Player ${playerId} card count: ${count}`);
        }
    }

    /**
     * 获取玩家手牌数量
     */
    public getPlayerCardCount(playerId: string): number {
        const player = this.players.get(playerId);
        return player ? player.cardCount : 0;
    }

    /**
     * 设置玩家分数
     */
    public setPlayerScore(playerId: string, score: number): void {
        const player = this.players.get(playerId);
        if (player) {
            player.score = score;
            log.debug(`Player ${playerId} score: ${score}`);
        }
    }

    /**
     * 获取玩家分数
     */
    public getPlayerScore(playerId: string): number {
        const player = this.players.get(playerId);
        return player ? player.score : 0;
    }

    /**
     * 批量设置玩家分数
     */
    public setScores(scores: { [playerId: string]: number }): void {
        for (const [playerId, score] of Object.entries(scores)) {
            this.setPlayerScore(playerId, score);
        }
        log.debug(`Scores updated for ${Object.keys(scores).length} players`);
    }

    /**
     * 获取所有分数
     */
    public getAllScores(): Map<string, number> {
        const scores = new Map<string, number>();
        for (const [playerId, player] of this.players) {
            scores.set(playerId, player.score);
        }
        return scores;
    }

    /**
     * 设置玩家游戏状态
     */
    public setPlayerState(playerId: string, state: PlayerState): void {
        const player = this.players.get(playerId);
        if (player) {
            player.state = state;
            log.debug(`Player ${playerId} state: ${state}`);
        }
    }

    /**
     * 获取玩家游戏状态
     */
    public getPlayerState(playerId: string): PlayerState {
        const player = this.players.get(playerId);
        return player ? player.state : PlayerState.WAITING;
    }

    /**
     * 设置玩家是否是庄家
     */
    public setPlayerIsDealer(playerId: string, isDealer: boolean): void {
        // 先清除所有玩家的庄家状态
        for (const player of this.players.values()) {
            player.isDealer = false;
        }
        // 设置新庄家
        const player = this.players.get(playerId);
        if (player) {
            player.isDealer = isDealer;
            log.debug(`Player ${playerId} is dealer: ${isDealer}`);
        }
    }

    /**
     * 检查玩家是否是庄家
     */
    public isPlayerDealer(playerId: string): boolean {
        const player = this.players.get(playerId);
        return player ? player.isDealer : false;
    }

    /**
     * 设置玩家回合状态
     */
    public setPlayerTurn(playerId: string, isTurn: boolean): void {
        const player = this.players.get(playerId);
        if (player) {
            player.isTurn = isTurn;
            log.debug(`Player ${playerId} turn: ${isTurn}`);
        }
    }

    /**
     * 检查是否轮到玩家
     */
    public isPlayerTurn(playerId: string): boolean {
        const player = this.players.get(playerId);
        return player ? player.isTurn : false;
    }

    // ==================== 托管状态管理 ====================

    /**
     * 设置玩家托管状态
     * @param playerId 玩家ID
     * @param isAuto 是否托管
     * @param reason 托管原因
     */
    public setPlayerAuto(playerId: string, isAuto: boolean, reason?: 'manual' | 'timeout' | 'disconnect'): void {
        const player = this.players.get(playerId);
        if (!player) {
            log.warn(`Player ${playerId} not found for auto mode`);
            return;
        }

        player.isAuto = isAuto;
        player.autoReason = reason;

        log.debug(`Player ${playerId} auto mode: ${isAuto} (${reason || 'manual'})`);

        // 触发事件通知UI更新
        EventCenter.emit(GameEvents.PLAYER_AUTO_CHANGED, {
            playerId,
            isAuto,
            reason
        });
    }

    /**
     * 获取玩家托管状态
     * @param playerId 玩家ID
     * @returns 是否托管中
     */
    public isPlayerAuto(playerId: string): boolean {
        const player = this.players.get(playerId);
        return player ? player.isAuto : false;
    }

    /**
     * 获取我的托管状态
     * @returns 是否托管中
     */
    public isMyAuto(): boolean {
        return this.isPlayerAuto(this.myPlayerId);
    }

    /**
     * 获取玩家托管原因
     * @param playerId 玩家ID
     * @returns 托管原因
     */
    public getPlayerAutoReason(playerId: string): 'manual' | 'timeout' | 'disconnect' | undefined {
        const player = this.players.get(playerId);
        return player ? player.autoReason : undefined;
    }

    /**
     * 设置我的手牌（用于重连恢复）
     */
    public setHandCards(cards: number[]): void {
        if (this.myPlayerId) {
            this.setPlayerHandCards(this.myPlayerId, cards);
            this.myHandCards = [...cards];
        } else {
            // 如果 myPlayerId 还没设置，先临时保存
            log.debug(`Hand cards set (myPlayerId not yet set): ${cards.length} cards`);
            // 创建一个临时存储
            this._pendingHandCards = [...cards];
            this.myHandCards = [...cards];
        }
    }

    private _pendingHandCards: number[] = [];

    /**
     * 设置玩家游戏状态（用于重连恢复）
     */
    public setPlayerGameState(playerId: string, state: {
        handCardCount: number;
        hasPlayed: boolean;
        playedCardCount: number;
        isAuto: boolean;
    }): void {
        let player = this.players.get(playerId);
        if (!player) {
            // 如果玩家不存在，创建一个
            player = {
                playerId,
                handCards: Array(state.handCardCount).fill(-1),
                cardCount: state.handCardCount,
                score: 0,
                state: state.hasPlayed ? PlayerState.IDLE : PlayerState.WAITING,
                isDealer: false,
                isTurn: false,
                isAuto: state.isAuto,
                autoReason: state.isAuto ? 'disconnect' : undefined
            };
            this.players.set(playerId, player);
        } else {
            player.cardCount = state.handCardCount;
            player.state = state.hasPlayed ? PlayerState.IDLE : PlayerState.WAITING;
            player.isAuto = state.isAuto;
            if (state.isAuto) {
                player.autoReason = 'disconnect';
            } else {
                player.autoReason = undefined;
            }
        }
        log.debug(`Player ${playerId} game state restored: cardCount=${state.handCardCount}, hasPlayed=${state.hasPlayed}, isAuto=${state.isAuto}`);
    }

    // ==================== 游戏状态管理 ====================

    /**
     * 设置游戏状态
     */
    public setGameState(state: TheDecreeGameState | string): void {
        if (typeof state === 'string') {
            this.gameState = state as TheDecreeGameState;
        } else {
            this.gameState = state;
        }
        log.debug(`Game state updated: ${this.gameState}`);
    }

    /**
     * 获取游戏状态
     */
    public getGameState(): TheDecreeGameState {
        return this.gameState;
    }

    /**
     * 设置当前回合数
     */
    public setCurrentRound(round: number): void {
        this.currentRound = round;
        log.debug(`Current round: ${round}`);
    }

    /**
     * 设置回合数（别名，用于重连）
     */
    public setRoundNumber(round: number): void {
        this.setCurrentRound(round);
    }

    /**
     * 获取当前回合数
     */
    public getCurrentRound(): number {
        return this.currentRound;
    }

    /**
     * 设置游戏是否激活
     */
    public setGameActive(active: boolean): void {
        this.isGameActive = active;
        log.debug(`Game active: ${active}`);
    }

    /**
     * 检查游戏是否激活
     */
    public isActive(): boolean {
        return this.isGameActive;
    }

    // ==================== 手牌管理 ====================

    /**
     * 设置我的手牌
     */
    public setMyHandCards(cards: number[]): void {
        this.myHandCards = [...cards];
        if (this.myPlayerId) {
            this.setPlayerHandCards(this.myPlayerId, cards);
            this._pendingHandCards = [];
        } else {
            this._pendingHandCards = [...cards];
        }
        log.debug(`My hand cards updated: ${cards.length} cards`);
    }

    /**
     * 获取我的手牌
     */
    public getMyHandCards(): number[] {
        const player = this.players.get(this.myPlayerId);
        if (player && Array.isArray(player.handCards)) {
            return [...player.handCards];
        }
        if (this._pendingHandCards.length > 0) {
            return [...this._pendingHandCards];
        }
        return Array.isArray(this.myHandCards) ? [...this.myHandCards] : [];
    }

    /**
     * 移除我的手牌（出牌后）
     */
    public removeMyHandCards(cards: number[]): void {
        const myCards = this.getMyHandCards();
        for (const card of cards) {
            const index = myCards.indexOf(card);
            if (index !== -1) {
                myCards.splice(index, 1);
            }
        }
        this.setMyHandCards(myCards);
        log.debug(`Removed ${cards.length} cards, remaining: ${myCards.length}`);
    }

    /**
     * 添加手牌（补牌后）
     */
    public addMyHandCards(cards: number[]): void {
        const myCards = this.getMyHandCards();
        myCards.push(...cards);
        this.setMyHandCards(myCards);
        log.debug(`Added ${cards.length} cards, total: ${myCards.length}`);
    }

    /**
     * 获取我的手牌数量
     */
    public getMyHandCardCount(): number {
        return this.getMyHandCards().length;
    }

    // ==================== 公共牌管理 ====================

    /**
     * 设置公共牌
     */
    public setCommunityCards(cards: number[]): void {
        this.communityCards = [...cards];
        log.debug(`Community cards updated: ${cards.length} cards`);
    }

    /**
     * 获取公共牌
     */
    public getCommunityCards(): number[] {
        return [...this.communityCards];
    }

    /**
     * 设置牌堆大小
     */
    public setDeckSize(size: number): void {
        this.deckSize = size;
        log.debug(`Deck size: ${size}`);
    }

    /**
     * 获取牌堆大小
     */
    public getDeckSize(): number {
        return this.deckSize;
    }

    // ==================== 庄家管理 ====================

    /**
     * 设置庄家ID
     */
    public setDealerId(dealerId: string): void {
        this.dealerId = dealerId;
        log.debug(`Dealer ID: ${dealerId}`);
    }

    /**
     * 获取庄家ID
     */
    public getDealerId(): string {
        return this.dealerId;
    }

    /**
     * 设置本回合要出的牌数
     */
    public setCardsToPlay(count: number): void {
        this.cardsToPlay = count;
        log.debug(`Cards to play: ${count}`);
    }

    /**
     * 获取本回合要出的牌数
     */
    public getCardsToPlay(): number {
        return this.cardsToPlay;
    }

    // ==================== 出牌记录管理 ====================

    /**
     * 添加出牌记录
     */
    public addPlayRecord(playerId: string, cards: number[]): void {
        const record: PlayRecord = {
            playerId,
            cards: [...cards],
            cardCount: cards.length,
            timestamp: Date.now()
        };
        this.currentRoundPlays.push(record);
        this.lastPlayedCards = [...cards];
        this.lastPlayerId = playerId;
        log.debug(`Play record added: ${playerId} played ${cards.length} cards`);
    }

    /**
     * 获取当前回合的出牌记录
     */
    public getCurrentRoundPlays(): PlayRecord[] {
        return [...this.currentRoundPlays];
    }

    /**
     * 获取最后出的牌
     */
    public getLastPlayedCards(): number[] {
        return [...this.lastPlayedCards];
    }

    /**
     * 获取最后出牌的玩家ID
     */
    public getLastPlayerId(): string {
        return this.lastPlayerId;
    }

    /**
     * 清空当前回合的出牌记录（新回合开始时）
     */
    public clearCurrentRoundPlays(): void {
        this.currentRoundPlays = [];
        this.lastPlayedCards = [];
        this.lastPlayerId = '';
        log.debug('Current round plays cleared');
    }

    // ==================== 回合历史管理 ====================

    /**
     * 添加回合历史记录
     */
    public addRoundHistory(history: RoundHistory): void {
        this.roundHistory.push(history);
        log.debug(`Round history added: Round ${history.roundNumber}`);
    }

    /**
     * 获取回合历史
     */
    public getRoundHistory(): RoundHistory[] {
        return [...this.roundHistory];
    }

    /**
     * 获取指定回合的历史
     */
    public getRoundHistoryByNumber(roundNumber: number): RoundHistory | undefined {
        return this.roundHistory.find(h => h.roundNumber === roundNumber);
    }

    /**
     * 获取最后一个回合的历史
     */
    public getLastRoundHistory(): RoundHistory | undefined {
        return this.roundHistory[this.roundHistory.length - 1];
    }

    // ==================== 重置和清理 ====================

    /**
     * 重置游戏状态（新游戏开始时）
     */
    public resetGame(): void {
        log.debug('Resetting game state...');

        this.gameState = TheDecreeGameState.SETUP;
        this.currentRound = 0;
        this.isGameActive = false;

        // 清空玩家数据
        this.players.clear();
        this.myPlayerId = '';

        this.communityCards = [];
        this.deckSize = 0;

        this.dealerId = '';
        this.cardsToPlay = 0;

        this.currentRoundPlays = [];
        this.roundHistory = [];
        this.lastPlayedCards = [];
        this.lastPlayerId = '';

        log.debug('Game state reset complete');
    }

    /**
     * 重置回合状态（新回合开始时）
     */
    public resetRound(): void {
        log.debug('Resetting round state...');

        this.clearCurrentRoundPlays();
        this.cardsToPlay = 0;

        log.debug('Round state reset complete');
    }

    /**
     * 完全清空所有数据（离开房间时）
     */
    public clear(): void {
        log.debug('Clearing all data...');
        this.resetGame();
        log.debug('All data cleared');
    }

    // ==================== 调试和工具方法 ====================

    /**
     * 获取完整的游戏状态快照（用于调试）
     */
    public getSnapshot(): any {
        return {
            gameState: this.gameState,
            currentRound: this.currentRound,
            isGameActive: this.isGameActive,
            myHandCards: this.myHandCards,
            communityCards: this.communityCards,
            deckSize: this.deckSize,
            dealerId: this.dealerId,
            cardsToPlay: this.cardsToPlay,
            currentRoundPlays: this.currentRoundPlays,
            lastPlayedCards: this.lastPlayedCards,
            lastPlayerId: this.lastPlayerId,
            scores: this.getScoresSnapshot(),
            playerCardCounts: this.getPlayerCardCountsSnapshot(),
            playerTurnState: this.getPlayerTurnStateSnapshot(),
            roundHistoryCount: this.roundHistory.length
        };
    }

    /**
     * 打印当前状态（用于调试）
     */
    public printState(): void {
        log.debug('========== Current State ==========');
        log.debug('Game State:', this.gameState);
        log.debug('Round:', this.currentRound);
        log.debug('Active:', this.isGameActive);
        log.debug('My Hand:', this.myHandCards.length, 'cards');
        log.debug('Community:', this.communityCards.length, 'cards');
        log.debug('Dealer:', this.dealerId);
        log.debug('Cards to Play:', this.cardsToPlay);
        log.debug('Scores:', this.getScoresSnapshot());
        log.debug('=====================================');
    }

    private getScoresSnapshot(): { [playerId: string]: number } {
        const scores: { [playerId: string]: number } = {};
        for (const [playerId, player] of this.players) {
            scores[playerId] = player.score;
        }
        return scores;
    }

    private getPlayerCardCountsSnapshot(): { [playerId: string]: number } {
        const cardCounts: { [playerId: string]: number } = {};
        for (const [playerId, player] of this.players) {
            cardCounts[playerId] = player.cardCount;
        }
        return cardCounts;
    }

    private getPlayerTurnStateSnapshot(): { [playerId: string]: boolean } {
        const turnState: { [playerId: string]: boolean } = {};
        for (const [playerId, player] of this.players) {
            turnState[playerId] = player.isTurn;
        }
        return turnState;
    }
}
