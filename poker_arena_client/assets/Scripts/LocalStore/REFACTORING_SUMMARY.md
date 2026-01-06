# LocalGameStore 重构总结

## 重构目标

将 LocalGameStore 从只存储"我的"游戏数据，升级为存储**所有玩家**的游戏数据，真正成为游戏状态的单一数据源。

## 数据层级架构

```
┌─────────────────────────────────────────────────┐
│          LocalUserStore                          │
│  账户信息（持久化，跨房间）                        │
│  - username, nickname, avatar                    │
│  - level, exp, token                             │
└─────────────────────────────────────────────────┘
                    ↓ 进入房间
┌─────────────────────────────────────────────────┐
│          LocalRoomStore                          │
│  房间玩家信息（临时，房间内）                      │
│  - PlayerInfo[]                                  │
│    ├─ id, name, avatar                           │
│    ├─ seatIndex                                  │
│    └─ isReady, isHost                            │
└─────────────────────────────────────────────────┘
                    ↓ 开始游戏
┌─────────────────────────────────────────────────┐
│          LocalGameStore                          │
│  游戏状态数据（更临时，游戏中）                    │
│  - PlayerGameData[]                              │
│    ├─ playerId (对应 PlayerInfo.id)              │
│    ├─ handCards, cardCount                       │
│    ├─ score, state                               │
│    └─ isDealer, isTurn                           │
│  - 游戏全局状态                                   │
│    ├─ gameState, currentRound                    │
│    ├─ communityCards, dealerId                   │
│    └─ roundHistory                               │
└─────────────────────────────────────────────────┘
```

## 重构内容

### 1. 新增数据结构

```typescript
// 玩家游戏数据
export interface PlayerGameData {
    playerId: string;          // 玩家ID
    handCards: number[];       // 手牌
    cardCount: number;         // 手牌数量
    score: number;             // 分数
    state: PlayerState;        // 游戏状态
    isDealer: boolean;         // 是否庄家
    isTurn: boolean;           // 是否轮到
}
```

### 2. 核心改动

**之前（旧架构）：**
```typescript
// 只存储"我的"数据
private myHandCards: number[] = [];
private scores: Map<string, number> = new Map();
private playerCardCounts: Map<string, number> = new Map();
```

**现在（新架构）：**
```typescript
// 存储所有玩家的数据
private players: Map<string, PlayerGameData> = new Map();
private myPlayerId: string = '';
```

### 3. 新增方法

#### 玩家初始化
```typescript
// 游戏开始时调用
initializePlayers(playerIds: string[], myPlayerId: string): void
```

#### 玩家数据访问
```typescript
getPlayerGameData(playerId: string): PlayerGameData | undefined
getAllPlayerGameData(): PlayerGameData[]
getMyPlayerId(): string
getMyGameData(): PlayerGameData | undefined
```

#### 玩家数据管理
```typescript
setPlayerHandCards(playerId: string, cards: number[]): void
getPlayerHandCards(playerId: string): number[]
setPlayerCardCount(playerId: string, count: number): void
getPlayerCardCount(playerId: string): number
setPlayerScore(playerId: string, score: number): void
getPlayerScore(playerId: string): number
setPlayerState(playerId: string, state: PlayerState): void
getPlayerState(playerId: string): PlayerState
setPlayerIsDealer(playerId: string, isDealer: boolean): void
isPlayerDealer(playerId: string): boolean
setPlayerTurn(playerId: string, isTurn: boolean): void
isPlayerTurn(playerId: string): boolean
```

### 4. 向后兼容

保留了旧方法，标记为 `@deprecated`：

```typescript
/**
 * @deprecated 使用 setPlayerHandCards(myPlayerId, cards) 代替
 */
public setMyHandCards(cards: number[]): void

/**
 * @deprecated 使用 getPlayerHandCards(myPlayerId) 代替
 */
public getMyHandCards(): number[]
```

这确保现有代码继续工作，不会破坏游戏运行。

## GameService 更新

### 游戏开始时初始化玩家

```typescript
private onGameStart = (data: any) => {
    const gameStore = LocalGameStore.getInstance();
    gameStore.resetGame();

    // 初始化所有玩家
    const roomStore = LocalRoomStore.getInstance();
    const currentRoom = roomStore.getCurrentRoom();
    const myPlayerId = roomStore.getMyPlayerId();

    if (currentRoom && myPlayerId) {
        const playerIds = currentRoom.players.map(p => p.id);
        gameStore.initializePlayers(playerIds, myPlayerId);
    }

    EventCenter.emit('SWITCH_TO_PLAYING_STAGE');
};
```

### 发牌时使用新方法

```typescript
private onDealCards = (data: DealCardsEvent) => {
    const gameStore = LocalGameStore.getInstance();
    // 使用新方法：setPlayerHandCards(playerId, cards)
    gameStore.setPlayerHandCards(data.playerId, data.handCards);
    EventCenter.emit(GameEvents.GAME_DEAL_CARDS, data);
};
```

### 选庄时更新庄家状态

```typescript
private onDealerSelected = (data: DealerSelectedEvent) => {
    const gameStore = LocalGameStore.getInstance();
    gameStore.setDealerId(data.dealerId);
    gameStore.setPlayerIsDealer(data.dealerId, true); // 新增
    EventCenter.emit(GameEvents.GAME_DEALER_SELECTED, data);
};
```

## Player 类的未来

### 当前状态
Player 类仍然存在，用于 UI 绑定（PlayerUIManager 使用）。

### 未来方向
有两个选择：

**选项 A：废弃 Player 类**
- UI 直接从 LocalRoomStore 和 LocalGameStore 查询数据
- 需要重构 PlayerUIManager

**选项 B：Player 类作为 ViewModel**
```typescript
export class Player {
    constructor(private playerId: string) {}

    // 从 LocalRoomStore 查询
    get info(): PlayerInfo {
        return LocalRoomStore.getInstance().getPlayerInfo(this.playerId);
    }

    // 从 LocalGameStore 查询
    get handCards(): number[] {
        return LocalGameStore.getInstance().getPlayerHandCards(this.playerId);
    }

    get score(): number {
        return LocalGameStore.getInstance().getPlayerScore(this.playerId);
    }
}
```

## 优势

### 1. 单一数据源
- 所有游戏状态数据都在 LocalGameStore 中
- 避免数据不一致
- 便于调试和状态管理

### 2. 清晰的层级
```
User (账户) → Player (房间身份) → PlayerGameData (游戏状态)
```

### 3. 易于扩展
- 添加新的玩家属性很简单
- 支持多人游戏的完整状态管理
- 为未来功能（回放、观战）打下基础

### 4. 向后兼容
- 旧代码继续工作
- 可以逐步迁移到新 API
- 不会破坏现有功能

## 迁移指南

### 旧代码
```typescript
const gameStore = LocalGameStore.getInstance();
const myCards = gameStore.getMyHandCards();
```

### 新代码
```typescript
const gameStore = LocalGameStore.getInstance();
const myPlayerId = gameStore.getMyPlayerId();
const myCards = gameStore.getPlayerHandCards(myPlayerId);

// 或者使用便捷方法
const myGameData = gameStore.getMyGameData();
const myCards = myGameData?.handCards || [];
```

## 测试建议

1. **测试游戏开始**
   - 验证所有玩家都被正确初始化
   - 检查 myPlayerId 是否正确设置

2. **测试发牌**
   - 验证每个玩家的手牌都被正确存储
   - 检查手牌数量是否正确

3. **测试庄家选择**
   - 验证庄家状态正确设置
   - 检查只有一个玩家是庄家

4. **测试分数更新**
   - 验证所有玩家的分数都被正确更新
   - 检查分数历史记录

5. **测试游戏重置**
   - 验证所有数据都被清空
   - 检查新游戏可以正常开始

## 注意事项

1. **Player 类仍在使用**
   - 当前 PlayerUIManager 仍然使用 Player 对象
   - 未来可以逐步迁移到直接使用 LocalGameStore

2. **数据同步**
   - Player 对象和 LocalGameStore 中的数据可能不同步
   - 建议优先使用 LocalGameStore 作为数据源

3. **性能考虑**
   - LocalGameStore 使用 Map 存储，查询效率高
   - 避免频繁创建 Player 对象

## 总结

这次重构将 LocalGameStore 从"我的游戏数据"升级为"整个游戏的数据"，真正实现了单一数据源的架构目标。同时保持了向后兼容性，确保游戏正常运行。

未来可以逐步废弃 Player 类，让 UI 直接从 LocalGameStore 查询数据，进一步简化架构。
