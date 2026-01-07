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
        player.seatIndex = this.players.size;

        // 第一个玩家是房主
        if (this.players.size === 0) {
            this.hostId = player.id;
            player.isHost = true;
            player.isReady = true;
        }

        this.players.set(player.id, player);
        this.updateActivity();

        console.log(`[Room ${this.id}] Player ${player.name} joined (${this.players.size}/${this.maxPlayers})`);

        return true;
    }

    /**
     * 移除玩家
     */
    public removePlayer(playerId: string): PlayerSession | null {
        const player = this.players.get(playerId);
        if (!player) return null;

        this.players.delete(playerId);
        player.roomId = null;

        console.log(`[Room ${this.id}] Player ${player.name} left (${this.players.size}/${this.maxPlayers})`);

        // 如果房主离开，转移房主权限
        if (this.hostId === playerId && this.players.size > 0) {
            const newHost = Array.from(this.players.values())[0];
            newHost.isHost = true;
            this.hostId = newHost.id;
            console.log(`[Room ${this.id}] Host transferred to ${newHost.name}`);
        }

        this.updateActivity();

        return player;
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
     */
    public isAllPlayersReady(): boolean {
        if (this.players.size < 2) return false;

        for (const player of this.players.values()) {
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

        // 重置玩家状态
        for (const player of this.players.values()) {
            player.isReady = false;
        }

        this.state = RoomState.WAITING;

        // Cleanup game
        if (this.theDecreeGame) {
            this.theDecreeGame.cleanup();
            this.theDecreeGame = null;
        }
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
                    for (const player of this.theDecreeGame.getAllPlayers()) {
                        this.sendToPlayer(player.id, ServerMessageType.DEAL_CARDS, {
                            playerId: player.id,
                            handCards: player.handCards
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
                setTimeout(() => this.endGame(), 5000);
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
        if (!this.theDecreeGame) {
            this.sendToPlayer(playerId, ServerMessageType.ERROR, {
                code: 'GAME_NOT_STARTED',
                message: 'Game has not started yet'
            });
            return false;
        }

        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }

        console.log(`[Room ${this.id}] Player ${player.name} ${isAuto ? 'enabled' : 'disabled'} auto mode`);
        this.theDecreeGame.setPlayerAuto(playerId, isAuto, 'manual');

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
