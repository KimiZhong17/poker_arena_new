# DecreePlayer 重构总结

## 🎯 重构目标

消除 `TheDecreeMode` 中 `PlayerState` interface 和 `Player` 类的重复，使用继承方式实现模式特定的玩家类。

## ✅ 完成的改动

### 1. **创建 DecreePlayer 类**

新建 [DecreePlayer.ts](poker_arena_client/assets/Scripts/Core/GameMode/DecreePlayer.ts)，继承自 `Player`：

```typescript
export class DecreePlayer extends Player {
    // TheDecree 特有字段
    private _score: number = 0;              // 总分数
    private _playedCards: number[] = [];     // 本轮打出的牌
    private _hasPlayed: boolean = false;     // 是否已出牌

    // Getters & Setters
    public get score(): number
    public set score(value: number)
    public get playedCards(): number[]
    public set playedCards(cards: number[])
    public get hasPlayed(): boolean
    public set hasPlayed(value: boolean)

    // 方法
    public addScore(points: number): void
    public resetRoundState(): void
    public markAsPlayed(cards: number[]): void
    public reset(): void  // 覆盖基类方法
}
```

### 2. **修改 TheDecreeMode**

#### 2.1 移除 PlayerState interface
```typescript
// ❌ 删除
interface PlayerState {
    id: string;
    hand: number[];
    score: number;
    playedCards: number[];
    hasPlayed: boolean;
}
```

#### 2.2 更改 players 类型
```typescript
// 之前
private players: Map<string, PlayerState> = new Map();

// 之后
private players: Map<string, DecreePlayer> = new Map();
```

#### 2.3 简化 initGame()
```typescript
public initGame(playerIds: string[]): void {
    // ...

    // 创建 DecreePlayer 对象（同时也是 UI 用的 Player）
    this.uiPlayers = [];

    for (let i = 0; i < playerIds.length; i++) {
        const player = new DecreePlayer(i, playerIds[i], i);
        this.players.set(playerIds[i], player);
        this.uiPlayers.push(player);  // 同一个对象！
    }

    // ❌ 不再需要 createUIPlayers(playerIds)
}
```

#### 2.4 删除 syncPlayerDataToUI() 方法
```typescript
// ❌ 完全删除这个方法，因为不再需要同步
// private syncPlayerDataToUI(): void { ... }
```

#### 2.5 修改所有 `player.hand` → `player.handCards`
```typescript
// 之前
player.hand = [cards...];
player.hand.length
player.hand[0]
player.hand.splice(...)

// 之后
player.setHandCards([cards...]);
player.handCards.length
player.handCards[0]
player.handCards.splice(...)
```

#### 2.6 修改所有 `player.playedCards` 赋值
```typescript
// 之前
player.playedCards = cards;

// 之后
player.playedCards = cards;  // 使用 setter
// 或
player.setPlayedCards(cards);  // 使用方法
```

## 📊 对比分析

### 重构前（有重复）

```
┌─────────────────────────────┐
│ PlayerState interface       │
│  - id: string               │
│  - hand: number[]           │  ← 重复
│  - score: number            │
│  - playedCards: number[]    │
│  - hasPlayed: boolean       │
└─────────────────────────────┘
         ↓ 手动同步
┌─────────────────────────────┐
│ Player class (uiPlayers)    │
│  - _id: number              │
│  - _name: string            │
│  - _handCards: number[]     │  ← 重复
│  - _position: number        │
│  - _state: PlayerState      │
└─────────────────────────────┘
```

**问题：**
- 两套数据结构
- 需要 `syncPlayerDataToUI()` 手动同步
- 字段名不一致（hand vs handCards）
- 容易出现同步错误

### 重构后（统一）

```
┌─────────────────────────────┐
│ Player class (基类)         │
│  - _id: number              │
│  - _name: string            │
│  - _handCards: number[]     │
│  - _position: number        │
│  - _state: PlayerState      │
└─────────────────────────────┘
         ↓ 继承
┌─────────────────────────────┐
│ DecreePlayer class          │
│  继承所有基类字段            │
│  + _score: number           │  ← TheDecree 特有
│  + _playedCards: number[]   │  ← TheDecree 特有
│  + _hasPlayed: boolean      │  ← TheDecree 特有
└─────────────────────────────┘
         ↓ 同一对象
┌─────────────────────────────┐
│ players & uiPlayers         │
│ (指向同一组 DecreePlayer)   │
└─────────────────────────────┘
```

**优点：**
- ✅ 单一数据源
- ✅ 不需要同步
- ✅ 类型安全
- ✅ 清晰的职责分离
- ✅ 符合 OOP 原则

## 🎯 数据流简化

### 重构前
```
TheDecreeMode.dealCards()
  ↓
更新 PlayerState.hand
  ↓
syncPlayerDataToUI()  ← 手动同步
  ↓
Player.setHandCards()
  ↓
PlayerUIManager.updateDisplay()
```

### 重构后
```
TheDecreeMode.dealCards()
  ↓
DecreePlayer.setHandCards()  ← 直接更新
  ↓
PlayerUIManager.updateDisplay()
```

## 📈 代码统计

| 指标 | 变化 |
|------|------|
| 新增文件 | 1 (DecreePlayer.ts, 150 行) |
| 删除代码 | ~50 行 (PlayerState + syncPlayerDataToUI) |
| 修改代码 | ~30 处 (hand → handCards) |
| 净增加 | ~100 行 |
| 消除重复 | 5 个字段 |

## 🔮 扩展性

现在其他游戏模式也可以使用相同的模式：

```typescript
// Guandan 模式
export class GuandanPlayer extends Player {
    private _tribute: number[] = [];    // 进贡的牌
    private _level: number = 2;         // 当前等级
    // ...
}

// 在 GuandanMode 中
public initGame(playerIds: string[]): void {
    for (let i = 0; i < playerIds.length; i++) {
        const player = new GuandanPlayer(i, playerIds[i], i);
        this.players.set(playerIds[i], player);
        this.uiPlayers.push(player);
    }
}
```

## ✅ 优点总结

1. **消除重复** - 不再有两套玩家数据结构
2. **简化代码** - 删除了 syncPlayerDataToUI() 方法
3. **类型安全** - TypeScript 能检查所有字段
4. **关注点分离** - 基类是通用的，子类是模式特定的
5. **易于扩展** - 其他模式可以创建自己的 Player 子类
6. **符合 OOP** - 使用继承而不是组合/适配器

## 🧪 测试要点

- [ ] DecreePlayer 能正确创建
- [ ] 手牌操作正常（setHandCards, addCards）
- [ ] 分数操作正常（score, addScore）
- [ ] 出牌标记正常（playedCards, hasPlayed）
- [ ] 回合重置正常（resetRoundState）
- [ ] UI 显示正常（uiPlayers 指向正确的对象）
- [ ] auto-play 流程正常运行

## 📝 后续优化建议

1. 考虑为 Player 基类添加更多通用方法
2. 考虑为游戏模式创建玩家工厂方法
3. 统一所有游戏模式的玩家管理方式

---

**重构完成日期：** 2025-12-19
**相关文件：**
- [DecreePlayer.ts](poker_arena_client/assets/Scripts/Core/GameMode/DecreePlayer.ts) - 新增
- [TheDecreeMode.ts](poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeMode.ts) - 重构
- [Player.ts](poker_arena_client/assets/Scripts/Core/Player.ts) - 基类
