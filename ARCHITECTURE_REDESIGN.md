# 🎮 游戏架构重构设计

## 📋 当前问题

1. **Game.ts 过于臃肿**：包含所有阶段逻辑、多种游戏模式、UI管理
2. **阶段管理不清晰**：没有独立的阶段类，所有逻辑耦合在一起
3. **游戏模式混乱**：TheDecree 和 Guandan 的实现方式不统一
4. **难以扩展**：添加新阶段或新游戏模式需要修改大量代码

## 🏗️ 新架构设计

### 核心思想

采用**阶段系统 + 游戏模式系统**的双层架构：

```
Game.ts (主入口 - 轻量级)
  ├─ 资源加载 (Poker Bundle, Sprites, Prefabs)
  ├─ 全局管理器初始化
  └─ StageManager (阶段管理器)
      │
      ├─ ReadyStage (准备阶段)
      │   ├─ 玩家准备状态管理
      │   ├─ UI 显示/隐藏
      │   └─ 触发进入 Playing 阶段
      │
      ├─ PlayingStage (游玩阶段)
      │   ├─ UI 显示/隐藏
      │   ├─ 加载并初始化 GameMode
      │   └─ GameMode (游戏模式基类)
      │       ├─ TheDecreeMode (天命之战)
      │       │   ├─ 游戏规则实现
      │       │   ├─ UI 控制接口
      │       │   └─ 状态管理
      │       │
      │       └─ GuandanMode (掼蛋)
      │           ├─ 游戏规则实现
      │           ├─ UI 控制接口
      │           └─ 状态管理
      │
      └─ EndStage (结束阶段)
          ├─ 结算UI
          ├─ 积分/排名显示
          └─ 返回大厅/再来一局
```

## 📂 文件结构

```
assets/Scripts/
├─ Game.ts                              # 主入口，负责资源加载和初始化
├─ Core/
│  ├─ GameStage.ts                      # 阶段枚举
│  ├─ Stage/
│  │  ├─ GameStageBase.ts               # 阶段基类 (抽象类)
│  │  ├─ StageManager.ts                # 阶段管理器
│  │  ├─ ReadyStage.ts                  # 准备阶段实现
│  │  ├─ PlayingStage.ts                # 游玩阶段实现
│  │  └─ EndStage.ts                    # 结束阶段实现
│  │
│  └─ GameMode/
│     ├─ GameModeBase.ts                # 游戏模式基类 (已存在，需扩展)
│     ├─ TheDecreeMode.ts               # 天命之战模式 (已存在，需重构)
│     └─ GuandanMode.ts                 # 掼蛋模式 (需新建)
│
└─ UI/
   ├─ TheDecreeUIController.ts          # TheDecree UI (已存在)
   ├─ GuandanUIController.ts            # Guandan UI (需新建)
   └─ ReadyStageUI.ts                   # Ready阶段UI (可选)
```

## 🔧 核心类设计

### 1. GameStageBase (阶段基类)

```typescript
/**
 * 游戏阶段基类
 * 所有阶段都必须继承此类
 */
export abstract class GameStageBase {
    protected game: Game;
    protected rootNode: Node;

    constructor(game: Game, rootNode: Node) {
        this.game = game;
        this.rootNode = rootNode;
    }

    /**
     * 进入此阶段时调用
     */
    abstract onEnter(): void;

    /**
     * 离开此阶段时调用
     */
    abstract onExit(): void;

    /**
     * 每帧更新 (可选实现)
     */
    update?(deltaTime: number): void;

    /**
     * 显示此阶段的UI
     */
    abstract showUI(): void;

    /**
     * 隐藏此阶段的UI
     */
    abstract hideUI(): void;

    /**
     * 清理资源
     */
    abstract cleanup(): void;
}
```

### 2. StageManager (阶段管理器)

```typescript
export class StageManager {
    private currentStage: GameStageBase | null = null;
    private stages: Map<GameStage, GameStageBase> = new Map();

    /**
     * 注册阶段
     */
    registerStage(stageType: GameStage, stage: GameStageBase): void;

    /**
     * 切换到指定阶段
     */
    switchToStage(stageType: GameStage): void {
        // 1. 调用当前阶段的 onExit
        // 2. 切换到新阶段
        // 3. 调用新阶段的 onEnter
    }

    /**
     * 获取当前阶段
     */
    getCurrentStage(): GameStageBase | null;

    /**
     * 清理所有阶段
     */
    cleanup(): void;
}
```

### 3. ReadyStage (准备阶段)

```typescript
export class ReadyStage extends GameStageBase {
    private btnStart: Button;
    private playerReadyStates: Map<string, boolean> = new Map();

    onEnter(): void {
        this.showUI();
        this.setupButtons();
        this.resetReadyStates();
    }

    onExit(): void {
        this.hideUI();
        this.cleanupButtons();
    }

    showUI(): void {
        // 显示准备阶段UI (Node_ReadyStage)
    }

    hideUI(): void {
        // 隐藏准备阶段UI
    }

    /**
     * 玩家点击准备/开始
     */
    onPlayerReady(playerId: string): void {
        this.playerReadyStates.set(playerId, true);

        // 检查是否所有玩家都准备好
        if (this.allPlayersReady()) {
            // 切换到游玩阶段
            this.game.stageManager.switchToStage(GameStage.PLAYING);
        }
    }

    private allPlayersReady(): boolean {
        // TODO: 实现多人检测逻辑
        return true; // 暂时直接返回true
    }
}
```

### 4. PlayingStage (游玩阶段)

```typescript
export class PlayingStage extends GameStageBase {
    private currentGameMode: GameModeBase | null = null;
    private gameModeName: string;

    constructor(game: Game, rootNode: Node, gameModeName: string) {
        super(game, rootNode);
        this.gameModeName = gameModeName;
    }

    onEnter(): void {
        // 1. 根据配置创建游戏模式
        this.createGameMode();

        // 2. 初始化游戏模式
        this.currentGameMode?.onEnter();

        // 3. 显示游戏模式UI
        this.showUI();
    }

    onExit(): void {
        this.currentGameMode?.onExit();
        this.hideUI();
    }

    showUI(): void {
        // 调用游戏模式的UI显示接口
        this.currentGameMode?.showUI();
    }

    hideUI(): void {
        // 调用游戏模式的UI隐藏接口
        this.currentGameMode?.hideUI();
    }

    private createGameMode(): void {
        if (this.gameModeName === 'the_decree') {
            this.currentGameMode = new TheDecreeMode(this.game);
        } else if (this.gameModeName === 'guandan') {
            this.currentGameMode = new GuandanMode(this.game);
        }
    }

    /**
     * 游戏结束回调
     */
    onGameFinished(): void {
        this.game.stageManager.switchToStage(GameStage.END);
    }
}
```

### 5. EndStage (结束阶段)

```typescript
export class EndStage extends GameStageBase {
    private gameResult: any; // 游戏结果数据

    onEnter(): void {
        this.showUI();
        this.displayResults();
    }

    onExit(): void {
        this.hideUI();
    }

    showUI(): void {
        // 显示结算UI
    }

    hideUI(): void {
        // 隐藏结算UI
    }

    private displayResults(): void {
        // 显示分数、排名等
    }

    /**
     * 返回大厅
     */
    onReturnToLobby(): void {
        // TODO: 实现返回逻辑
    }

    /**
     * 再来一局
     */
    onPlayAgain(): void {
        this.game.stageManager.switchToStage(GameStage.READY);
    }
}
```

### 6. GameModeBase (游戏模式基类 - 扩展)

需要在现有基础上添加UI控制接口：

```typescript
export abstract class GameModeBase {
    protected game: Game;
    protected config: GameModeConfig;

    constructor(game: Game, config: GameModeConfig) {
        this.game = game;
        this.config = config;
    }

    // ===== 现有的抽象方法 =====
    abstract initGame(playerIds: string[]): void;
    abstract dealCards(): void;
    abstract isValidPlay(cards: number[], playerId: string): boolean;
    abstract playCards(cards: number[], playerId: string): boolean;
    abstract isGameOver(): boolean;
    abstract getCurrentLevelRank(): number;

    // ===== 新增：阶段生命周期 =====
    /**
     * 进入此游戏模式时调用
     */
    abstract onEnter(): void;

    /**
     * 离开此游戏模式时调用
     */
    abstract onExit(): void;

    // ===== 新增：UI 控制接口 =====
    /**
     * 显示游戏模式相关UI
     */
    abstract showUI(): void;

    /**
     * 隐藏游戏模式相关UI
     */
    abstract hideUI(): void;

    /**
     * 调整玩家位置布局
     */
    abstract adjustPlayerLayout(): void;
}
```

## 🔄 Game.ts 简化

重构后的 Game.ts 应该变得非常简洁：

```typescript
@ccclass('Game')
export class Game extends Component {
    // 资源相关
    private _pokerBundle: AssetManager.Bundle;
    private _pokerSprites: Map<string, SpriteFrame>;
    private _pokerPrefab: Prefab;

    // 管理器
    public stageManager: StageManager;

    // 配置
    private _gameMode: string;
    private _roomId: string;

    // 场景节点引用
    @property(Node)
    public nodeReadyStage: Node;

    @property(Node)
    public nodePlayingStage: Node;

    @property(Node)
    public nodeEndStage: Node;

    onLoad(): void {
        // 1. 获取配置
        this.loadConfiguration();

        // 2. 加载资源
        this.loadAssets();
    }

    private loadAssets(): void {
        // 加载Poker资源包
        assetManager.loadBundle("Pokers", (err, bundle) => {
            // ... 现有的加载逻辑
            this.onAssetsLoaded();
        });
    }

    private onAssetsLoaded(): void {
        // 3. 初始化PokerFactory
        PokerFactory.init(this._pokerSprites, this._pokerPrefab);

        // 4. 创建阶段管理器
        this.createStageManager();

        // 5. 进入准备阶段
        this.stageManager.switchToStage(GameStage.READY);
    }

    private createStageManager(): void {
        this.stageManager = new StageManager();

        // 注册所有阶段
        const readyStage = new ReadyStage(this, this.nodeReadyStage);
        const playingStage = new PlayingStage(this, this.nodePlayingStage, this._gameMode);
        const endStage = new EndStage(this, this.nodeEndStage);

        this.stageManager.registerStage(GameStage.READY, readyStage);
        this.stageManager.registerStage(GameStage.PLAYING, playingStage);
        this.stageManager.registerStage(GameStage.END, endStage);
    }

    onDestroy(): void {
        this.stageManager?.cleanup();
    }
}
```

## 📊 对比：重构前 vs 重构后

| 方面 | 重构前 | 重构后 |
|------|--------|--------|
| Game.ts 行数 | ~1200行 | ~200行 |
| 职责 | 资源加载 + 阶段管理 + 游戏逻辑 + UI管理 | 仅资源加载 + 初始化 |
| 阶段切换 | 手动管理，耦合严重 | StageManager统一管理 |
| 游戏模式 | 硬编码在Game.ts中 | 独立的类，继承统一基类 |
| UI管理 | 分散在各处 | 每个阶段/模式管理自己的UI |
| 扩展性 | 困难，需要修改多处 | 简单，添加新Stage/Mode即可 |
| 可维护性 | 差 | 好 |

## 🎯 实施步骤

### Phase 1: 创建基础架构 (1-2小时)
1. ✅ 创建 `GameStageBase.ts` - 阶段基类
2. ✅ 创建 `StageManager.ts` - 阶段管理器
3. ✅ 扩展 `GameModeBase.ts` - 添加UI接口

### Phase 2: 实现各个阶段 (2-3小时)
4. ✅ 实现 `ReadyStage.ts`
5. ✅ 实现 `PlayingStage.ts`
6. ✅ 实现 `EndStage.ts`

### Phase 3: 重构游戏模式 (2-3小时)
7. ✅ 重构 `TheDecreeMode.ts` - 适配新架构
8. ✅ 创建 `GuandanMode.ts` - 迁移现有逻辑

### Phase 4: 简化主入口 (1小时)
9. ✅ 简化 `Game.ts` - 移除所有阶段逻辑
10. ✅ 测试整体流程

### Phase 5: 测试和优化 (1-2小时)
11. ✅ 测试阶段切换
12. ✅ 测试游戏模式切换
13. ✅ 优化和调试

## ⚠️ 注意事项

1. **向后兼容**：确保场景中的节点引用不会失效
2. **渐进式重构**：先实现框架，再逐步迁移功能
3. **保留现有代码**：重构时先复制一份Game.ts作为备份
4. **测试频繁**：每完成一个阶段就测试一次

## 🤔 设计决策

### 为什么要分离Stage和GameMode？

- **Stage** = 游戏流程阶段（准备、游玩、结束）- 所有游戏都有
- **GameMode** = 具体游戏规则（天命之战、掼蛋）- 只在Playing阶段存在

这样设计的好处：
1. 职责清晰：Stage管流程，Mode管规则
2. 易于扩展：添加新游戏只需实现新Mode
3. 代码复用：多个Mode可以共享同一套Stage系统

### ReadyStage 应该挂载到哪里？

**推荐方案：作为Component挂载到 Node_ReadyStage**

原因：
1. Cocos Creator的组件化设计
2. 可以在编辑器中直接配置
3. UI事件处理更方便

**备选方案：纯TS类，通过StageManager管理**

原因：
1. 更纯粹的架构设计
2. 不依赖Cocos组件系统
3. 可以在非Cocos环境复用

**我的建议**：先用纯TS类实现，后续如果需要复杂UI交互再改成Component。

---

## 🚀 准备好开始了吗？

这是一个较大的重构，预计需要 6-10 小时完成。

你可以：
1. ✅ **立即开始** - 我会分步骤实施
2. 📝 **先看看设计** - 提出你的意见和建议
3. 🔧 **部分重构** - 只实现某些部分

请告诉我你的选择！
