# 方案 B：统一游戏模式架构 - 重构计划

## 📋 目标
将当前的 GameController (Guandan 实现) 重构为标准的 GameModeBase 子类，使所有游戏模式使用统一的接口。

## 🎯 当前架构分析

### 1. 现有组件依赖关系

```
Game.ts (场景控制器)
  └── GameController (Guandan 专用实现)
        ├── Player (玩家状态)
        ├── Dealer (发牌器)
        ├── HandEvaluator (掼蛋规则评估器)
        └── GameHandsManager (UI 手牌管理器)
              └── PlayerHandDisplay (玩家手牌显示)

TheDecreeMode (独立实现)
  ├── TexasHoldEmEvaluator (德州扑克规则评估器)
  └── 完整的游戏流程
```

### 2. 核心问题
- **GameController** = Guandan 的完整实现（~500 行代码）
- **GameHandsManager** 直接依赖 GameController
- **TheDecreeMode** 是独立实现，无法与现有 UI 集成
- **GuandanMode** 是空壳（TODO）

## 📝 重构步骤详解

### 阶段 1：定义统一接口 ⭐

#### 1.1 增强 GameModeBase 接口
**文件：** `Core/GameMode/GameModeBase.ts`

**需要添加的方法：**
```typescript
export abstract class GameModeBase {
    // 现有方法...

    // 新增：获取玩家数据（用于 UI 显示）
    public abstract getPlayers(): Player[];
    public abstract getPlayer(index: number): Player | null;
    public abstract getCurrentPlayerIndex(): number;

    // 新增：获取游戏状态
    public abstract getGameState(): any; // 游戏状态枚举
    public abstract getGamePhase(): any; // 游戏阶段枚举

    // 新增：Boss/Dealer 相关（可选，仅 Guandan 使用）
    public abstract getBossPlayerIndex(): number | null;
    public abstract getRemainingCards(): number[];
    public abstract getBurnedCards(): number[];

    // 新增：回合控制
    public abstract pass(): boolean;
    public abstract nextPlayer(): void;
}
```

**问题：**
- ⚠️ **接口膨胀**：不同游戏需要不同的方法，会导致接口过于臃肿
- ⚠️ **可选方法困境**：
  - Guandan 需要 `getBossPlayerIndex()`、`bossCollectCards()`
  - The Decree 需要 `dealerCall()`、`getCommunityCards()`
  - 如何处理游戏特有的方法？

**解决方案：**
- 方案 1：使用可选方法（返回 null 或抛出错误）
- 方案 2：使用泛型和类型守卫
- 方案 3：拆分为多个接口（推荐）

---

### 阶段 2：重构 GameController → GuandanMode ⭐⭐⭐

#### 2.1 创建新的 GuandanMode 类
**文件：** `Core/GameMode/GuandanMode.ts`（覆盖现有空壳）

**工作量估算：** 🔥🔥🔥 大型重构

**步骤：**
1. 将 GameController 的所有代码复制到 GuandanMode
2. 让 GuandanMode 继承 GameModeBase
3. 实现所有抽象方法
4. 保留 Guandan 特有的逻辑（Boss 收牌等）

**代码量：** ~600 行（GameController 现有代码）

**问题：**
- ⚠️ **Player 类的依赖**
  - GameController 使用 `Core/Player.ts`
  - TheDecreeMode 使用内部的 `PlayerState` 接口
  - **冲突**：两种不同的玩家表示方式

- ⚠️ **Dealer 类的依赖**
  - GameController 使用 `Card/Dealer.ts`
  - TheDecreeMode 自己管理牌堆
  - **冲突**：两种不同的发牌机制

**解决方案：**
- 统一 Player 类型（推荐）
- 或者在 GameModeBase 中定义通用的玩家接口

---

### 阶段 3：适配 UI 层 ⭐⭐

#### 3.1 修改 GameHandsManager
**文件：** `UI/GameHandsManager.ts`

**当前问题：**
```typescript
// 当前代码
public init(gameController: GameController, ...) {
    this._gameController = gameController;
    const players = this._gameController.players; // 直接访问属性
}
```

**需要改为：**
```typescript
// 重构后
public init(gameMode: GameModeBase, ...) {
    this._gameMode = gameMode;
    const players = this._gameMode.getPlayers(); // 通过接口访问
}
```

**工作量：** 🔥 中等（~50 行修改）

**问题：**
- ⚠️ **The Decree 的 UI 需求不同**
  - Guandan：5 个玩家位置，显示全部手牌
  - The Decree：2-4 个玩家，显示 5 张手牌 + 4 张公共牌
  - **冲突**：GameHandsManager 目前只支持 Guandan 布局

**解决方案：**
- 让 GameHandsManager 根据游戏模式动态创建 UI
- 或者为不同游戏创建不同的 HandsManager

---

### 阶段 4：修改 Game.ts ⭐

#### 4.1 使用统一接口
**文件：** `Game.ts`

**当前代码：**
```typescript
private _gameController: GameController = null!;

private startGameFlow(): void {
    this._gameController.init({...});
    this._gameController.createPlayers(playerNames);
    this._gameController.startGame();
}
```

**重构为：**
```typescript
private _gameMode: GameModeBase = null!;

private startGameFlow(): void {
    // 根据游戏模式创建实例
    if (this._gameModeId === 'the_decree') {
        this._gameMode = new TheDecreeMode();
    } else {
        this._gameMode = new GuandanMode();
    }

    this._gameMode.initGame(playerIds);
    this._gameMode.dealCards();
    // ...
}
```

**工作量：** 🔥 较小（~100 行修改）

**问题：**
- ⚠️ **游戏流程差异**
  - Guandan：Deal → Boss Collect → Play
  - The Decree：Deal → Select First Dealer → Dealer Call → Play
  - **冲突**：两个游戏的流程完全不同

**解决方案：**
- 在 GameModeBase 中定义 `startGameLoop()` 方法
- 每个游戏模式自己管理游戏流程

---

## ⚠️ 重大问题和挑战

### 问题 1：Player 类型不统一 🔴

**现状：**
- **GameController** 使用 `Core/Player.ts`：
  ```typescript
  export class Player {
      name: string;
      handCards: number[];
      state: PlayerState;
      // ... 更多属性
  }
  ```

- **TheDecreeMode** 使用内部接口：
  ```typescript
  interface PlayerState {
      id: string;
      hand: number[];
      score: number;
      playedCards: number[];
      hasPlayed: boolean;
  }
  ```

**影响：**
- GameHandsManager 需要访问玩家数据
- 两个游戏需要不同的玩家属性
- 无法在接口层统一

**解决方案：**
1. **方案 A**：统一为 `Core/Player.ts`
   - 在 Player 类中添加可选属性
   - The Decree 使用 Player 类
   - 👍 统一性好
   - 👎 Player 类变得臃肿

2. **方案 B**：GameModeBase 返回通用接口
   ```typescript
   interface IPlayer {
       id: string;
       name: string;
       handSize: number; // 只返回手牌数量，不返回具体牌
       // 其他通用属性
   }
   ```
   - 👍 接口简洁
   - 👎 UI 层需要额外方法获取详细信息

---

### 问题 2：UI 显示逻辑差异 🔴

**Guandan UI 需求：**
- 5 个玩家位置（Bottom, Left, TopLeft, TopRight, Right）
- 显示所有手牌（31 张）
- Boss 指示器
- 剩余牌堆

**The Decree UI 需求：**
- 2-4 个玩家位置
- 每人只显示 5 张手牌
- 4 张公共牌（中央）
- Dealer 指示器
- 当前回合数

**影响：**
- GameHandsManager 无法同时满足两种需求
- 需要大量条件判断或完全重写

**解决方案：**
1. **方案 A**：一个 Manager，多个模式
   ```typescript
   class GameHandsManager {
       init(gameMode: GameModeBase) {
           if (gameMode instanceof GuandanMode) {
               this.setupGuandanUI();
           } else if (gameMode instanceof TheDecreeMode) {
               this.setupTheDecreeUI();
           }
       }
   }
   ```
   - 👍 代码集中
   - 👎 if-else 地狱

2. **方案 B**：分离的 UI Manager
   - GuandanHandsManager
   - TheDecreeHandsManager
   - 👍 职责清晰
   - 👎 代码重复

---

### 问题 3：游戏流程差异 🟡

**Guandan 流程：**
```
Init → Deal → Boss Collect → Playing → Round End
```

**The Decree 流程：**
```
Init → Deal → Select First Dealer → Dealer Call → Player Selection → Showdown → Refill → Next Round
```

**影响：**
- Game.ts 无法使用统一的 `startGameFlow()`
- 每个游戏需要不同的 UI 事件处理

**解决方案：**
- 将游戏流程封装在 GameMode 内部
- Game.ts 只负责初始化和 UI 绑定
- 游戏模式通过回调通知 UI 更新

---

## 📊 工作量评估

| 阶段 | 任务 | 工作量 | 风险 | 优先级 |
|------|------|--------|------|--------|
| 1 | 增强 GameModeBase 接口 | 🔥 小 | 🟡 中 | ⭐⭐⭐ |
| 2 | 重构 GameController → GuandanMode | 🔥🔥🔥 大 | 🔴 高 | ⭐⭐⭐ |
| 3 | 统一 Player 类型 | 🔥🔥 中 | 🔴 高 | ⭐⭐⭐ |
| 4 | 适配 GameHandsManager | 🔥🔥 中 | 🟡 中 | ⭐⭐ |
| 5 | 修改 Game.ts | 🔥 小 | 🟢 低 | ⭐ |
| 6 | The Decree UI 实现 | 🔥🔥 中 | 🟡 中 | ⭐ |
| 7 | 测试和调试 | 🔥🔥 中 | 🔴 高 | ⭐⭐⭐ |

**总工作量：** 📅 3-5 天（全职开发）

---

## 🚨 关键风险

### 1. 破坏现有 Guandan 功能 🔴
- **风险：** 重构过程中可能破坏已经运行的 Guandan
- **缓解：**
  - 创建 GuandanMode 前，保留 GameController 作为备份
  - 分支开发，确保主分支可用
  - 写单元测试

### 2. 接口设计不当 🟡
- **风险：** 统一接口无法满足所有游戏需求
- **缓解：**
  - 先设计接口，再重构
  - 保留游戏特有方法的扩展点

### 3. UI 重构工作量爆炸 🟡
- **风险：** GameHandsManager 重构比预期复杂
- **缓解：**
  - 考虑方案 A（快速修复）作为备选
  - 先实现 Guandan UI，The Decree UI 可以后续添加

---

## 💡 推荐方案

### 混合方案（短期 + 长期）

**第一阶段（1-2 天）- 方案 A**
1. 在 Game.ts 中添加游戏模式分支
2. The Decree 使用 TheDecreeMode
3. Guandan 继续使用 GameController
4. ✅ **两个游戏立即可玩**

**第二阶段（3-5 天）- 方案 B**
1. 设计统一接口
2. 重构 GameController → GuandanMode
3. 适配 UI 层
4. ✅ **架构统一，易于扩展**

---

## 📁 文件清单

### 需要修改的文件（方案 B）
1. `Core/GameMode/GameModeBase.ts` - 增强接口
2. `Core/GameMode/GuandanMode.ts` - 重构 GameController
3. `Core/Player.ts` - 统一玩家类型（可能）
4. `UI/GameHandsManager.ts` - 适配统一接口
5. `Game.ts` - 使用 GameModeBase
6. `Core/GameController.ts` - 标记为废弃（可选）

### 需要创建的文件
1. `UI/TheDecreeHandsManager.ts` - The Decree UI（可选）
2. `Core/GameMode/IGameMode.ts` - 通用接口定义（可选）

---

## ✅ 结论

**方案 B 的优点：**
- ✅ 架构统一，易于维护
- ✅ 易于添加新游戏模式
- ✅ 代码复用性高

**方案 B 的缺点：**
- ❌ 工作量大（3-5 天）
- ❌ 风险高（可能破坏现有功能）
- ❌ 需要解决多个架构冲突

**建议：**
1. **如果时间紧迫** → 使用方案 A（1-2 小时）
2. **如果追求长期质量** → 使用方案 B（3-5 天）
3. **最佳方案** → 混合方案（先 A 后 B）

---

## 📞 下一步

需要确认：
1. 是否接受混合方案？
2. 是否现在开始方案 A？
3. 还是直接投入方案 B 的重构？
