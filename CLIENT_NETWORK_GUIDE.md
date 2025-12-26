# 客户端网络集成指南

## 🎯 已完成的工作

### 1. 网络层
- ✅ [Messages.ts](poker_arena_client/assets/Scripts/Network/Messages.ts) - 消息类型定义（与服务器同步）
- ✅ [NetworkClient.ts](poker_arena_client/assets/Scripts/Network/NetworkClient.ts) - Socket.IO 客户端封装

### 2. 游戏模式重构
- ✅ **GameModeBase → GameModeClientBase** - 客户端游戏模式基类
- ✅ **TheDecreeModeNetwork → TheDecreeModeClient** - 网络版游戏模式（唯一客户端模式）
  - 监听服务器事件
  - 发送玩家操作到服务器
  - 不包含游戏逻辑（逻辑在服务器）
- ✅ **GameModeFactory → GameModeClientFactory** - 客户端游戏模式工厂
- ✅ **删除冗余文件** - HandTypeHelper.ts, TexasHoldEmEvaluator.ts, TheDecreeModeLocal.ts（服务器端已有）
- ✅ **删除未使用文件** - HallDynamic.ts

### 3. Game 类集成
- ✅ 添加 `networkClient` 属性
- ✅ 添加 `isOnlineMode` 标记
- ✅ 添加 `initializeNetworkClient()` 方法
- ✅ 在 `onDestroy()` 中清理网络连接
- ✅ 更新引用使用 `TheDecreeModeClient`

### 4. 架构调整
- ✅ 客户端只保留网络模式，不再支持离线单机游戏
- ✅ 所有游戏逻辑都在服务器端，客户端只负责 UI 渲染和用户输入

## 📋 下一步需要完成的任务

### 1. 添加 Socket.IO 客户端库

在 `index.html` 中添加 Socket.IO CDN：

```html
<!DOCTYPE html>
<html>
<head>
    <!-- ... 其他头部内容 ... -->

    <!-- Socket.IO Client -->
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
    <!-- ... -->
</body>
</html>
```

### 2. 创建大厅/房间界面

需要创建一个大厅界面，让玩家可以：
- 连接到服务器
- 创建房间
- 加入房间
- 准备游戏

示例代码：
```typescript
// 在 Lobby 场景中
const network = new NetworkClient('http://localhost:3000');

await network.connect();

// 创建房间
network.createRoom('Player1', 'the_decree', 4);

// 监听房间创建成功
network.on('room_created', (data) => {
    console.log('Room created:', data.roomId);
    // 切换到游戏场景
});

// 或加入房间
network.joinRoom('room-id', 'Player2');
```

### 3. 修改 PlayingStage

更新 [PlayingStage.ts](assets/Scripts/Core/Stage/PlayingStage.ts) 以支持网络模式：

```typescript
private createGameMode(): void {
    if (this.game.isOnlineMode) {
        // 使用网络版游戏模式
        this.currentGameMode = new TheDecreeModeNetwork(this.game);
    } else {
        // 使用本地游戏模式
        if (this.gameModeName === 'the_decree') {
            this.currentGameMode = this.createTheDecreeMode();
        }
    }
}
```

### 4. 更新 UI 控制器

修改 [TheDecreeUIController.ts](assets/Scripts/UI/TheDecreeUIController.ts)：

**庄家叫牌按钮：**
```typescript
private onCallButton(cardsToPlay: 1 | 2 | 3): void {
    const gameMode = this.getTheDecreeMode();
    if (gameMode instanceof TheDecreeModeNetwork) {
        // 网络模式：发送到服务器
        gameMode.dealerCall(cardsToPlay);
    } else {
        // 本地模式：直接调用
        gameMode.dealerCall(cardsToPlay);
    }
}
```

**确认出牌按钮：**
```typescript
private onConfirmButton(): void {
    const selectedCards = this.getSelectedCards();
    const gameMode = this.getTheDecreeMode();

    if (gameMode instanceof TheDecreeModeNetwork) {
        // 网络模式：发送到服务器
        gameMode.playCards(selectedCards, network.getPlayerId());
    } else {
        // 本地模式
        gameMode.playCards(selectedCards, 'player_0');
    }
}
```

### 5. 完善 TheDecreeModeNetwork

需要实现的功能：

**手牌显示：**
```typescript
private onDealCards(data: DealCardsEvent): void {
    // 需要创建 Player 对象并初始化 PlayerUIManager
    const playerInfos = [/* 从服务器获取 */];
    const players = this.createPlayersFromServerData(playerInfos, data.handCards);

    this.initializePlayerUIManager(players, false);
}
```

**公共牌显示：**
```typescript
private displayCommunityCards(): void {
    // 参考 TheDecreeMode.displayCommunityCards()
    // 使用 PokerFactory 创建牌节点
}
```

**庄家指示器：**
```typescript
private onDealerSelected(data: DealerSelectedEvent): void {
    const playerIndex = this.getPlayerIndexById(data.dealerId);
    if (this.game.playerUIManager) {
        this.game.playerUIManager.showDealer(playerIndex);
    }
}
```

## 🔧 测试流程

### 1. 启动服务器
```bash
cd poker_arena_server
npm start
```

### 2. 修改客户端连接地址
如果服务器运行在不同的地址，修改：
```typescript
// Game.ts
private initializeNetworkClient(): void {
    const serverUrl = 'http://your-server-url:3000';
    this.networkClient = new NetworkClient(serverUrl);
}
```

### 3. 测试连接
在浏览器控制台中：
```javascript
// 获取 Game 实例
const game = cc.find('Canvas/Game').getComponent('Game');

// 连接服务器
await game.networkClient.connect();

// 创建房间
game.networkClient.createRoom('TestPlayer', 'the_decree', 4);
```

## 📊 架构对比

### 本地模式（现有）
```
PlayingStage
    └── TheDecreeMode (包含完整游戏逻辑)
        ├── 发牌、洗牌
        ├── 回合管理
        ├── 牌型评估
        └── 计分
```

### 网络模式（新增）
```
PlayingStage
    └── TheDecreeModeNetwork (只处理 UI)
        ├── 监听服务器事件
        ├── 更新 UI 显示
        └── 发送玩家操作

服务器端
    └── TheDecreeMode (权威游戏逻辑)
        ├── 验证所有操作
        ├── 管理游戏状态
        └── 广播事件给所有客户端
```

## 🎮 玩家操作流程

### 庄家叫牌
1. 玩家点击"叫1张/2张/3张"按钮
2. UI → TheDecreeModeNetwork.dealerCall()
3. NetworkClient.dealerCall() → 发送到服务器
4. 服务器验证并广播 DEALER_CALLED
5. 所有客户端收到事件并更新 UI

### 玩家出牌
1. 玩家选择卡牌并点击"确认"
2. UI → TheDecreeModeNetwork.playCards()
3. NetworkClient.playCards() → 发送到服务器
4. 服务器验证并广播 PLAYER_PLAYED
5. 所有客户端收到事件并更新 UI

### 摊牌
1. 所有玩家出牌完成
2. 服务器计算结果
3. 服务器广播 SHOWDOWN 事件
4. 客户端显示所有玩家的牌型
5. 服务器广播 ROUND_END 事件
6. 客户端更新分数显示

## ⚠️ 注意事项

1. **消息协议同步**：确保客户端和服务器的消息定义完全一致
2. **错误处理**：添加网络错误、超时、断线重连的处理
3. **安全性**：不要在客户端存储敏感信息，所有验证都在服务器
4. **延迟处理**：添加加载动画，处理网络延迟
5. **调试**：使用浏览器开发工具的 Network 标签监控 WebSocket 通信

## 🐛 常见问题

### 无法连接服务器
- 检查服务器是否启动
- 检查 CORS 配置
- 检查防火墙设置

### Socket.IO 未定义
- 确保在 index.html 中引入了 CDN
- 检查 CDN 地址是否正确

### 事件未触发
- 检查事件名称是否匹配
- 使用 console.log 调试事件流
- 检查 NetworkClient 是否已连接
