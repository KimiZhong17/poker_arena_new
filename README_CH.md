# 🃏 扑克竞技场 (Poker Arena)

一个基于 Cocos Creator 和 Node.js 构建的多人在线扑克游戏平台，支持多种扑克游戏模式，具有可扩展的架构设计。

## 📋 目录

- [功能特性](#-功能特性)
- [游戏模式](#-游戏模式)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [架构设计](#-架构设计)
- [开发指南](#-开发指南)
- [许可证](#-许可证)

## ✨ 功能特性

- **多游戏支持** - 可扩展的游戏模式系统，支持多种扑克变体
- **实时多人对战** - 基于 WebSocket 的客户端-服务器架构，提供低延迟游戏体验
- **响应式 UI** - 支持 2-5 人的自适应布局，动态定位
- **可扩展架构** - 基于阶段的游戏流程，采用工厂模式便于扩展
- **牌型评估系统** - 内置不同游戏类型的手牌评估器
- **玩家管理** - 全面的玩家状态跟踪和管理系统

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
- **架构模式：** Stage 模式、工厂模式

### 服务端
- **运行环境：** Node.js
- **WebSocket 库：** nodejs-websocket 1.7.2
- **端口：** 8001

## 📁 项目结构

```
poker_arena_new/
├── poker_arena_client/              # Cocos Creator 游戏客户端
│   ├── assets/
│   │   ├── Scripts/
│   │   │   ├── Card/                # 卡牌系统与评估
│   │   │   │   ├── Dealer.ts        # 牌堆创建与洗牌
│   │   │   │   ├── CardUtils.ts     # 卡牌工具与比较
│   │   │   │   ├── HandEvaluator.ts # 掼蛋手牌评估
│   │   │   │   └── TexasHoldEmEvaluator.ts  # 德州扑克牌型排名
│   │   │   ├── Core/                # 核心游戏逻辑
│   │   │   │   ├── GameMode/        # 游戏模式实现
│   │   │   │   │   ├── GameModeBase.ts
│   │   │   │   │   ├── TheDecreeMode.ts
│   │   │   │   │   ├── GuandanMode.ts
│   │   │   │   │   └── GameModeFactory.ts
│   │   │   │   ├── Stage/           # 游戏阶段系统
│   │   │   │   │   ├── GameStageBase.ts
│   │   │   │   │   ├── ReadyStage.ts
│   │   │   │   │   ├── PlayingStage.ts
│   │   │   │   │   └── EndStage.ts
│   │   │   │   └── Room/            # 房间管理
│   │   │   ├── UI/                  # UI 组件
│   │   │   │   ├── PlayerUIManager.ts
│   │   │   │   ├── PlayerUINode.ts
│   │   │   │   ├── PlayerHandDisplay.ts
│   │   │   │   ├── DealerIndicator.ts
│   │   │   │   └── UIControllers/   # 游戏特定 UI 控制器
│   │   │   ├── Manager/             # 系统管理器
│   │   │   │   ├── UserManager.ts
│   │   │   │   ├── RoomManager.ts
│   │   │   │   └── SceneManager.ts
│   │   │   └── Test/                # 测试工具
│   │   └── resources/               # 游戏资源
│   └── settings/                    # Cocos 编辑器设置
│
└── poker_arena_server/              # WebSocket 游戏服务器
    ├── app.js                       # 服务器入口点
    ├── package.json
    └── node_modules/
```

## 🚀 快速开始

### 前置要求

- [Cocos Creator 3.8.7+](https://www.cocos.com/creator-download)
- [Node.js 14+](https://nodejs.org/)

### 服务端设置

```bash
# 进入服务器目录
cd poker_arena_server

# 安装依赖
npm install

# 启动 WebSocket 服务器
node app.js
```

服务器将在 8001 端口启动。

### 客户端设置

1. 打开 Cocos Creator 3.8.7+
2. 打开 `poker_arena_client` 项目文件夹
3. 从资源中打开 `Login` 场景
4. 点击播放按钮在编辑器中运行
5. 或者为目标平台构建（Web、iOS、Android 等）

## 🏗️ 架构设计

### 游戏模式系统

游戏使用基于抽象基类的可扩展架构：

```typescript
GameModeBase (抽象类)
├── TheDecreeMode
└── GuandanMode
```

**创建新游戏模式：**
1. 继承 `GameModeBase`
2. 实现必需的方法（start、end、getPlayerCount 等）
3. 在 `GameModeFactory` 中注册

### 阶段管理

游戏通过三个阶段流转：

```
ReadyStage → PlayingStage → EndStage
```

每个阶段由 `StageManager` 管理，可以为自定义行为进行扩展。

### 玩家系统

```typescript
Player (基类)
├── TheDecreePlayer
└── GuandanPlayer
```

玩家状态跟踪：
- `WAITING` - 在大厅中
- `PLAYING` - 游戏进行中
- `THINKING` - 思考中
- `PASSED` - 跳过回合
- `FINISHED` - 完成游戏

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

### 项目配置

客户端使用 TypeScript，配置如下：
- 目标：ES2017
- 模块：CommonJS
- 启用严格类型检查
- 包含 DOM 库

### 添加新游戏模式

1. 创建一个继承 `GameModeBase` 的新类：

```typescript
export class MyGameMode extends GameModeBase {
    // 实现必需的方法
}
```

2. 在 [GameModeFactory.ts](poker_arena_client/assets/Scripts/Core/GameMode/GameModeFactory.ts) 中注册：

```typescript
GameModeFactory.registerGameMode("MyGame", MyGameMode);
```

3. 创建一个 UI 控制器，继承所需的基础 UI

4. 如果需要自定义流程，添加阶段实现

### 测试

测试辅助工具位于 `poker_arena_client/assets/Scripts/Test/`：
- 卡牌评估测试
- 游戏模式测试工具
- 模拟玩家数据

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 Cocos Creator 约定
- 将 UI 逻辑与游戏逻辑分离
- 使用管理器处理跨切面关注点

## 📄 许可证

ISC

---

**基于 Cocos Creator 3.8.7 开发**
