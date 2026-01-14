import { v4 as uuidv4 } from 'uuid';
import { PlayerSession } from './PlayerSession';
import { ServerMessageType } from '../types/Messages';
import { TheDecreeMode, GameState as TheDecreeGameState, TheDecreeEventCallbacks } from '../game/the_decree/TheDecreeMode';
import { TexasHandResult } from '../game/the_decree/TexasHoldEmEvaluator';
import { HandTypeHelper } from '../game/the_decree/HandTypeHelper';

/**
 * 房间状态
 */
export enum RoomState {
    WAITING = 'waiting',      // 等待玩家
    READY = 'ready',          // 准备开始
    PLAYING = 'playing',      // 游戏中
    FINISHED = 'finished'     // 已结束
}

/**
 * 游戏房间
 * 管理一局游戏的所有玩家和游戏状态
 */
export class GameRoom {
    public id: string;
    public gameMode: string;
    public maxPlayers: number;
    public state: RoomState = RoomState.WAITING;

    private players: Map<string, PlayerSession> = new Map();
    private hostId: string = '';
    private createdAt: number = Date.now();
    private lastActivityAt: number = Date.now();

    // 重启游戏时，记录哪些玩家点击了"再来一局"
    private playersWantRestart: Set<string> = new Set();

    // 记录玩家的托管状态（在游戏开始前设置）
    private playerAutoStates: Map<string, boolean> = new Map();

    // 游戏结束定时器
    private endGameTimer: NodeJS.Timeout | null = null;

    // 游戏实例
    private theDecreeGame: TheDecreeMode | null = null;

    constructor(gameMode: string, maxPlayers: number) {
        // 生成4位随机数字作为房间号
        this.id = this.generateRoomId();
        this.gameMode = gameMode;
        this.maxPlayers = maxPlayers;
    }

    /**
     * 生成4位数字房间号
     */
    private generateRoomId(): string {
        // 生成 1000-9999 之间的随机数
        const roomNumber = Math.floor(1000 + Math.random() * 9000);
        return roomNumber.toString();
    }

    /**
     * 添加玩家到房间
     */
    public addPlayer(player: PlayerSession): boolean {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        player.roomId = this.id;

        // 找到第一个空闲的座位索引
        player.seatIndex = this.findAvailableSeatIndex();

        // 第一个玩家是房主
        if (this.players.size === 0) {
            this.hostId = player.id;
            player.isHost = true;
            player.isReady = true;
        }

        this.players.set(player.id, player);
        this.updateActivity();

        console.log(`[Room ${this.id}] Player ${player.name} joined (${this.players.size}/${this.maxPlayers}), seatIndex: ${player.seatIndex}`);

        return true;
    }

    /**
     * 找到第一个空闲的座位索引
     */
    private findAvailableSeatIndex(): number {
        const occupiedSeats = new Set(
            Array.from(this.players.values()).map(p => p.seatIndex)
        );

        for (let i = 0; i < this.maxPlayers; i++) {
            if (!occupiedSeats.has(i)) {
                return i;
            }
        }

        // 如果所有座位都被占用，返回 players.size（这不应该发生）
        return this.players.size;
    }

    /**
     * 移除玩家
     * @returns { player: 被移除的玩家, newHostId: 新房主ID（如果房主变更） }
     */
    public removePlayer(playerId: string): { player: PlayerSession | null; newHostId: string | null } {
        const player = this.players.get(playerId);
        if (!player) return { player: null, newHostId: null };

        this.players.delete(playerId);
        player.roomId = null;

        console.log(`[Room ${this.id}] Player ${player.name} left (${this.players.size}/${this.maxPlayers})`);

        let newHostId: string | null = null;

        // 如果房主离开，转移房主权限
        if (this.hostId === playerId && this.players.size > 0) {
            const newHost = Array.from(this.players.values())[0];
            const oldHostId = this.hostId;
            newHost.isHost = true;
            newHost.isReady = true; // 新房主自动准备
            this.hostId = newHost.id;
            newHostId = newHost.id;
            console.log(`[Room ${this.id}] Host transferred from ${oldHostId} to ${newHost.name}`);
        }

        this.updateActivity();

        return { player, newHostId };
    }

    /**
     * 获取玩家
     */
    public getPlayer(playerId: string): PlayerSession | undefined {
        return this.players.get(playerId);
    }

    /**
     * 获取所有玩家
     */
    public getAllPlayers(): PlayerSession[] {
        return Array.from(this.players.values());
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this.players.size;
    }

    /**
     * 检查房间是否为空
     */
    public isEmpty(): boolean {
        return this.players.size === 0;
    }

    /**
     * 检查房间是否已满
     */
    public isFull(): boolean {
        return this.players.size >= this.maxPlayers;
    }

    /**
     * 设置玩家准备状态
     */
    public setPlayerReady(playerId: string, isReady: boolean): boolean {
        const player = this.players.get(playerId);
        if (!player) return false;

        player.isReady = isReady;
        this.updateActivity();

        return true;
    }

    /**
     * 检查所有玩家是否都准备好
     * 注意：房主不需要准备，只检查非房主玩家
     */
    public isAllPlayersReady(): boolean {
        if (this.players.size < 2) return false;

        for (const player of this.players.values()) {
            // 跳过房主
            console.log(`>>>>>>>>>>>>>>>>>>>>>> Checking if player ${player.name} is ready: ${player.isReady} (isHost: ${player.isHost})`);
            if (player.isHost) continue;

            if (!player.isReady) return false;
        }

        return true;
    }

    /**
     * 广播消息给房间内所有玩家
     */
    public broadcast(event: string, data: any, excludePlayerId?: string): void {
        for (const player of this.players.values()) {
            if (excludePlayerId && player.id === excludePlayerId) {
                continue;
            }
            player.emit(event, data);
        }
    }

    /**
     * 发送消息给单个玩家
     */
    public sendToPlayer(playerId: string, event: string, data: any): void {
        const player = this.players.get(playerId);
        if (player) {
            player.emit(event, data);
        }
    }

    /**
     * 获取所有玩家信息（用于广播）
     */
    public getPlayersInfo() {
        return Array.from(this.players.values()).map(p => p.getInfo());
    }

    /**
     * 获取房主ID
     */
    public getHostId(): string {
        return this.hostId;
    }

    /**
     * 更新活动时间
     */
    private updateActivity(): void {
        this.lastActivityAt = Date.now();
    }

    /**
     * 检查房间是否超时
     */
    public isIdle(timeoutMs: number): boolean {
        return Date.now() - this.lastActivityAt > timeoutMs;
    }

    /**
     * 启动游戏
     */
    public startGame(): boolean {
        if (this.state !== RoomState.WAITING && this.state !== RoomState.READY) {
            return false;
        }

        if (!this.isAllPlayersReady()) {
            return false;
        }

        this.state = RoomState.PLAYING;
        console.log(`[Room ${this.id}] Game started with ${this.players.size} players`);

        // Initialize TheDecree game
        if (this.gameMode === 'the_decree') {
            this.initTheDecreeGame();
        }

        return true;
    }

    /**
     * 结束游戏
     */
    public endGame(): void {
        this.state = RoomState.FINISHED;
        console.log(`[Room ${this.id}] Game ended`);

        // 清除定时器引用
        this.endGameTimer = null;

        // 不再重置玩家状态，因为玩家可能已经点击了"再来一局"并设置为已准备
        // 如果需要重置，应该在 restartGame() 中处理

        this.state = RoomState.WAITING;

        // Cleanup game
        if (this.theDecreeGame) {
            this.theDecreeGame.cleanup();
            this.theDecreeGame = null;
        }
    }

    /**
     * 重启游戏
     * 只清理游戏状态，不改变玩家准备状态（已经通过PLAYER_READY事件设置）
     */
    public restartGame(): boolean {
        console.log(`[Room ${this.id}] Cleaning up game state for restart...`);

        // 清除 endGame 定时器（如果存在）
        if (this.endGameTimer) {
            clearTimeout(this.endGameTimer);
            this.endGameTimer = null;
            console.log(`[Room ${this.id}] Cleared endGame timer`);
        }

        // 清理当前游戏
        if (this.theDecreeGame) {
            this.theDecreeGame.cleanup();
            this.theDecreeGame = null;
        }

        // 重置房间状态
        this.state = RoomState.WAITING;

        // 清空重启投票
        this.playersWantRestart.clear();

        console.log(`[Room ${this.id}] Game state cleaned up, ready for new game`);

        // 不再广播GAME_RESTART事件，因为玩家已经通过PLAYER_READY事件知道状态了
        // 玩家在点击"再来一局"时已经立即切换到ReadyStage

        return true;
    }

    /**
     * 玩家点击"再来一局"
     * @returns 是否所有玩家都已点击
     */
    public playerWantsRestart(playerId: string): boolean {
        this.playersWantRestart.add(playerId);
        console.log(`[Room ${this.id}] Player ${playerId} wants restart (${this.playersWantRestart.size}/${this.players.size})`);

        // 检查是否所有玩家都点击了
        return this.playersWantRestart.size >= this.players.size;
    }

    // ==================== TheDecree Game Integration ====================

    /**
     * Initialize TheDecree game with event callbacks
     */
    private initTheDecreeGame(): void {
        const callbacks: TheDecreeEventCallbacks = {
            onGameStarted: (communityCards, gameState) => {
                console.log(`[Room ${this.id}] Game started, community cards dealt`);
                console.log(`[Room ${this.id}] 📤 Broadcasting COMMUNITY_CARDS event to all players`);
                console.log(`[Room ${this.id}] Community cards:`, communityCards);

                // Broadcast community cards to all players
                this.broadcast(ServerMessageType.COMMUNITY_CARDS, {
                    cards: communityCards,
                    gameState: gameState
                });

                console.log(`[Room ${this.id}] ✓ COMMUNITY_CARDS event sent`);
            },

            onPlayerDealt: (playerId, cards) => {
                console.log(`[Room ${this.id}] 📤 Sending DEAL_CARDS event to player: ${playerId}`);
                console.log(`[Room ${this.id}] Cards count:`, cards.length);
                console.log(`[Room ${this.id}] Cards:`, cards);

                // Send private hand cards to each player
                this.sendToPlayer(playerId, ServerMessageType.DEAL_CARDS, {
                    playerId,
                    handCards: cards
                });

                console.log(`[Room ${this.id}] ✓ DEAL_CARDS event sent to ${playerId}`);
            },

            onRequestFirstDealerSelection: (gameState) => {
                console.log(`[Room ${this.id}] Requesting first dealer selection from all players`);

                this.broadcast(ServerMessageType.REQUEST_FIRST_DEALER_SELECTION, {
                    gameState: gameState
                });
            },

            onPlayerSelectedCard: (playerId) => {
                console.log(`[Room ${this.id}] Player ${playerId} selected a card`);

                this.broadcast(ServerMessageType.PLAYER_SELECTED_CARD, {
                    playerId
                });
            },

            onFirstDealerReveal: (dealerId, selections, gameState) => {
                console.log(`[Room ${this.id}] First dealer revealed: ${dealerId}`);

                // Convert Map to array for JSON serialization
                const selectionsArray = Array.from(selections.entries()).map(([playerId, card]) => ({
                    playerId,
                    card
                }));

                this.broadcast(ServerMessageType.FIRST_DEALER_REVEAL, {
                    dealerId,
                    selections: selectionsArray,
                    gameState: gameState
                });
            },

            onFirstDealerSelected: (dealerId, revealedCards) => {
                console.log(`[Room ${this.id}] First dealer: ${dealerId}`);

                this.broadcast(ServerMessageType.DEALER_SELECTED, {
                    dealerId,
                    roundNumber: 1
                });
            },

            onNewRound: (roundNumber, dealerId, gameState) => {
                console.log(`[Room ${this.id}] Round ${roundNumber} started, dealer: ${dealerId}`);

                this.broadcast(ServerMessageType.DEALER_SELECTED, {
                    dealerId,
                    roundNumber,
                    gameState: gameState
                });
            },

            onDealerCall: (dealerId, cardsToPlay, gameState) => {
                console.log(`[Room ${this.id}] Dealer ${dealerId} calls ${cardsToPlay} cards`);

                this.broadcast(ServerMessageType.DEALER_CALLED, {
                    dealerId,
                    cardsToPlay,
                    gameState: gameState
                });
            },

            onPlayerPlayed: (playerId, cardCount) => {
                console.log(`[Room ${this.id}] Player ${playerId} played ${cardCount} cards`);

                // Broadcast to other players (don't reveal cards)
                this.broadcast(ServerMessageType.PLAYER_PLAYED, {
                    playerId,
                    cardCount
                });
            },

            onShowdown: (results, gameState) => {
                console.log(`[Room ${this.id}] Showdown`);

                // Build showdown results
                const showdownResults = Array.from(results.entries()).map(([playerId, result]) => {
                    const player = this.theDecreeGame?.getPlayer(playerId);
                    return {
                        playerId,
                        cards: player?.playedCards || [],
                        handType: result.type,
                        handTypeName: HandTypeHelper.getChineseName(result.type),
                        score: HandTypeHelper.getScore(result.type),
                        isWinner: playerId === this.theDecreeGame?.getCurrentRound()?.roundWinnerId
                    };
                });

                this.broadcast(ServerMessageType.SHOWDOWN, {
                    results: showdownResults,
                    gameState: gameState
                });
            },

            onRoundEnd: (winnerId, loserId, scores, gameState) => {
                console.log(`[Room ${this.id}] Round end - Winner: ${winnerId}, Loser: ${loserId}`);

                // Convert Map to object for JSON serialization
                const scoresObj: { [key: string]: number } = {};
                scores.forEach((score, playerId) => {
                    scoresObj[playerId] = score;
                });

                this.broadcast(ServerMessageType.ROUND_END, {
                    winnerId,
                    loserId,
                    scores: scoresObj,
                    gameState: gameState
                });
            },

            onHandsRefilled: (deckSize) => {
                console.log(`[Room ${this.id}] Hands refilled, deck: ${deckSize} cards`);

                // Send updated hand cards to each player
                if (this.theDecreeGame) {
                    // Collect all players' hand counts
                    const handCounts: { [playerId: string]: number } = {};
                    for (const player of this.theDecreeGame.getAllPlayers()) {
                        handCounts[player.id] = player.handCards.length;
                    }

                    // Send each player their own cards + all players' hand counts
                    for (const player of this.theDecreeGame.getAllPlayers()) {
                        this.sendToPlayer(player.id, ServerMessageType.DEAL_CARDS, {
                            playerId: player.id,
                            handCards: player.handCards,
                            allHandCounts: handCounts
                        });
                    }
                }
            },

            onGameOver: (winnerId, scores, totalRounds, gameState) => {
                console.log(`[Room ${this.id}] Game over - Winner: ${winnerId}`);

                const scoresObj: { [key: string]: number } = {};
                scores.forEach((score, playerId) => {
                    scoresObj[playerId] = score;
                });

                this.broadcast(ServerMessageType.GAME_OVER, {
                    winnerId,
                    scores: scoresObj,
                    totalRounds,
                    gameState: gameState
                });

                // End game after a delay
                this.endGameTimer = setTimeout(() => this.endGame(), 5000);
            },

            onPlayerAutoChanged: (playerId, isAuto, reason) => {
                console.log(`[Room ${this.id}] Player ${playerId} auto mode changed: ${isAuto} (${reason || 'manual'})`);

                this.broadcast(ServerMessageType.PLAYER_AUTO_CHANGED, {
                    playerId,
                    isAuto,
                    reason
                });
            }
        };

        // Create game instance
        this.theDecreeGame = new TheDecreeMode(undefined, callbacks);

        // Initialize game with player info
        const playerInfos = this.getPlayersInfo();
        this.theDecreeGame.initGame(playerInfos);

        // Apply saved auto states before starting the game
        for (const [playerId, isAuto] of this.playerAutoStates) {
            console.log(`[Room ${this.id}] Applying saved auto state for player ${playerId}: ${isAuto}`);
            this.theDecreeGame.setPlayerAuto(playerId, isAuto, 'manual');
        }

        // Start game
        this.theDecreeGame.startGame();

        // Broadcast game start
        this.broadcast(ServerMessageType.GAME_START, {
            players: playerInfos
        });
    }

    /**
     * Handle player select card for first dealer
     */
    public handleSelectFirstDealerCard(playerId: string, card: number): boolean {
        console.log(`[GameRoom] ========== handleSelectFirstDealerCard ==========`);
        console.log(`[GameRoom] Player ID: ${playerId}`);
        console.log(`[GameRoom] Card: 0x${card.toString(16)}`);
        console.log(`[GameRoom] theDecreeGame exists: ${!!this.theDecreeGame}`);

        if (!this.theDecreeGame) {
            console.error(`[GameRoom] ✗ theDecreeGame not initialized`);
            return false;
        }

        const success = this.theDecreeGame.selectFirstDealerCard(playerId, card);
        console.log(`[GameRoom] selectFirstDealerCard result: ${success}`);

        if (!success) {
            this.sendToPlayer(playerId, ServerMessageType.ERROR, {
                code: 'INVALID_ACTION',
                message: 'Invalid card selection'
            });
        }

        return success;
    }

    /**
     * Handle dealer call action
     */
    public handleDealerCall(playerId: string, cardsToPlay: 1 | 2 | 3): boolean {
        if (!this.theDecreeGame) return false;

        const success = this.theDecreeGame.dealerCall(playerId, cardsToPlay);
        if (!success) {
            this.sendToPlayer(playerId, ServerMessageType.ERROR, {
                code: 'INVALID_ACTION',
                message: 'Invalid dealer call'
            });
        }

        return success;
    }

    /**
     * Handle player play cards action
     */
    public handlePlayCards(playerId: string, cards: number[]): boolean {
        if (!this.theDecreeGame) return false;

        const success = this.theDecreeGame.playCards(cards, playerId);
        if (!success) {
            this.sendToPlayer(playerId, ServerMessageType.ERROR, {
                code: 'INVALID_PLAY',
                message: 'Invalid card play'
            });
        }

        return success;
    }

    /**
     * Handle set auto mode action
     */
    public handleSetAuto(playerId: string, isAuto: boolean): boolean {
        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }

        console.log(`[Room ${this.id}] Player ${player.name} ${isAuto ? 'enabled' : 'disabled'} auto mode`);

        // 如果游戏已经开始，直接设置托管状态
        if (this.theDecreeGame) {
            this.theDecreeGame.setPlayerAuto(playerId, isAuto, 'manual');
        } else {
            // 如果游戏还没开始，保存托管状态，等游戏开始后应用
            this.playerAutoStates.set(playerId, isAuto);
            console.log(`[Room ${this.id}] Saved auto state for player ${player.name} (will apply when game starts)`);
        }

        return true;
    }

    /**
     * Get current game state
     */
    public getGameState(): any {
        if (!this.theDecreeGame) return null;

        const currentRound = this.theDecreeGame.getCurrentRound();
        return {
            state: this.theDecreeGame.getState(),
            roundNumber: currentRound?.roundNumber || 0,
            dealerId: currentRound?.dealerId,
            cardsToPlay: currentRound?.cardsToPlay,
            deckSize: this.theDecreeGame.getDeckSize()
        };
    }
}
