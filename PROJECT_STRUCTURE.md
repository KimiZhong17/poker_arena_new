# Poker Arena 项目结构文档

## 📁 目录结构

```
poker_arena_client/assets/Scripts/
├── Card/                          # 卡牌系统（独立模块）
│   ├── CardConst.ts              # 卡牌常量定义
│   ├── CardUtils.ts              # 卡牌工具类
│   ├── HandEvaluator.ts          # 手牌评估器（掼蛋规则）
│   ├── GameConfig.ts             # 游戏配置
│   └── HandEvaluator.test.ts     # 测试文件
│
├── Core/                          # 核心游戏逻辑
│   ├── GameMode/                  # 游戏模式
│   │   ├── GameModeBase.ts       # 游戏模式基类
│   │   ├── TheDecreeMode.ts      # The Decree 模式 ✅
│   │   ├── TexasHoldEmEvaluator.ts # 德州扑克评估器 ✅
│   │   ├── GuandanMode.ts        # 掼蛋模式
│   │   └── GameModeFactory.ts    # 游戏模式工厂
│   │
│   └── Room/                      # 房间管理
│       └── RoomManager.ts        # 房间管理器
│
├── Manager/                       # 全局管理器
│   ├── SceneManager.ts           # 场景管理器
│   └── UserManager.ts            # 用户管理器
│
└── UI/                            # UI层
    └── Scenes/                    # 场景控制器
        ├── LoginScene.ts         # 登录场景
        └── GameSelectScene.ts    # 游戏选择场景

```

## 🎮 游戏模式

### 1. The Decree ✅
- **玩家数量**: 2-4 人
- **状态**: **已完成** - 核心游戏逻辑已全部实现
- **文件**: `Core/GameMode/TheDecreeMode.ts`, `Core/GameMode/TexasHoldEmEvaluator.ts`
- **功能**:
  - 完整的德州扑克牌型评估系统
  - 首任庄家选择机制
  - 庄家定策与出牌流程
  - 亮牌比拼与积分计算
  - 补牌机制与游戏结束判定
  - 详细说明见 [THE_DECREE_IMPLEMENTATION.md](THE_DECREE_IMPLEMENTATION.md)

### 2. Guandan (掼蛋) ⚙️
- **玩家数量**: 5 人
- **状态**: 基础框架已完成，炸弹规则已更新
- **文件**: `Core/GameMode/GuandanMode.ts`
- **已完成**:
  - 更新的炸弹规则（任意数量的牌 + wild cards）
  - Joker 炸弹必须包含至少一张大王
  - 权重系统优化（n Joker 炸弹 > 2n 普通炸弹）

## 📝 待办事项

### 优先级 1 - UI 场景 🎨
- [ ] 创建 LobbyScene（房间大厅）
- [ ] 创建 GameScene（游戏场景）
  - [ ] The Decree 游戏界面
  - [ ] Guandan 游戏界面
- [ ] 设计 UI 组件
  - [ ] 卡牌显示组件
  - [ ] 玩家信息面板
  - [ ] 得分显示
  - [ ] 动画效果

### 优先级 2 - 测试与优化 🧪
- [ ] 创建 The Decree 测试用例
- [ ] 测试所有牌型识别
- [ ] 测试平局判定
- [ ] 测试边界情况（牌堆耗尽等）
- [ ] 性能优化

### 优先级 3 - 网络功能（可选） 🌐
- [ ] 实现 NetworkManager
- [ ] 房间同步机制
- [ ] 玩家状态同步
- [ ] 断线重连

## 🔧 技术栈

- **引擎**: Cocos Creator 3.x
- **语言**: TypeScript
- **架构模式**: MVC + 管理器模式
- **设计原则**:
  - 核心逻辑与UI分离
  - 单一职责原则
  - 依赖注入

## 📖 使用说明

### 添加新游戏模式

1. 在 `Core/GameMode/` 创建新的模式类，继承 `GameModeBase`
2. 实现所有抽象方法
3. 在 `GameModeFactory.ts` 中注册新模式
4. 在 `GameSelectScene.ts` 中添加模式信息

### 运行测试

```typescript
import { runTests } from "./Card/HandEvaluator.test";
runTests();
```
