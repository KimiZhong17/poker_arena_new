# 🚀 快速开始指南

## ✅ 服务器已成功搭建！

### 📋 当前状态

- ✅ **服务器运行中**: http://localhost:3000
- ✅ **WebSocket 端点**: ws://localhost:3000
- ✅ **健康检查**: http://localhost:3000/health
- ✅ **统计信息**: http://localhost:3000/stats

---

## 🧪 测试服务器

### 方式 1: 浏览器测试（推荐）

1. 用浏览器打开测试页面：
   ```
   poker_arena_server/test-client.html
   ```

2. 点击 "Connect" 连接服务器

3. 输入玩家名字，点击 "Create Room" 创建房间

4. 在另一个浏览器标签页打开相同页面，输入房间号加入

5. 两个玩家都点击 "Ready"，游戏开始！

### 方式 2: 命令行测试

```bash
# 健康检查
curl http://localhost:3000/health

# 查看统计
curl http://localhost:3000/stats
```

---

## 🎮 已实现功能

### ✅ 房间管理
- [x] 创建房间
- [x] 加入房间
- [x] 离开房间
- [x] 玩家准备
- [x] 自动开始游戏（所有人准备好）

### ✅ 连接管理
- [x] WebSocket 连接
- [x] 心跳检测
- [x] 断线超时
- [x] 优雅关闭

### ✅ 监控功能
- [x] HTTP 健康检查
- [x] 实时统计信息

---

## 🔄 下一步：迁移游戏逻辑

### Phase 1: 复制核心逻辑文件

```bash
# 1. 创建游戏目录
mkdir poker_arena_server/src/game

# 2. 复制纯逻辑文件（可以直接用）
复制这些文件到 src/game/:
  - TexasHoldEmEvaluator.ts  # 牌型计算
  - HandTypeHelper.ts         # 牌型辅助
  - CardConst.ts              # 卡牌常量
  - Player.ts                 # 玩家类（需要移除 UI 依赖）

# 3. 创建服务器版游戏模式
创建文件: src/game/TheDecreeGameMode.ts
从客户端的 TheDecreeMode.ts 迁移游戏逻辑
```

### Phase 2: 需要迁移的核心方法

从 `TheDecreeMode.ts` 迁移这些方法到服务器：

```typescript
✅ 牌堆管理:
  - initializeDeck()
  - shuffleDeck()
  - drawCard()

✅ 发牌逻辑:
  - dealCards()

✅ 游戏规则:
  - isValidPlay()
  - playCards()
  - dealerCall()

✅ 回合处理:
  - processShowdown()
  - calculateScores()
  - refillHands()

✅ 状态机:
  - update()
  - startNewRound()
```

### Phase 3: 集成到服务器

在 `GameRoom.ts` 和 `GameServer.ts` 中集成游戏逻辑：

```typescript
// GameRoom.ts
public gameMode: TheDecreeGameMode | null = null;

public initGameMode() {
    this.gameMode = new TheDecreeGameMode();
    // 设置事件回调
}

// GameServer.ts
private handleDealerCall(socket, data) {
    // 调用 room.gameMode.dealerCall()
}

private handlePlayCards(socket, data) {
    // 调用 room.gameMode.playCards()
}
```

---

## 📚 相关文档

- [README.md](README.md) - 完整使用说明
- [ARCHITECTURE.md](ARCHITECTURE.md) - 架构详解
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - 详细迁移指南

---

## 🔧 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm start

# 停止服务器
按 Ctrl+C
```

---

## 💡 提示

1. **修改代码后自动重启**: 开发模式下修改代码会自动重启服务器

2. **查看实时日志**: 服务器会输出所有连接、房间创建等日志

3. **多客户端测试**: 用多个浏览器标签页打开 test-client.html 测试多人功能

4. **将来迁移 Go**: 消息协议使用 JSON，迁移时客户端无需修改

---

## 🎯 当前进度

```
[████████████████░░░░] 80% 服务器基础架构

✅ 完成:
  - 服务器框架搭建
  - 房间管理系统
  - 连接管理系统
  - 消息协议定义
  - 测试工具

🚧 进行中:
  - 游戏逻辑迁移

⏳ 待完成:
  - 客户端适配
  - 完整游戏流程测试
```

---

需要帮助？查看详细文档或询问！ 🤝
