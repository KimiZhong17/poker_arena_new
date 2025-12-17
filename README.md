# 扑克竞技场 (Poker Arena)

一个基于 Cocos Creator 的多人在线扑克游戏平台。

## 🎮 游戏模式

- **The Decree (圣旨)** - 德州扑克风格的4人游戏
- **Guandan (掼蛋)** - 中国传统扑克游戏

## 📁 项目结构

```
poker_arena_new/
├── poker_arena_client/     # Cocos Creator 客户端
│   └── assets/
│       ├── Scenes/         # 游戏场景
│       ├── Scripts/        # TypeScript 脚本
│       └── Resources/      # 游戏资源
├── poker_arena_server/     # Node.js WebSocket 服务器
└── docs/                   # 项目文档
    ├── archive/           # 历史文档归档
    └── *.md              # 活跃文档
```

## 📚 核心文档

### 游戏实现
- [READY_STAGE_IMPLEMENTATION.md](READY_STAGE_IMPLEMENTATION.md) - ReadyStage 实现文档
- [THE_DECREE_API_DOCUMENTATION.md](THE_DECREE_API_DOCUMENTATION.md) - The Decree 游戏模式 API
- [AUTO_GAME_FLOW_IMPLEMENTATION.md](AUTO_GAME_FLOW_IMPLEMENTATION.md) - 自动游戏流程实现总结 ⭐NEW

### 架构设计
- [ARCHITECTURE_REDESIGN.md](ARCHITECTURE_REDESIGN.md) - 整体架构设计
- [SCENE_FLOW_DESIGN.md](SCENE_FLOW_DESIGN.md) - 场景流程设计
- [GAMEROOM_UI_STRUCTURE.md](GAMEROOM_UI_STRUCTURE.md) - GameRoom UI 结构

### 开发指南
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 项目结构说明
- [ASSET_REQUIREMENTS.md](ASSET_REQUIREMENTS.md) - 资产需求清单
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - 开发进度

### 测试文档
- [TEST_READY_STAGE.md](TEST_READY_STAGE.md) - ReadyStage 测试指南
- [TEST_NON_HOST_MODE.md](TEST_NON_HOST_MODE.md) - 非房主模式测试
- [TEST_AUTO_GAME_FLOW.md](TEST_AUTO_GAME_FLOW.md) - 自动游戏流程测试 ⭐NEW

## 🚀 快速开始

### 客户端
1. 使用 Cocos Creator 3.x 打开 `poker_arena_client` 项目
2. 运行 Login 场景

### 服务器
```bash
cd poker_arena_server
npm install
node app.js
```

## 📝 开发状态

### ✅ 已完成
- [x] 场景流程（Login → Hall → Lobby → GameRoom）
- [x] ReadyStage（准备阶段）- 房主/非房主逻辑
- [x] The Decree 游戏模式核心逻辑
- [x] 扑克牌系统和手牌管理
- [x] 自动游戏循环和 AI 系统 ⭐NEW
- [x] 游戏状态机自动流转 ⭐NEW

### 🔄 进行中
- [ ] 测试完整游戏流程（Ready → Playing → End）
- [ ] EndStage（结束阶段）实现

### 📅 待开发
- [ ] 玩家手牌选择 UI 交互
- [ ] 庄家叫牌 UI 面板
- [ ] 游戏状态提示 UI
- [ ] 发牌和摊牌动画
- [ ] 网络多人同步
- [ ] 音效系统

## 🛠️ 技术栈

- **客户端**: Cocos Creator 3.x, TypeScript
- **服务器**: Node.js, WebSocket (nodejs-websocket)
- **架构**: Stage模式, GameMode工厂模式

## 📞 文档归档

旧版本和临时文档已移至 `docs/archive/` 目录。

## 📄 许可证

ISC
