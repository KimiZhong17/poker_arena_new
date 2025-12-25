# 服务器架构说明

## 📁 项目结构

```
poker_arena_server/
├── src/
│   ├── server.ts                  # 入口文件 - HTTP + WebSocket 服务器
│   ├── config/
│   │   └── ServerConfig.ts        # 配置（端口、超时时间等）
│   ├── core/
│   │   ├── GameServer.ts          # 核心：管理所有房间和连接
│   │   ├── GameRoom.ts            # 房间：管理单个游戏房间
│   │   └── PlayerSession.ts       # 会话：管理单个玩家连接
│   └── types/
│       └── Messages.ts            # 消息协议定义
├── package.json
├── tsconfig.json
└── README.md
```

## 🔄 已完成的功能

### ✅ 基础架构
- [x] Express HTTP 服务器
- [x] Socket.IO WebSocket 服务器
- [x] TypeScript 配置
- [x] 热重载开发环境

### ✅ 房间管理
- [x] 创建房间 (`create_room`)
- [x] 加入房间 (`join_room`)
- [x] 离开房间 (`leave_room`)
- [x] 玩家准备 (`ready`)
- [x] 房间广播功能
- [x] 房间超时自动清理

### ✅ 连接管理
- [x] 玩家会话管理
- [x] 心跳检测 (30 秒)
- [x] 断线检测 (60 秒超时)
- [x] 优雅关闭

### ✅ 监控端点
- [x] `/health` - 健康检查
- [x] `/stats` - 服务器统计（房间数、玩家数）

## 🚧 待迁移的功能

### 1. 游戏逻辑核心

从客户端迁移以下文件到服务器：

#### 📦 共享代码（可直接复制）

```
poker_arena_client/assets/Scripts/Core/
├── GameMode/
│   ├── TexasHoldEmEvaluator.ts    ✅ 纯逻辑，可直接复用
│   └── HandTypeHelper.ts           ✅ 纯逻辑，可直接复用
└── Player.ts                       ✅ 数据模型，可直接复用
```

#### 🔄 需要调整的代码

```
poker_arena_client/assets/Scripts/Core/GameMode/
└── TheDecreeMode.ts                ⚠️ 需要拆分：
    ├── 保留逻辑 → 服务器
    └── 移除 UI  → 客户端保留
```

### 2. 需要实现的服务器端游戏逻辑

在 `src/game/TheDecreeGameMode.ts` 中实现：

```typescript
class TheDecreeGameMode {
    // 牌堆管理
    - initializeDeck()
    - shuffleDeck()
    - drawCard()
    - dealCards()

    // 游戏状态机
    - update(deltaTime)
    - startNewRound()
    - processShowdown()

    // 玩家操作验证
    - isValidPlay()
    - playCards()
    - dealerCall()

    // 计分系统
    - calculateScores()

    // 回合管理
    - refillHands()
    - selectFirstDealer()
}
```

### 3. 需要在 GameServer.ts 中实现的方法

```typescript
// 在 handleDealerCall() 中
- 验证是否是庄家
- 调用游戏逻辑
- 广播庄家决策

// 在 handlePlayCards() 中
- 验证出牌是否合法
- 调用游戏逻辑
- 广播玩家出牌
- 检查回合是否结束

// 在 startGame() 中
- 初始化 TheDecreeGameMode
- 发牌
- 广播初始状态
```

## 📡 通信协议

### 客户端 → 服务器

| 事件 | 触发时机 | 数据 |
|------|---------|------|
| `create_room` | 创建房间按钮 | `{ playerName, gameMode, maxPlayers }` |
| `join_room` | 输入房间号 | `{ roomId, playerName }` |
| `ready` | 点击准备按钮 | - |
| `dealer_call` | 庄家选择出牌数 | `{ roomId, playerId, cardsToPlay: 1\|2\|3 }` |
| `play_cards` | 玩家选牌确认 | `{ roomId, playerId, cards: number[] }` |

### 服务器 → 客户端

| 事件 | 说明 | 客户端处理 |
|------|------|----------|
| `room_created` | 房间创建成功 | 显示房间号 |
| `room_joined` | 加入房间成功 | 显示房间内玩家列表 |
| `player_joined` | 其他玩家加入 | 更新玩家列表 |
| `game_start` | 游戏开始 | 切换到游戏场景 |
| `deal_cards` | 收到手牌（私密） | 显示自己的手牌 |
| `community_cards` | 公共牌（广播） | 显示公共牌 |
| `dealer_selected` | 庄家确定 | 显示庄家标记 |
| `dealer_called` | 庄家叫牌 | 显示出牌数量 |
| `player_played` | 玩家出牌 | 更新玩家状态（不显示牌） |
| `showdown` | 摊牌 | 显示所有玩家的牌和牌型 |
| `round_end` | 回合结束 | 更新分数 |
| `game_over` | 游戏结束 | 显示最终结果 |

## 🔐 安全性设计

### 已实现
- ✅ CORS 跨域保护
- ✅ 房间数量限制
- ✅ 心跳超时检测

### 待实现
- ⚠️ 玩家 ID 验证（防止伪造）
- ⚠️ 操作频率限制（防止恶意请求）
- ⚠️ 手牌加密（防止数据包嗅探）
- ⚠️ 操作序列号（防止重放攻击）

## 📊 数据流示例

### 完整游戏流程

```
1. 创建房间
   Client A → create_room
   Server → room_created (to A)

2. 加入房间
   Client B → join_room
   Server → room_joined (to B)
   Server → player_joined (broadcast to A)

3. 准备
   Client A → ready
   Server → player_ready (broadcast)
   Client B → ready
   Server → player_ready (broadcast)
   Server → game_start (broadcast)  // 所有人准备好

4. 发牌
   Server → deal_cards (to each player, private)
   Server → community_cards (broadcast)

5. 选庄
   Server → dealer_selected (broadcast)

6. 庄家叫牌
   Client A (dealer) → dealer_call { cardsToPlay: 2 }
   Server → dealer_called (broadcast)

7. 玩家出牌
   Client A → play_cards { cards: [0x1E, 0x2E] }
   Server → player_played { playerId, cardCount: 2 } (broadcast)
   Client B → play_cards { cards: [0x1D, 0x2D] }
   Server → player_played { playerId, cardCount: 2 } (broadcast)

8. 摊牌
   Server → showdown {
       results: [
           { playerId: A, cards: [...], handType: PAIR, score: 3 },
           { playerId: B, cards: [...], handType: HIGH_CARD, score: 2 }
       ]
   } (broadcast)

9. 回合结束
   Server → round_end { winnerId: A, scores: {...} } (broadcast)

10. 补牌，下一轮...
```

## 🎯 下一步行动

### Phase 1: 迁移核心逻辑 (优先)
1. 复制 `TexasHoldEmEvaluator.ts` 到 `src/game/`
2. 复制 `HandTypeHelper.ts` 到 `src/game/`
3. 复制 `Player.ts` 到 `src/game/`
4. 调整导入路径

### Phase 2: 实现游戏模式
1. 创建 `src/game/TheDecreeGameMode.ts`
2. 从客户端 `TheDecreeMode.ts` 迁移逻辑
3. 移除 UI 相关代码
4. 添加服务器端特有的验证逻辑

### Phase 3: 集成到 GameServer
1. 在 `GameRoom.ts` 中集成 `TheDecreeGameMode`
2. 实现 `handleDealerCall()` 和 `handlePlayCards()`
3. 实现游戏状态广播

### Phase 4: 客户端适配
1. 修改客户端连接 Socket.IO
2. 移除客户端的游戏逻辑
3. 改为接收服务器消息并更新 UI

## 🔧 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 生产模式
npm start

# 测试
npm test
```

## 🐛 调试技巧

### 查看服务器统计
```bash
curl http://localhost:3000/stats
```

### 查看健康状态
```bash
curl http://localhost:3000/health
```

### 测试 WebSocket 连接
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected:', socket.id);
});
```

## 📝 注意事项

1. **消息类型定义**：所有消息格式都在 `Messages.ts` 中，客户端和服务器必须保持一致

2. **房间 ID**：使用 UUID 的前 8 位，易于分享

3. **玩家 ID**：使用 Socket.IO 的 `socket.id`，保证唯一性

4. **心跳机制**：
   - 客户端每 30 秒发送 `ping`
   - 服务器 60 秒无响应视为断线

5. **将来迁移 Go**：
   - 保持 `Messages.ts` 不变（JSON 协议）
   - Go 可以用相同的 JSON 消息格式
   - 客户端无需修改
