# Poker Arena Server

Node.js + TypeScript + Socket.IO 游戏服务器

## 📦 安装依赖

```bash
npm install
```

## 🚀 运行

### 开发模式（热重载）
```bash
npm run dev
```

### 生产模式
```bash
npm run build
npm start
```

## 📡 API 端点

### HTTP 端点

- `GET /health` - 健康检查
- `GET /stats` - 服务器统计信息

### WebSocket 事件

#### 客户端 → 服务器

| 事件 | 数据 | 说明 |
|------|------|------|
| `create_room` | `CreateRoomRequest` | 创建房间 |
| `join_room` | `JoinRoomRequest` | 加入房间 |
| `leave_room` | - | 离开房间 |
| `ready` | - | 准备/取消准备 |
| `dealer_call` | `DealerCallRequest` | 庄家叫牌 |
| `play_cards` | `PlayCardsRequest` | 玩家出牌 |
| `ping` | - | 心跳 |

#### 服务器 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `room_created` | `RoomCreatedEvent` | 房间创建成功 |
| `room_joined` | `RoomJoinedEvent` | 加入房间成功 |
| `player_joined` | `PlayerJoinedEvent` | 其他玩家加入 |
| `player_left` | `PlayerLeftEvent` | 玩家离开 |
| `player_ready` | `PlayerReadyEvent` | 玩家准备状态变化 |
| `game_start` | `GameStartEvent` | 游戏开始 |
| `error` | `ErrorEvent` | 错误消息 |
| `pong` | - | 心跳响应 |

## 🏗️ 项目结构

```
poker_arena_server/
├── src/
│   ├── server.ts              # 入口文件
│   ├── config/
│   │   └── ServerConfig.ts    # 服务器配置
│   ├── core/
│   │   ├── GameServer.ts      # 游戏服务器（Socket.IO 管理）
│   │   ├── GameRoom.ts        # 游戏房间
│   │   └── PlayerSession.ts   # 玩家会话
│   ├── types/
│   │   └── Messages.ts        # 消息类型定义
│   └── game/                  # 游戏逻辑（待迁移）
│       └── TheDecreeMode.ts   # 将来从客户端迁移
├── package.json
├── tsconfig.json
└── README.md
```

## 🔄 下一步

1. **迁移游戏逻辑**：
   - 从客户端复制 `TexasHoldEmEvaluator.ts`
   - 从客户端复制 `Player.ts`
   - 从客户端复制 `TheDecreeMode.ts` 并调整为服务器版本

2. **实现游戏流程**：
   - 发牌逻辑
   - 回合管理
   - 计分系统

3. **客户端集成**：
   - 修改客户端连接到服务器
   - 移除客户端的游戏逻辑，改为接收服务器指令

## 🔧 配置

环境变量（可选）：

```bash
PORT=3000                           # 服务器端口
CORS_ORIGIN=http://localhost:8080   # 允许的客户端源
LOG_LEVEL=info                      # 日志级别
```

## 🐛 测试连接

使用浏览器控制台或 Node.js 脚本测试：

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected!');

    // 创建房间
    socket.emit('create_room', {
        playerName: 'Player 1',
        gameMode: 'the_decree',
        maxPlayers: 4
    });
});

socket.on('room_created', (data) => {
    console.log('Room created:', data);
});
```

## 📝 注意事项

- 当前版本只实现了基础的房间管理和连接功能
- 游戏逻辑（发牌、出牌、计分）需要从客户端迁移
- 建议先用 Node.js 版本验证逻辑，将来可考虑迁移到 Go
