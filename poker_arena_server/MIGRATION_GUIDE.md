# 客户端到服务器迁移指南

## 🎯 迁移目标

将 `TheDecreeMode` 的游戏逻辑从客户端迁移到服务器，保留客户端的 UI 和显示功能。

## 📋 迁移检查清单

### Phase 1: 准备共享代码

#### ✅ 可以直接复制的文件

| 源文件 | 目标位置 | 需要修改 |
|--------|---------|---------|
| `TexasHoldEmEvaluator.ts` | `src/game/TexasHoldEmEvaluator.ts` | ❌ 不需要 |
| `HandTypeHelper.ts` | `src/game/HandTypeHelper.ts` | ❌ 不需要 |
| `Player.ts` | `src/game/Player.ts` | ⚠️ 移除 UI 依赖 |
| `CardConst.ts` | `src/game/CardConst.ts` | ❌ 不需要 |

### Phase 2: 拆分 TheDecreeMode

`TheDecreeMode.ts` (~1200 行) 需要拆分为：

#### 🔵 保留在服务器的部分

```typescript
// src/game/TheDecreeGameMode.ts

✅ 保留：
- state: GameState                      // 游戏状态机
- currentRound: RoundState              // 回合状态
- deck: number[]                        // 牌堆
- communityCards: number[]              // 公共牌
- playerManager: PlayerManager          // 玩家管理

✅ 保留方法：
- initializeDeck()                      // 初始化牌堆
- shuffleDeck()                         // 洗牌
- drawCard()                            // 抓牌
- dealCards()                           // 发牌
- isValidPlay()                         // 验证出牌
- playCards()                           // 处理出牌
- dealerCall()                          // 庄家叫牌
- processShowdown()                     // 摊牌
- calculateScores()                     // 计分
- refillHands()                         // 补牌
- selectFirstDealer()                   // 选首庄
- startNewRound()                       // 开始回合
- update()                              // 游戏循环
```

#### 🟢 保留在客户端的部分

```typescript
// poker_arena_client/.../TheDecreeModeClient.ts

✅ 保留：
- displayCards()                        // 显示牌面
- displayCommunityCards()               // 显示公共牌
- displayHandTypes()                    // 显示牌型
- updatePlayerHandDisplay()             // 更新手牌显示
- updateAllScoresDisplay()              // 更新分数显示
- showUI() / hideUI()                   // UI 显示/隐藏
- adjustPlayerLayout()                  // 调整布局

⚠️ 改为接收服务器消息：
- onDealCards(cards)                    // 收到发牌消息
- onCommunityCards(cards)               // 收到公共牌消息
- onPlayerPlayed(playerId, cardCount)   // 收到玩家出牌消息
- onShowdown(results)                   // 收到摊牌消息
- onRoundEnd(winnerId, scores)          // 收到回合结束消息
```

## 🔄 迁移步骤详解

### Step 1: 创建游戏目录

```bash
cd poker_arena_server/src
mkdir game
```

### Step 2: 复制纯逻辑文件

```bash
# 从客户端复制到服务器
cp poker_arena_client/assets/Scripts/Core/GameMode/TexasHoldEmEvaluator.ts \
   poker_arena_server/src/game/

cp poker_arena_client/assets/Scripts/Core/GameMode/HandTypeHelper.ts \
   poker_arena_server/src/game/

cp poker_arena_client/assets/Scripts/Card/CardConst.ts \
   poker_arena_server/src/game/
```

### Step 3: 复制并调整 Player.ts

```typescript
// poker_arena_server/src/game/Player.ts

// ❌ 移除这些导入（Cocos Creator 依赖）
// import { Vec3 } from 'cc';

// ✅ 保留核心数据和方法
export class Player {
    // 基础信息
    protected _info: PlayerInfo;

    // 游戏状态
    protected _handCards: number[] = [];
    protected _score: number = 0;
    protected _state: PlayerState = PlayerState.WAITING;

    // 所有数据操作方法都保留
    setHandCards(cards: number[]): void { ... }
    addCards(cards: number[]): void { ... }
    removeCards(cards: number[]): void { ... }
    // ...
}
```

### Step 4: 创建服务器版 TheDecreeGameMode

#### 4.1 基础结构

```typescript
// poker_arena_server/src/game/TheDecreeGameMode.ts

import { TexasHoldEmEvaluator, TexasHandResult } from './TexasHoldEmEvaluator';
import { HandTypeHelper } from './HandTypeHelper';
import { CardSuit, CardPoint } from './CardConst';
import { Player, TheDecreePlayer, PlayerInfo } from './Player';

export enum GameState {
    SETUP = "setup",
    FIRST_DEALER_SELECTION = "first_dealer",
    DEALER_CALL = "dealer_call",
    PLAYER_SELECTION = "player_selection",
    SHOWDOWN = "showdown",
    SCORING = "scoring",
    REFILL = "refill",
    GAME_OVER = "game_over"
}

interface RoundState {
    roundNumber: number;
    dealerId: string;
    cardsToPlay: number;
    playerPlays: Map<string, number[]>;
    roundWinnerId: string | null;
    roundLoserId: string | null;
    handResults: Map<string, TexasHandResult> | null;
}

export class TheDecreeGameMode {
    private state: GameState = GameState.SETUP;
    private players: Map<string, TheDecreePlayer> = new Map();
    private communityCards: number[] = [];
    private deck: number[] = [];
    private currentRound: RoundState | null = null;

    // 事件回调（用于通知 GameServer 发送消息）
    private onStateChange?: (state: GameState) => void;
    private onDealCards?: (playerId: string, cards: number[]) => void;
    private onCommunityCards?: (cards: number[]) => void;
    // ... 更多事件回调

    constructor() {
        // 初始化
    }

    // ======== 从客户端迁移的方法 ========

    // 从 TheDecreeMode.ts:767-802 复制
    private initializeDeck(): void { ... }
    private shuffleDeck(): void { ... }
    private drawCard(): number { ... }

    // 从 TheDecreeMode.ts:290-315 复制并调整
    public dealCards(): void {
        // 发 4 张公共牌
        this.communityCards = [
            this.drawCard(),
            this.drawCard(),
            this.drawCard(),
            this.drawCard()
        ];

        // 广播公共牌
        if (this.onCommunityCards) {
            this.onCommunityCards(this.communityCards);
        }

        // 发 5 张手牌给每个玩家
        for (const [playerId, player] of this.players) {
            const handCards = [
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard(),
                this.drawCard()
            ];
            player.setHandCards(handCards);

            // 只发给对应玩家（私密）
            if (this.onDealCards) {
                this.onDealCards(playerId, handCards);
            }
        }

        this.state = GameState.FIRST_DEALER_SELECTION;
        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    // 从 TheDecreeMode.ts:393-410 复制
    public isValidPlay(cards: number[], playerId: string): boolean { ... }

    // 从 TheDecreeMode.ts:412-440 复制并调整
    public playCards(cards: number[], playerId: string): boolean { ... }

    // 从 TheDecreeMode.ts:577-591 复制
    public dealerCall(cardsToPlay: 1 | 2 | 3, dealerId: string): boolean { ... }

    // 从 TheDecreeMode.ts:595-634 复制
    private processShowdown(): void { ... }

    // 从 TheDecreeMode.ts:639-676 复制
    private calculateScores(results: Map<string, TexasHandResult>): void { ... }

    // 从 TheDecreeMode.ts:716-763 复制
    public refillHands(): void { ... }

    // 从 TheDecreeMode.ts:152-204 复制
    public update(deltaTime: number): void { ... }
}
```

#### 4.2 事件回调模式

服务器版需要通过回调通知 `GameServer` 发送消息：

```typescript
// 在 GameRoom.ts 中初始化游戏模式
this.gameMode = new TheDecreeGameMode();

// 设置事件回调
this.gameMode.onDealCards = (playerId, cards) => {
    this.sendToPlayer(playerId, ServerMessageType.DEAL_CARDS, {
        playerId,
        handCards: cards
    });
};

this.gameMode.onCommunityCards = (cards) => {
    this.broadcast(ServerMessageType.COMMUNITY_CARDS, { cards });
};

this.gameMode.onPlayerPlayed = (playerId, cardCount) => {
    this.broadcast(ServerMessageType.PLAYER_PLAYED, {
        playerId,
        cardCount
    });
};

this.gameMode.onShowdown = (results) => {
    this.broadcast(ServerMessageType.SHOWDOWN, { results });
};
```

### Step 5: 集成到 GameServer

在 `GameServer.ts` 中实现游戏逻辑调用：

```typescript
// GameServer.ts

private startGame(room: GameRoom): void {
    if (!room.startGame()) {
        return;
    }

    // 广播游戏开始
    room.broadcast(ServerMessageType.GAME_START, {
        players: room.getPlayersInfo()
    });

    // 初始化游戏并发牌
    room.initGameMode();  // 新增方法
    room.dealCards();     // 新增方法
}

private handleDealerCall(socket: Socket, data: DealerCallRequest): void {
    const player = this.players.get(socket.id);
    if (!player || !player.roomId) {
        this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
        return;
    }

    const room = this.rooms.get(player.roomId);
    if (!room || !room.gameMode) {
        return;
    }

    // 验证是否是庄家
    if (room.gameMode.getCurrentDealerId() !== player.id) {
        this.sendError(socket, ErrorCode.NOT_DEALER, 'You are not the dealer');
        return;
    }

    // 调用游戏逻辑
    const success = room.gameMode.dealerCall(data.cardsToPlay, player.id);
    if (!success) {
        this.sendError(socket, ErrorCode.INVALID_PLAY, 'Invalid dealer call');
    }
}

private handlePlayCards(socket: Socket, data: PlayCardsRequest): void {
    const player = this.players.get(socket.id);
    if (!player || !player.roomId) {
        this.sendError(socket, ErrorCode.GAME_NOT_STARTED, 'Not in a game');
        return;
    }

    const room = this.rooms.get(player.roomId);
    if (!room || !room.gameMode) {
        return;
    }

    // 调用游戏逻辑
    const success = room.gameMode.playCards(data.cards, player.id);
    if (!success) {
        this.sendError(socket, ErrorCode.INVALID_PLAY, 'Invalid play');
    }
}
```

### Step 6: 更新 GameRoom

在 `GameRoom.ts` 中添加游戏模式管理：

```typescript
import { TheDecreeGameMode, GameState } from '../game/TheDecreeGameMode';

export class GameRoom {
    // ...现有代码...

    public gameMode: TheDecreeGameMode | null = null;

    public initGameMode(): void {
        this.gameMode = new TheDecreeGameMode();

        // 初始化玩家
        const playerInfos = this.getPlayersInfo();
        this.gameMode.initGame(playerInfos);

        // 设置事件回调
        this.setupGameModeCallbacks();
    }

    private setupGameModeCallbacks(): void {
        if (!this.gameMode) return;

        this.gameMode.onDealCards = (playerId, cards) => {
            this.sendToPlayer(playerId, ServerMessageType.DEAL_CARDS, {
                playerId,
                handCards: cards
            });
        };

        this.gameMode.onCommunityCards = (cards) => {
            this.broadcast(ServerMessageType.COMMUNITY_CARDS, { cards });
        };

        // ... 设置其他回调 ...
    }

    public dealCards(): void {
        if (this.gameMode) {
            this.gameMode.dealCards();
        }
    }

    public update(deltaTime: number): void {
        if (this.gameMode && this.state === RoomState.PLAYING) {
            this.gameMode.update(deltaTime);
        }
    }
}
```

## 🎨 客户端改造

### 改造 TheDecreeModeClient

```typescript
// poker_arena_client/.../TheDecreeModeClient.ts

import { io, Socket } from 'socket.io-client';

export class TheDecreeModeClient extends GameModeBase {
    private socket: Socket | null = null;
    private roomId: string = '';
    private playerId: string = '';

    // ❌ 移除所有游戏逻辑
    // ❌ 移除 deck, playerManager 等

    // ✅ 保留 UI 相关
    private communityCardsDisplay: any;

    public onEnter(): void {
        // 连接服务器
        this.connectToServer();

        // 显示 UI
        this.showUI();
    }

    private connectToServer(): void {
        this.socket = io('http://localhost:3000');

        // 监听服务器消息
        this.socket.on('deal_cards', (data) => {
            this.onDealCards(data);
        });

        this.socket.on('community_cards', (data) => {
            this.onCommunityCards(data);
        });

        this.socket.on('player_played', (data) => {
            this.onPlayerPlayed(data);
        });

        this.socket.on('showdown', (data) => {
            this.onShowdown(data);
        });

        // ... 其他消息监听 ...
    }

    // ✅ UI 更新方法（保留）
    private onDealCards(data: DealCardsEvent): void {
        // 显示手牌
        this.displayPlayerCards(data.handCards);
    }

    private onCommunityCards(data: CommunityCardsEvent): void {
        // 显示公共牌
        this.displayCommunityCards(data.cards);
    }

    private onPlayerPlayed(data: PlayerPlayedEvent): void {
        // 更新玩家状态（不显示具体牌面）
        this.updatePlayerStatus(data.playerId, 'played');
    }

    private onShowdown(data: ShowdownEvent): void {
        // 显示所有玩家的牌和牌型
        this.displayShowdownResults(data.results);
    }

    // 玩家操作（发送到服务器）
    public onPlayerClickDealerCall(cardsToPlay: 1 | 2 | 3): void {
        this.socket?.emit('dealer_call', {
            roomId: this.roomId,
            playerId: this.playerId,
            cardsToPlay
        });
    }

    public onPlayerClickPlayCards(cards: number[]): void {
        this.socket?.emit('play_cards', {
            roomId: this.roomId,
            playerId: this.playerId,
            cards
        });
    }
}
```

## ✅ 迁移验证清单

### 服务器端
- [ ] `TexasHoldEmEvaluator` 复制成功，测试通过
- [ ] `Player` 类复制成功，移除 UI 依赖
- [ ] `TheDecreeGameMode` 创建完成
- [ ] 牌堆管理逻辑工作正常
- [ ] 游戏状态机工作正常
- [ ] 计分系统工作正常
- [ ] 事件回调正确触发
- [ ] GameServer 集成完成
- [ ] 消息广播正常

### 客户端
- [ ] Socket.IO 连接成功
- [ ] 收到发牌消息并显示
- [ ] 收到公共牌消息并显示
- [ ] 玩家操作发送成功
- [ ] 摊牌结果显示正确
- [ ] UI 更新流畅

### 测试用例
- [ ] 创建房间 → 加入房间 → 准备 → 开始游戏
- [ ] 发牌正确（私密性验证）
- [ ] 庄家叫牌 → 玩家出牌 → 摊牌
- [ ] 计分正确
- [ ] 多回合游戏流程
- [ ] 断线重连

## 🐛 常见问题

### Q: 导入路径错误
```typescript
// ❌ 错误
import { Vec3 } from 'cc';

// ✅ 正确（服务器端）
// 移除 Cocos Creator 相关导入
```

### Q: 类型定义不一致
```typescript
// 确保客户端和服务器使用相同的 Messages.ts
// 考虑创建 poker_arena_shared 目录
```

### Q: 游戏循环怎么办？
```typescript
// GameRoom.ts 需要定时调用 update()
private gameLoopTimer: NodeJS.Timeout | null = null;

public startGameLoop(): void {
    this.gameLoopTimer = setInterval(() => {
        this.update(0.1); // 100ms
    }, 100);
}
```

## 📝 最后检查

迁移完成后，确保：

1. ✅ 服务器可以独立运行游戏逻辑
2. ✅ 客户端只负责显示，不进行游戏计算
3. ✅ 所有关键数据（牌堆、手牌、分数）在服务器端
4. ✅ 消息协议清晰，易于调试
5. ✅ 将来迁移到 Go 时，协议不需要改变
