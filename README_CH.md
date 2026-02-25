# 🃏 扑克竞技场 (Poker Arena)

一个基于 Cocos Creator 和 Go 构建的多人在线扑克游戏平台。客户端主要负责 UI 与输入，Go 服务端负责游戏逻辑与实时状态同步。

## 📋 目录

- [功能特性](#-功能特性)
- [游戏模式](#-游戏模式)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [网络与部署](#-网络与部署)
- [架构设计](#-架构设计)
- [开发指南](#-开发指南)
- [许可证](#-许可证)

## ✨ 功能特性

- **多游戏支持** - 可扩展的游戏模式系统，支持多种扑克变体
- **实时多人对战** - 基于 WebSocket 的客户端-服务器架构，提供低延迟游戏体验
- **局域网多人** - 通过配置 IP 即可在同一局域网内联机
- **响应式 UI** - 支持 2-5 人的自适应布局，动态定位
- **可扩展架构** - 基于阶段的游戏流程，采用工厂模式便于扩展
- **牌型评估系统** - 内置不同游戏类型的手牌评估器
- **断线重连** - 超时窗口内优雅重连，恢复游戏状态
- **自动出牌系统** - 为断线玩家提供 AI 策略（保守/激进/随机）

## 🎮 游戏模式

### 未定之数 (TheDecree)

一款受德州扑克启发的 2-4 人游戏，具有独特的庄家机制。

**游戏规则：**
- 支持 2-4 名玩家
- 每位玩家获得 5 张手牌 + 4 张公共牌
- 庄家宣布出牌数量（1、2 或 3 张牌）
- 所有玩家选择并打出自己的牌
- 最佳牌型获胜该轮
- 获胜者额外获得 +1 分奖励
- 输家成为下一轮庄家

**牌型等级与得分：**
- 高牌：2 分
- 一对：5 分
- 两对：8 分
- 三条：10 分
- 顺子：12 分
- 同花：15 分
- 葫芦：18 分
- 四条：20 分
- 同花顺：23 分
- 皇家同花顺：25 分

**实现状态：** ✅ 完全可玩

### 掼蛋 (Guandan)

一款传统的中国扑克游戏，需要 5 名玩家。

**游戏特色：**
- 需要 5 名玩家
- 使用 2 副牌 + 4 张大小王（共 108 张牌）
- 每位玩家约 21 张牌
- 等级牌升级系统（3 → A）
- 支持炸弹组合

**实现状态：** 🔄 开发中（框架完成，出牌验证待实现）

## 🛠️ 技术栈

### 客户端
- **游戏引擎：** Cocos Creator 3.8.7
- **开发语言：** TypeScript (ES2017)
- **UI 框架：** Cocos Creator 内置 UI 系统
- **架构模式：** Stage 模式、工厂模式、事件驱动

### 服务端
- **运行环境：** Go 1.21
- **实时通信：** Gorilla WebSocket
- **默认端口：** 3000（可在 `poker_arena_server_go/config/config.go` 配置）

## 📁 项目结构

```
poker_arena_new/
├── poker_arena_client/                  # Cocos Creator 游戏客户端
│   ├── assets/
│   │   ├── Scripts/
│   │   │   ├── Card/                    # 卡牌系统与评估
│   │   │   │   ├── CardConst.ts         # 花色/点数枚举
│   │   │   │   ├── CardUtils.ts         # 卡牌工具（getSuit, getPoint, getLogicWeight）
│   │   │   │   ├── Dealer.ts            # 牌堆创建与洗牌（Fisher-Yates）
│   │   │   │   ├── HandEvaluator.ts     # 手牌评估系统
│   │   │   │   └── GameConfig.ts        # 游戏配置常量
│   │   │   ├── Config/                  # 配置文件
│   │   │   │   ├── NetworkConfig.ts     # 服务器 IP/端口配置
│   │   │   │   ├── SeatConfig.ts        # 玩家座位布局（2-5 人）
│   │   │   │   ├── CardDisplayConfig.ts # 卡牌视觉显示设置
│   │   │   │   ├── DealingAnimationConfig.ts  # 发牌动画参数
│   │   │   │   └── UIConfig.ts          # UI 颜色、字体、尺寸
│   │   │   ├── Core/                    # 核心游戏逻辑
│   │   │   │   ├── GameController.ts    # 主游戏编排
│   │   │   │   ├── GameMode/            # 游戏模式实现
│   │   │   │   │   ├── GameModeClientBase.ts      # 抽象基类
│   │   │   │   │   ├── GameModeClientFactory.ts   # 游戏模式工厂
│   │   │   │   │   ├── TheDecreeModeClient.ts     # 未定之数模式
│   │   │   │   │   ├── TheDecreeGameState.ts      # 游戏状态枚举
│   │   │   │   │   └── Handlers/                  # 事件处理器
│   │   │   │   │       ├── DealingHandler.ts      # 发牌动画
│   │   │   │   │       ├── ShowdownHandler.ts     # 摊牌展示
│   │   │   │   │       └── ReconnectHandler.ts    # 重连恢复
│   │   │   │   └── Stage/               # 游戏阶段系统
│   │   │   │       ├── GameStageBase.ts
│   │   │   │       ├── StageManager.ts  # 阶段转换管理
│   │   │   │       ├── ReadyStage.ts
│   │   │   │       ├── PlayingStage.ts
│   │   │   │       └── EndStage.ts
│   │   │   ├── Network/                 # 网络通信
│   │   │   │   ├── NetworkClient.ts     # WebSocket 客户端（含重连）
│   │   │   │   ├── NetworkManager.ts    # 单例网络管理器
│   │   │   │   └── Messages.ts          # 消息类型定义
│   │   │   ├── Services/                # 服务层
│   │   │   │   ├── AuthService.ts       # 认证（登录、游客、登出）
│   │   │   │   ├── GameService.ts       # 游戏事件处理
│   │   │   │   └── RoomService.ts       # 房间管理（创建、加入、离开）
│   │   │   ├── LocalStore/              # 本地状态管理
│   │   │   │   ├── LocalUserStore.ts    # 用户账号数据（持久化）
│   │   │   │   ├── LocalRoomStore.ts    # 房间状态（临时）
│   │   │   │   ├── LocalGameStore.ts    # 游戏中状态
│   │   │   │   └── LocalPlayerStore.ts  # 玩家数据结构
│   │   │   ├── UI/                      # UI 组件
│   │   │   │   ├── PlayerUIManager.ts   # UI 总协调器
│   │   │   │   ├── PlayerUIController.ts # 单个玩家 UI
│   │   │   │   ├── PlayerHandDisplay.ts # 手牌展示与选择
│   │   │   │   ├── PlayerInfoPanel.ts   # 玩家信息（名称、分数、状态）
│   │   │   │   ├── DealingAnimator.ts   # 发牌动画
│   │   │   │   ├── DeckPile.ts          # 牌堆视觉
│   │   │   │   ├── DealerIndicator.ts   # 庄家指示器
│   │   │   │   ├── Poker.ts             # 单张卡牌组件
│   │   │   │   ├── PokerFactory.ts      # 卡牌实例工厂
│   │   │   │   ├── TheDecreeUIController.ts  # 未定之数 UI
│   │   │   │   ├── GuandanUIController.ts    # 掼蛋 UI
│   │   │   │   ├── SceneUIController.ts # 场景级 UI（退出、设置）
│   │   │   │   ├── CardsToPlayHint.ts   # 出牌提示
│   │   │   │   ├── MessageTip.ts        # 消息通知系统
│   │   │   │   ├── LoadingUI.ts         # 加载界面
│   │   │   │   └── Switch.ts           # 开关组件
│   │   │   ├── Utils/                   # 工具类
│   │   │   │   ├── EventCenter.ts       # 事件总线（解耦通信）
│   │   │   │   ├── Logger.ts            # 日志工具
│   │   │   │   ├── IdGenerator.ts       # UUID 生成
│   │   │   │   └── polyfills.ts         # 浏览器兼容
│   │   │   ├── Login.ts                 # 登录场景控制器
│   │   │   ├── Hall.ts                  # 游戏模式选择场景
│   │   │   ├── Lobby.ts                 # 房间创建/加入场景
│   │   │   ├── Game.ts                  # 主游戏场景编排
│   │   │   └── SceneManager.ts          # 场景切换管理
│   │   ├── Scenes/                      # 游戏场景
│   │   │   ├── Login.scene
│   │   │   ├── Hall.scene
│   │   │   ├── Lobby.scene
│   │   │   └── GameRoom.scene
│   │   ├── Resources/                   # 游戏资源
│   │   │   ├── Pokers/                  # 卡牌精灵与预制体
│   │   │   ├── UI/                      # UI 预制体与背景
│   │   │   └── Backgrounds/             # 场景背景
│   │   └── Effects/                     # 着色器效果
│   │       └── CardGlow.effect          # 卡牌发光着色器
│   └── settings/                        # Cocos 编辑器设置
│
└── poker_arena_server_go/               # Go WebSocket 服务端
    ├── main.go                          # 入口，HTTP 路由，优雅关闭
    ├── config/
    │   └── config.go                    # 服务端配置（端口、CORS、超时）
    ├── core/
    │   ├── server.go                    # 主游戏服务器，WebSocket 处理
    │   ├── room.go                      # 游戏房间管理与生命周期
    │   └── session.go                   # 玩家会话与连接
    ├── game/
    │   ├── the_decree.go                # 未定之数游戏状态机
    │   ├── evaluator.go                 # 手牌评估与比较
    │   ├── player_manager.go            # 玩家管理
    │   ├── auto_play.go                 # AI 策略（保守/激进/随机）
    │   ├── card_utils.go                # 卡牌工具
    │   ├── card_const.go                # 卡牌常量
    │   ├── hand_type.go                 # 牌型定义
    │   ├── types.go                     # 类型定义
    │   └── rand.go                      # 随机工具
    ├── protocol/
    │   ├── messages.go                  # 消息类型常量
    │   ├── events.go                    # 事件数据结构
    │   └── requests.go                  # 请求数据结构
    └── util/
        ├── logger.go                    # 结构化日志（DEBUG/INFO/WARN/ERROR）
        ├── rate_limiter.go              # 令牌桶限流
        └── id_validator.go              # ID 验证
```

## 🚀 快速开始

### 前置要求

- [Cocos Creator 3.8.7+](https://www.cocos.com/creator-download)
- [Go 1.21+](https://go.dev/)

### 服务端设置

```bash
# 进入 Go 服务端目录
cd poker_arena_server_go

# 直接运行
go run .

# 或构建后运行
# go build -o poker-arena-server
# ./poker-arena-server
```

WebSocket 服务端默认运行在 **3000** 端口，并会在启动日志中打印局域网 IP。

### 客户端设置

1. 打开 Cocos Creator 3.8.7+
2. 打开 `poker_arena_client` 项目文件夹
3. （局域网）修改 `poker_arena_client/assets/Scripts/Config/NetworkConfig.ts` 中的服务器 IP/端口
4. 从资源中打开 `Login` 场景
5. 点击播放按钮在编辑器中运行
6. 或者为目标平台构建（Web、iOS、Android 等）

## 🌐 网络与部署

### 配置说明

- **服务端端口**：默认 `3000`（见 `poker_arena_server_go/config/config.go`）
- **WebSocket 入口**：`ws://<server-ip>:3000/ws`
- **客户端 IP/端口**：`poker_arena_client/assets/Scripts/Config/NetworkConfig.ts`
- **运行时修改**：`NetworkConfig.setServerIP('192.168.1.100')`

### 健康检查

- `GET /health` → 服务端状态
- `GET /stats` → 房间/玩家统计

### 文档入口

- `LAN_MULTIPLAYER_GUIDE.md`
- `CLIENT_NETWORK_GUIDE.md`
- `MOBILE_H5_DEPLOYMENT_GUIDE.md`

## 🏗️ 架构设计

### 客户端-服务端模型

客户端是轻量 UI 层——所有游戏逻辑运行在 Go 服务端。通过 WebSocket 以 JSON 消息通信。

### 游戏模式系统（客户端）

```typescript
GameModeClientBase (抽象类)
├── TheDecreeModeClient
└── (GuandanModeClient - 计划中)
```

每个游戏模式有专用的 Handler 处理特定关注点：
- `DealingHandler` - 发牌动画与牌分发
- `ShowdownHandler` - 摊牌展示与结果
- `ReconnectHandler` - 断线重连后游戏状态恢复

### 游戏模式系统（服务端）

```go
// 游戏状态机 (the_decree.go)
setup → first_dealer → dealer_call → player_selection → showdown → scoring → refill → game_over
```

### 阶段管理

游戏通过三个阶段流转，由 `StageManager` 管理：

```
ReadyStage → PlayingStage → EndStage
```

### 服务层

客户端使用基于服务的架构与服务端通信：
- `AuthService` - 认证（登录、游客登录、登出）
- `GameService` - 游戏事件处理与操作
- `RoomService` - 房间管理（创建、加入、离开）

### 本地状态管理

客户端状态通过专用 Store 管理：
- `LocalUserStore` - 用户账号数据（持久化）
- `LocalRoomStore` - 房间状态（临时）
- `LocalGameStore` - 游戏中状态
- `LocalPlayerStore` - 玩家数据结构

### 卡牌编码

卡牌使用 8 位编码：`花色 (4 位) | 点数 (4 位)`

**花色：**
- 方块：0x00
- 梅花：0x10
- 红桃：0x20
- 黑桃：0x30
- 大小王：0x40

**点数：**
- 3-A：数值 3-14
- 2：数值 15
- 小王：16
- 大王：17

### UI 布局系统

支持 2-5 名玩家的响应式布局：
- **2 人局：** 面对面（下/上）
- **3 人局：** 三角形排列
- **4 人局：** 菱形排列
- **5 人局：** 五边形排列

所有布局使用 Cocos Creator 的 Widget 系统进行响应式定位。

## 🔧 开发指南

### 添加新游戏模式

1. **服务端：** 在 `poker_arena_server_go/game/` 中添加游戏逻辑
2. **客户端：** 创建一个继承 `GameModeClientBase` 的新类：

```typescript
export class MyGameModeClient extends GameModeClientBase {
    // 实现必需的方法
}
```

3. 在 `GameModeClientFactory.ts` 中注册
4. 创建 UI 控制器（如 `MyGameUIController.ts`）
5. 如需要，添加发牌、摊牌等 Handler

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 Cocos Creator 约定
- 将 UI 逻辑与游戏逻辑分离
- 使用 Services 与服务端通信，LocalStores 管理状态

## 📄 许可证

ISC

---

**基于 Cocos Creator 3.8.7 + Go 1.21 开发**
