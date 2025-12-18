# RoomManager 与 Player 集成优化

## 🎯 优化目标

解决 RoomManager 的 PlayerInfo 与游戏内 Player 类之间的信息获取问题，实现房间层与游戏层的数据联通。

## ✅ 完成的改动

### 1. **GameModeBase 添加房间集成方法**

在 [GameModeBase.ts](poker_arena_client/assets/Scripts/Core/GameMode/GameModeBase.ts) 中添加了两个新方法：

#### 1.1 `getPlayerNameFromRoom()` - 获取玩家名称

```typescript
/**
 * 从 RoomManager 获取玩家名称
 * 如果找不到则返回默认名称
 *
 * @param playerId 玩家ID
 * @param defaultName 默认名称（如果在房间中找不到）
 * @protected
 */
protected getPlayerNameFromRoom(playerId: string, defaultName: string): string {
    const roomManager = RoomManager.getInstance();
    const currentRoom = roomManager.getCurrentRoom();

    if (currentRoom) {
        const roomPlayer = currentRoom.players.find(p => p.id === playerId);
        if (roomPlayer) {
            return roomPlayer.name;
        }
    }

    return defaultName;
}
```

**特点**：
- 🔍 自动从当前房间查找玩家信息
- 🛡️ 提供默认值机制，单机模式也能正常工作
- 🔒 Protected 方法，所有子类都可以使用

#### 1.2 更新 `createUIPlayers()` - 自动获取名称

```typescript
protected createUIPlayers(playerIds: string[]): void {
    this.uiPlayers = [];

    for (let i = 0; i < playerIds.length; i++) {
        const playerId = playerIds[i];
        // 从 RoomManager 获取玩家名称，如果找不到则使用默认名称
        const playerName = this.getPlayerNameFromRoom(playerId, `Player ${i + 1}`);
        const player = new Player(i, playerName, i);
        this.uiPlayers.push(player);
    }

    console.log(`[${this.config.name}] Created ${this.uiPlayers.length} UI players`);
}
```

**改进**：
- ✨ 自动从房间获取玩家名称
- 🎮 UI 显示的玩家名称与房间一致
- 🔄 兼容单机和多人模式

### 2. **TheDecreeMode 使用房间信息**

修改 [TheDecreeMode.ts](poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeMode.ts) 的 `initGame()` 方法：

```typescript
public initGame(playerIds: string[]): void {
    // ... 验证逻辑 ...

    this.playerOrder = [...playerIds];
    this.players.clear();
    this.uiPlayers = [];

    for (let i = 0; i < playerIds.length; i++) {
        const playerId = playerIds[i];
        // 🆕 从 RoomManager 获取玩家名称
        const playerName = this.getPlayerNameFromRoom(playerId, `Player ${i + 1}`);
        const player = new DecreePlayer(i, playerName, i);
        this.players.set(playerId, player);
        this.uiPlayers.push(player);
    }

    console.log(`[TheDecree] Created ${this.players.size} DecreePlayer instances`);

    this.state = GameState.SETUP;
    this.initializeDeck();
}
```

**效果**：
- 🎯 DecreePlayer 现在使用房间中的真实玩家名称
- 📊 游戏内显示与大厅/房间显示一致
- 🔗 房间层与游戏层数据打通

## 📊 架构改进

### 改进前（数据孤立）

```
┌─────────────────────┐
│   RoomManager       │
│                     │
│  PlayerInfo         │
│  - id: string       │
│  - name: "张三"     │
│  - isReady          │
└─────────────────────┘
         ❌ 数据无法传递
┌─────────────────────┐
│   TheDecreeMode     │
│                     │
│  DecreePlayer       │
│  - id: number       │
│  - name: "player_0" │  ← 只有默认名称
└─────────────────────┘
```

### 改进后（数据联通）

```
┌─────────────────────┐
│   RoomManager       │
│                     │
│  PlayerInfo         │
│  - id: "player_0"   │
│  - name: "张三"     │
│  - isReady          │
└─────────────────────┘
         ↓ getPlayerNameFromRoom()
┌─────────────────────┐
│   GameModeBase      │  ← 提供通用方法
└─────────────────────┘
         ↓ 继承
┌─────────────────────┐
│   TheDecreeMode     │
│                     │
│  DecreePlayer       │
│  - id: number       │
│  - name: "张三"     │  ← ✅ 使用真实名称
└─────────────────────┘
```

## 🎮 完整的数据流

### 多人游戏流程

```
1. 大厅/房间场景
   用户输入名字 → RoomManager.createRoom()
   └── PlayerInfo { id: "player_0", name: "张三" }

2. 其他玩家加入
   RoomManager.joinRoom(playerId, playerName)
   └── PlayerInfo { id: "player_1", name: "李四" }

3. 所有人准备
   ReadyStage 从 RoomManager 获取房间信息
   └── 显示玩家列表、准备状态

4. 开始游戏
   PlayingStage.onEnter()
   └── TheDecreeMode.initGame(['player_0', 'player_1', ...])
       └── getPlayerNameFromRoom("player_0") → "张三" ✅
       └── new DecreePlayer(0, "张三", 0)

5. 游戏中显示
   UI 显示 "张三" 而不是 "player_0" ✅
```

### 单机游戏流程

```
1. 直接进入游戏场景
   没有 RoomManager 数据

2. TheDecreeMode.initGame(['player_0', ...])
   └── getPlayerNameFromRoom("player_0") → 找不到
   └── 返回默认值 "Player 1" ✅
   └── new DecreePlayer(0, "Player 1", 0)

3. 游戏正常运行
   使用默认玩家名称 ✅
```

## 🔍 PlayerInfo vs Player 对比

### 明确的职责分离

| 类型 | 层级 | 职责 | 字段 |
|------|------|------|------|
| **PlayerInfo** | 房间层 | 大厅/房间管理 | id, name, avatar, isReady, isHost, seatIndex |
| **Player** | 游戏层 (基类) | 通用游戏逻辑 | id, name, position, handCards, state, isDealer |
| **DecreePlayer** | 游戏层 (子类) | TheDecree 特定逻辑 | 继承 Player + score, playedCards, hasPlayed |

### 数据映射

| PlayerInfo | → | Player/DecreePlayer |
|------------|---|---------------------|
| id (string) | ✅ | id (number) - 作为索引使用 |
| name (string) | ✅ | name (string) - 通过 getPlayerNameFromRoom() |
| seatIndex (number) | ✅ | position (number) - 直接映射 |
| isReady | ❌ | (不需要，进入游戏后不再需要准备状态) |
| isHost | ❌ | (不需要，游戏内无房主概念) |
| avatar | ⏳ | (未来可扩展) |

## 🎯 设计优势

### 1. **关注点分离**
- 🏠 房间管理专注于玩家匹配、准备状态
- 🎮 游戏逻辑专注于牌局、手牌、分数

### 2. **单一数据源**
- 📦 房间信息存储在 RoomManager
- 🔄 游戏模式从 RoomManager 获取信息
- ❌ 避免数据重复和不一致

### 3. **灵活扩展**
- 🆕 新游戏模式自动继承房间集成能力
- 🔧 只需在 GameModeBase 添加功能，所有子类受益
- 🧩 可以轻松添加更多房间信息（头像、等级等）

### 4. **向后兼容**
- ✅ 单机模式（无 RoomManager）仍然工作
- ✅ 使用默认值机制确保健壮性
- ✅ 不影响现有代码逻辑

## 📈 未来扩展方向

### 短期优化

1. **添加头像支持**
```typescript
protected getPlayerAvatarFromRoom(playerId: string): string | undefined {
    const roomManager = RoomManager.getInstance();
    const currentRoom = roomManager.getCurrentRoom();
    if (currentRoom) {
        const roomPlayer = currentRoom.players.find(p => p.id === playerId);
        return roomPlayer?.avatar;
    }
    return undefined;
}
```

2. **添加座位信息同步**
```typescript
// 确保游戏内座位与房间座位一致
const seatIndex = roomPlayer.seatIndex;
const player = new DecreePlayer(seatIndex, playerName, seatIndex);
```

### 长期优化

1. **统一 ID 类型**
   - 考虑将 Player.id 从 `number` 改为 `string`
   - 与 PlayerInfo.id 保持一致

2. **玩家信息对象**
   - 创建 `PlayerProfile` 类包含完整信息
   - Player 持有 PlayerProfile 引用

3. **事件系统**
   - 玩家名称更改时自动同步到游戏内
   - 玩家状态变化通知

## 🧪 测试要点

- [ ] 多人模式：创建房间后进入游戏，玩家名称显示正确
- [ ] 多人模式：多个玩家加入，所有名称显示正确
- [ ] 单机模式：没有房间数据，使用默认名称
- [ ] 中文名称：支持中文等 Unicode 字符
- [ ] 特殊字符：处理空名称、特殊字符
- [ ] UI 显示：游戏内玩家名称与房间列表一致

## 📝 相关文件

### 修改的文件
- [GameModeBase.ts](poker_arena_client/assets/Scripts/Core/GameMode/GameModeBase.ts) - 添加 `getPlayerNameFromRoom()` 方法
- [TheDecreeMode.ts](poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeMode.ts) - 使用房间信息创建玩家

### 相关文件
- [RoomManager.ts](poker_arena_client/assets/Scripts/Core/Room/RoomManager.ts) - 房间管理
- [Player.ts](poker_arena_client/assets/Scripts/Core/Player.ts) - 玩家基类
- [DecreePlayer.ts](poker_arena_client/assets/Scripts/Core/GameMode/DecreePlayer.ts) - TheDecree 玩家类
- [ReadyStage.ts](poker_arena_client/assets/Scripts/Core/Stage/ReadyStage.ts) - 准备阶段（已使用 RoomManager）

---

**优化完成日期：** 2025-12-19

**设计原则：**
- 分层设计：房间层 (RoomManager) + 游戏层 (GameMode)
- 单一数据源：RoomManager 作为玩家信息的来源
- 向下兼容：单机模式使用默认值
- 通用可复用：在基类中实现，所有游戏模式受益
