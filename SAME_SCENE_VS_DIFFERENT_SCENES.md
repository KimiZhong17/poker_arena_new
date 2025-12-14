# 同一 Scene 支持多游戏模式 - 实现方案

## 🎯 推荐：使用同一个 GameRoom.scene

## 实现策略

### 方案 A：条件分支（快速实现）⭐⭐⭐

**适用于：** 两个游戏差异不大，或者作为临时方案

```typescript
// Game.ts
private _enterGame(): void {
    console.log("Entering game...");
    this.node.addComponent(PokerFactory).init(this._pokerSprites, this._pokerPrefab);

    // 根据游戏模式创建不同的 UI 布局
    if (this._gameMode === 'the_decree') {
        this.setupTheDecreeUI();
    } else {
        this.setupGuandanUI();
    }

    this.startGameFlow();
}

private setupTheDecreeUI(): void {
    // The Decree 特有的 UI
    // - 隐藏第5个玩家位置
    // - 显示公共牌区域
    // - 显示 Dealer 指示器
    console.log('[UI] Setting up The Decree UI');

    // Hide 5th player position
    const rightHandNode = this.handsManagerNode?.getChildByName('RightHand');
    if (rightHandNode) {
        rightHandNode.active = false;
    }

    // Show community cards area
    // TODO: Create community cards display
}

private setupGuandanUI(): void {
    // Guandan 特有的 UI
    // - 显示所有5个玩家位置
    // - 隐藏公共牌区域
    // - 显示 Boss 指示器
    console.log('[UI] Setting up Guandan UI');

    // Ensure all 5 positions are visible
    const rightHandNode = this.handsManagerNode?.getChildByName('RightHand');
    if (rightHandNode) {
        rightHandNode.active = true;
    }
}

private startGameFlow(): void {
    if (this._gameMode === 'the_decree') {
        this.startTheDecreeFlow();
    } else {
        this.startGuandanFlow();
    }
}

private startTheDecreeFlow(): void {
    // The Decree 游戏流程
    console.log('[Game] Starting The Decree flow');
    // TODO: 使用 TheDecreeMode
}

private startGuandanFlow(): void {
    // Guandan 游戏流程（当前实现）
    console.log('[Game] Starting Guandan flow');

    const playerCount = 5;
    const deckCount = 3;
    const cardsPerPlayer = 31;
    const levelRank = 15;

    this._gameController.init({
        playerCount,
        deckCount,
        cardsPerPlayer,
        levelRank
    });

    // ... 现有的 Guandan 流程
}
```

**优点：**
- ✅ 实现简单快速
- ✅ 代码集中在一个文件
- ✅ 易于理解和维护

**缺点：**
- ⚠️ 会有一些 if-else 分支
- ⚠️ Game.ts 会变长

---

### 方案 B：策略模式（优雅实现）⭐⭐⭐⭐

**适用于：** 长期维护，架构清晰

```typescript
// 1. 创建游戏流程接口
// Core/GameMode/IGameFlowController.ts
export interface IGameFlowController {
    setupUI(game: Game): void;
    startGame(): void;
    onPlayerAction(action: any): void;
    cleanup(): void;
}

// 2. Guandan 流程控制器
// Core/GameMode/GuandanFlowController.ts
export class GuandanFlowController implements IGameFlowController {
    private game: Game;
    private gameController: GameController;

    constructor(game: Game) {
        this.game = game;
    }

    setupUI(game: Game): void {
        console.log('[Guandan] Setting up UI');
        // 显示5个玩家位置
        // 设置 Boss 指示器
    }

    startGame(): void {
        console.log('[Guandan] Starting game');
        // 使用 GameController 的 Guandan 流程
        this.gameController = game.gameController;
        this.gameController.init({ playerCount: 5, ... });
        this.gameController.startGame();
    }

    onPlayerAction(action: any): void {
        // 处理玩家操作
    }

    cleanup(): void {
        // 清理资源
    }
}

// 3. The Decree 流程控制器
// Core/GameMode/TheDecreeFlowController.ts
export class TheDecreeFlowController implements IGameFlowController {
    private game: Game;
    private theDecreeMode: TheDecreeMode;

    constructor(game: Game) {
        this.game = game;
        this.theDecreeMode = new TheDecreeMode();
    }

    setupUI(game: Game): void {
        console.log('[The Decree] Setting up UI');
        // 隐藏第5个玩家位置
        // 显示公共牌区域
        // 设置 Dealer 指示器
    }

    startGame(): void {
        console.log('[The Decree] Starting game');
        // 使用 TheDecreeMode 的流程
        const playerIds = ['player1', 'player2', 'player3', 'player4'];
        this.theDecreeMode.initGame(playerIds);
        this.theDecreeMode.dealCards();
    }

    onPlayerAction(action: any): void {
        // 处理玩家操作
    }

    cleanup(): void {
        // 清理资源
    }
}

// 4. Game.ts 使用策略模式
// Game.ts
private _flowController: IGameFlowController = null!;

private _enterGame(): void {
    console.log("Entering game...");
    this.node.addComponent(PokerFactory).init(this._pokerSprites, this._pokerPrefab);

    // 创建对应的流程控制器
    if (this._gameMode === 'the_decree') {
        this._flowController = new TheDecreeFlowController(this);
    } else {
        this._flowController = new GuandanFlowController(this);
    }

    // 统一的流程
    this._flowController.setupUI(this);
    this._flowController.startGame();
}

onDestroy() {
    if (this._flowController) {
        this._flowController.cleanup();
    }
}
```

**优点：**
- ✅ 架构清晰，职责分离
- ✅ 易于测试
- ✅ 易于扩展新游戏模式
- ✅ 代码解耦

**缺点：**
- ⚠️ 需要额外的文件和类
- ⚠️ 实现稍微复杂

---

### 方案 C：组件化（最灵活）⭐⭐⭐⭐⭐

**适用于：** UI 差异很大的情况

```typescript
// 1. 创建游戏模式组件基类
// Core/GameMode/GameModeComponent.ts
@ccclass('GameModeComponent')
export abstract class GameModeComponent extends Component {
    abstract setupGame(): void;
    abstract startGame(): void;
}

// 2. Guandan 组件
// Core/GameMode/GuandanComponent.ts
@ccclass('GuandanComponent')
export class GuandanComponent extends GameModeComponent {
    @property(GameController)
    gameController: GameController = null!;

    setupGame(): void {
        console.log('[Guandan] Setup');
        // Setup Guandan UI
    }

    startGame(): void {
        console.log('[Guandan] Start');
        this.gameController.init({ playerCount: 5, ... });
        this.gameController.startGame();
    }
}

// 3. The Decree 组件
// Core/GameMode/TheDecreeComponent.ts
@ccclass('TheDecreeComponent')
export class TheDecreeComponent extends GameModeComponent {
    private theDecreeMode: TheDecreeMode = null!;

    setupGame(): void {
        console.log('[The Decree] Setup');
        this.theDecreeMode = new TheDecreeMode();
        // Setup The Decree UI
    }

    startGame(): void {
        console.log('[The Decree] Start');
        this.theDecreeMode.initGame([...]);
        this.theDecreeMode.dealCards();
    }
}

// 4. Game.ts 动态添加组件
// Game.ts
private _gameModeComponent: GameModeComponent = null!;

private _enterGame(): void {
    console.log("Entering game...");
    this.node.addComponent(PokerFactory).init(this._pokerSprites, this._pokerPrefab);

    // 动态添加游戏模式组件
    if (this._gameMode === 'the_decree') {
        this._gameModeComponent = this.node.addComponent(TheDecreeComponent);
    } else {
        this._gameModeComponent = this.node.addComponent(GuandanComponent);
    }

    this._gameModeComponent.setupGame();
    this._gameModeComponent.startGame();
}
```

**优点：**
- ✅ 完全解耦
- ✅ 符合 Cocos Creator 的组件化思想
- ✅ 可以在编辑器中可视化配置
- ✅ 极易扩展

**缺点：**
- ⚠️ 需要理解 Cocos Creator 组件生命周期
- ⚠️ 可能有组件通信问题

---

## 📊 方案对比总结

| 方案 | 实现难度 | 代码质量 | 扩展性 | 推荐度 |
|------|----------|----------|--------|--------|
| A - 条件分支 | 🟢 简单 | 🟡 一般 | 🟡 中等 | ⭐⭐⭐ |
| B - 策略模式 | 🟡 中等 | 🟢 好 | 🟢 好 | ⭐⭐⭐⭐ |
| C - 组件化 | 🟡 中等 | 🟢 很好 | 🟢 很好 | ⭐⭐⭐⭐⭐ |

---

## 🎯 我的最终推荐

### 阶段性实现：

**第一阶段（1-2小时）：方案 A**
- 快速实现，让两个游戏都能跑
- 用条件分支处理不同逻辑

**第二阶段（1-2天）：方案 B 或 C**
- 重构为策略模式或组件化
- 提升代码质量和可维护性

---

## 🔧 Scene 结构建议

### GameRoom.scene 节点结构：

```
GameRoom (Scene)
  ├── Canvas
  │   ├── Camera
  │   ├── Background
  │   ├── PokerRoot (所有扑克牌)
  │   │   └── HandsManager (手牌管理器)
  │   │       ├── BottomHand (玩家1)
  │   │       ├── LeftHand (玩家2)
  │   │       ├── TopLeftHand (玩家3)
  │   │       ├── TopRightHand (玩家4)
  │   │       └── RightHand (玩家5) [The Decree时隐藏]
  │   ├── CommunityCards (公共牌区) [Guandan时隐藏]
  │   ├── GuandanUI (Guandan专用UI)
  │   │   ├── BossIndicator
  │   │   └── RemainingCardsDisplay
  │   └── TheDecreeUI (The Decree专用UI)
  │       ├── DealerIndicator
  │       └── RoundDisplay
  └── GameController (Game.ts组件)
```

**关键点：**
- 所有UI元素都在Scene中预先创建
- 根据游戏模式动态显示/隐藏
- 共享的元素（如扑克牌、基础布局）始终可见

---

## ✅ 结论

**使用同一个 GameRoom Scene**，理由：
1. ✅ 两个游戏都用扑克牌，共享资源
2. ✅ UI 差异可以通过显示/隐藏解决
3. ✅ 易于维护和扩展
4. ✅ 场景切换更流畅

**不建议使用不同 Scene**，因为：
1. ❌ 资源重复加载
2. ❌ 代码重复
3. ❌ 维护成本高
4. ❌ 扩展困难

---

## 🚀 立即可用的代码

如果你现在就想实现，我推荐使用 **方案 A（条件分支）**，代码已经在上面提供了。

需要我帮你实现吗？
