# LocalGameStore 使用指南

## 概述

LocalGameStore 是游戏状态的单一数据源（Single Source of Truth），负责存储游戏进行中的所有状态数据。

## 架构位置

```
NetworkClient → GameService → LocalGameStore → EventCenter → UI Components
                    ↓              ↓
                 更新数据        查询数据
```

## 数据分类

### 1. 游戏基础状态
- `gameState`: 当前游戏状态（TheDecreeGameState）
- `currentRound`: 当前回合数
- `isGameActive`: 游戏是否激活

### 2. 牌相关
- `myHandCards`: 我的手牌
- `communityCards`: 公共牌（4张）
- `deckSize`: 牌堆剩余牌数

### 3. 庄家相关
- `dealerId`: 当前庄家ID
- `cardsToPlay`: 本回合要出的牌数（1, 2, 或 3）

### 4. 回合记录
- `currentRoundPlays`: 当前回合的出牌记录
- `roundHistory`: 历史回合结果
- `lastPlayedCards`: 桌面上最后出的牌
- `lastPlayerId`: 最后出牌的玩家ID

### 5. 分数
- `scores`: 玩家分数映射

### 6. 玩家状态
- `playerCardCounts`: 玩家手牌数量
- `playerTurnState`: 玩家是否轮到

## 使用示例

### 在 GameService 中更新数据

```typescript
// GameService.ts
private onDealCards = (data: DealCardsEvent) => {
    // 存储到 LocalGameStore
    const gameStore = LocalGameStore.getInstance();
    gameStore.setMyHandCards(data.handCards);

    // 发送事件通知 UI
    EventCenter.emit(GameEvents.GAME_DEAL_CARDS, data);
};
```

### 在 UI 组件中查询数据

```typescript
// TheDecreeUIController.ts
public updateUI(): void {
    const gameStore = LocalGameStore.getInstance();

    // 查询游戏状态
    const gameState = gameStore.getGameState();
    const dealerId = gameStore.getDealerId();
    const cardsToPlay = gameStore.getCardsToPlay();

    // 根据状态更新 UI
    if (gameState === TheDecreeGameState.DEALER_CALL) {
        this.showDealerCallButtons();
    }
}
```

### 在 GameMode 中查询数据

```typescript
// TheDecreeModeClient.ts
public isCurrentPlayerDealer(): boolean {
    const gameStore = LocalGameStore.getInstance();
    const localRoomStore = LocalRoomStore.getInstance();

    const dealerId = gameStore.getDealerId();
    const myPlayerId = localRoomStore.getMyPlayerId();

    return myPlayerId === dealerId;
}
```

## 生命周期管理

### 游戏开始时
```typescript
// GameService.ts - onGameStart
const gameStore = LocalGameStore.getInstance();
gameStore.resetGame();
gameStore.setGameActive(true);
```

### 新回合开始时
```typescript
const gameStore = LocalGameStore.getInstance();
gameStore.resetRound();
```

### 离开房间时
```typescript
// RoomService.ts - handleLocalLeave
LocalGameStore.getInstance().clear();
```

## 调试工具

### 打印当前状态
```typescript
const gameStore = LocalGameStore.getInstance();
gameStore.printState();
```

### 获取状态快照
```typescript
const gameStore = LocalGameStore.getInstance();
const snapshot = gameStore.getSnapshot();
console.log('Game State Snapshot:', snapshot);
```

## 注意事项

1. **只存储数据，不包含逻辑**
   - LocalGameStore 是纯数据容器
   - 游戏逻辑在服务器端
   - 客户端只负责显示和发送操作请求

2. **数据由 GameService 更新**
   - 所有数据更新都通过 GameService 从服务器同步
   - UI 组件不应该直接修改 LocalGameStore 的数据

3. **UI 通过 EventCenter 监听变化**
   - GameService 更新 LocalGameStore 后，发送 EventCenter 事件
   - UI 组件监听事件，然后从 LocalGameStore 查询最新数据

4. **单例模式**
   - LocalGameStore 使用单例模式
   - 通过 `LocalGameStore.getInstance()` 获取实例

## 与其他 Store 的关系

| Store | 职责 |
|-------|------|
| **LocalUserStore** | 用户认证信息（userId, token, username） |
| **LocalRoomStore** | 房间信息（房间ID、玩家列表、准备状态） |
| **LocalGameStore** | 游戏进行中的状态（手牌、公共牌、庄家、回合数等） |

## 完整数据流示例

```
1. 服务器发送 DEAL_CARDS 事件
   ↓
2. NetworkClient 接收事件
   ↓
3. GameService.onDealCards() 处理事件
   ↓
4. LocalGameStore.setMyHandCards() 存储数据
   ↓
5. EventCenter.emit(GAME_DEAL_CARDS) 发送事件
   ↓
6. UI 组件监听到事件
   ↓
7. UI 从 LocalGameStore.getMyHandCards() 查询数据
   ↓
8. UI 更新显示
```

## 常见问题

### Q: 为什么不直接在 UI 中存储游戏状态？
A: 分离数据和视图，便于：
- 多个 UI 组件共享同一份数据
- 数据持久化和状态恢复
- 调试和测试
- 未来可能的功能（回放、观战等）

### Q: LocalGameStore 和 GameMode 的关系？
A:
- LocalGameStore: 存储游戏状态数据
- GameMode: 处理游戏逻辑和 UI 交互
- GameMode 可以从 LocalGameStore 查询数据，但不应该直接修改

### Q: 什么时候应该清空 LocalGameStore？
A:
- 离开房间时：`clear()`
- 新游戏开始时：`resetGame()`
- 新回合开始时：`resetRound()`
