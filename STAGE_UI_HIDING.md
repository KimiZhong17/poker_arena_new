# StageManager UI 隐藏优化

## 🎯 问题

之前在切换阶段时，只调用了当前阶段的 `onExit()`，但没有显式隐藏其他阶段的 UI，可能导致：
- 多个阶段的 UI 同时显示
- UI 层级混乱
- 视觉效果不佳

## ✅ 解决方案（最终版本）

采用更优雅的 OOP 设计：**让每个 Stage 在 onExit() 中自己负责隐藏 UI**

### 方案演进

#### ❌ 初始方案：在 StageManager 中集中隐藏
```typescript
// StageManager 负责隐藏所有其他阶段
public switchToStage(stageType: GameStage): boolean {
    if (this.currentStage) {
        this.currentStage.onExit();
    }

    // ❌ 由 StageManager 负责隐藏
    this.hideAllStagesExcept(stageType);

    this.currentStage = targetStage;
    this.currentStage.onEnter();
}
```

**问题：**
- 职责不清晰 - StageManager 需要管理所有 Stage 的 UI
- 代码冗余 - 需要额外的 `hideAllStagesExcept()` 方法
- 违反封装原则 - Stage 的 UI 应该由 Stage 自己管理

#### ✅ 最终方案：在 GameStageBase.onExit() 中自动隐藏

### 修改位置

1. [GameStageBase.ts:47](poker_arena_client/assets/Scripts/Core/Stage/GameStageBase.ts#L47) - 基类
2. [StageManager.ts:82](poker_arena_client/assets/Scripts/Core/Stage/StageManager.ts#L82) - 简化
3. [ReadyStage.ts:111](poker_arena_client/assets/Scripts/Core/Stage/ReadyStage.ts#L111) - 子类
4. [PlayingStage.ts:71](poker_arena_client/assets/Scripts/Core/Stage/PlayingStage.ts#L71) - 子类
5. [EndStage.ts:59](poker_arena_client/assets/Scripts/Core/Stage/EndStage.ts#L59) - 子类

### 改动内容

#### 1. GameStageBase - 基类提供默认实现

```typescript
/**
 * 离开此阶段时调用
 * 默认会自动隐藏UI，子类可以覆盖此方法添加额外的清理逻辑
 */
public onExit(): void {
    console.log(`[${this.constructor.name}] Exiting stage`);
    this.isActive = false;
    this.hideUI();  // ✨ 自动隐藏 UI
}
```

#### 2. StageManager - 简化逻辑

```typescript
public switchToStage(stageType: GameStage): boolean {
    // ... 检查逻辑 ...

    // 退出当前阶段（onExit 会自动调用 hideUI）
    if (this.currentStage) {
        this.currentStage.onExit();  // ✨ hideUI 自动被调用
    }

    // 进入新阶段
    this.currentStage = targetStage;
    this.currentStageType = stageType;
    this.currentStage.onEnter();

    return true;
}

// ✨ 删除了 hideAllStagesExcept() 方法（不再需要）
```

#### 3. 各 Stage 子类 - 调用 super.onExit()

```typescript
// ReadyStage, PlayingStage, EndStage 都使用相同模式：
public onExit(): void {
    console.log('[XXXStage] Exiting stage');

    // 1. 清理特定资源（按钮事件、数据等）
    this.cleanupButtons();
    this.gameResult = null;

    // 2. 调用基类的 onExit（会自动隐藏UI）
    super.onExit();  // ✨ 自动调用 hideUI()
}
```

## 📊 工作流程

### 切换阶段时的完整流程

```
switchToStage(PLAYING)
    ↓
1. 检查目标阶段是否已注册
    ↓
2. 退出当前阶段
   ReadyStage.onExit()
    ├── 清理按钮事件
    └── super.onExit()
        ├── isActive = false
        └── hideUI() ✨ 自动隐藏 UI
    ↓
3. 设置新的当前阶段
   currentStage = PlayingStage
    ↓
4. 进入新阶段
   PlayingStage.onEnter()
   └── 显示 Playing UI
```

## 🎯 优点对比

### 最终方案的优势

| 优点 | 说明 |
|------|------|
| ✅ **职责清晰** | 每个 Stage 负责自己的 UI 生命周期 |
| ✅ **代码简洁** | 不需要 `hideAllStagesExcept()` 方法 |
| ✅ **符合 OOP 原则** | 封装性更好，Stage 自己管理自己的状态 |
| ✅ **防御性更强** | 即使不是通过 StageManager 调用，UI 也会正确隐藏 |
| ✅ **易于理解** | 生命周期方法的职责更直观：onEnter 显示 / onExit 隐藏 |
| ✅ **扩展性好** | 新增 Stage 不需要修改 StageManager |

### 代码量对比

| 方案 | 代码量 |
|------|--------|
| 集中隐藏方案 | StageManager +11 行（hideAllStagesExcept） |
| **最终方案** | GameStageBase +3 行，StageManager -11 行，各子类 -1 行 |
| **净减少** | ~10 行 |

## 🔍 各阶段的实现

### 基类 - GameStageBase

```typescript
public onExit(): void {
    console.log(`[${this.constructor.name}] Exiting stage`);
    this.isActive = false;
    this.hideUI();  // 自动隐藏 UI
}
```

### 子类 - ReadyStage, PlayingStage, EndStage

```typescript
public onExit(): void {
    console.log('[ReadyStage] Exiting ready stage');

    // 1. 清理特定资源
    this.cleanupButtons();

    // 2. 调用基类（会自动隐藏UI）
    super.onExit();
}
```

## 📝 设计原则

### onExit() 的职责

现在 `onExit()` 有了更清晰的职责分离：

| 层级 | 职责 |
|------|------|
| **基类 onExit()** | 设置 `isActive = false`，调用 `hideUI()` |
| **子类 onExit()** | 清理特定资源（事件监听、数据状态等），然后调用 `super.onExit()` |

### 生命周期对称性

```
onEnter()              onExit()
  ↓                       ↓
显示 UI (showUI)      隐藏 UI (hideUI)
  ↓                       ↓
初始化资源            清理资源
  ↓                       ↓
isActive = true       isActive = false
```

## 🧪 测试要点

- [ ] Ready → Playing 切换：Ready UI 自动隐藏，Playing UI 显示
- [ ] Playing → End 切换：Playing UI 自动隐藏，End UI 显示
- [ ] End → Ready 切换：End UI 自动隐藏，Ready UI 显示
- [ ] 快速切换阶段：UI 不会闪烁或重叠
- [ ] 控制台日志清晰：能看到 onExit() 自动调用 hideUI()
- [ ] 直接调用 stage.onExit()（不通过 StageManager）：UI 也能正确隐藏

## 🔄 与之前重构的关系

这个优化与之前的重构完美配合：

```
StageManager.switchToStage()
    ↓
当前 Stage.onExit()  (基类方法)
    ↓
自动调用 hideUI()
    ↓
PlayingStage.hideUI()
    ↓
TheDecreeMode.hideUI()  (代理)
    ↓ 隐藏模式特定的 UI
objectsTheDecreeNode.active = false
communityCardsNode.active = false
```

## 📊 代码统计

| 指标 | 数值 |
|------|------|
| 修改基类 | 1 (GameStageBase: abstract → 默认实现) |
| 修改 StageManager | 1 (删除 hideAllStagesExcept) |
| 修改子类 | 3 (ReadyStage, PlayingStage, EndStage) |
| 新增代码行 | +3 (基类) |
| 删除代码行 | -15 (StageManager -11, 子类 -4) |
| 净减少 | 12 行 |

## 💡 设计思考

### 为什么这个方案更好？

1. **单一职责原则** - 每个类只负责自己的事情
2. **开闭原则** - 对扩展开放（新 Stage 自动获得此行为），对修改封闭
3. **里氏替换原则** - 子类可以安全覆盖 onExit()，只需调用 super.onExit()
4. **依赖倒置原则** - StageManager 依赖抽象（GameStageBase），不关心具体实现

### 用户的洞察

这个优化源自用户的建议：

> "其实是不是在 onExit 里调用一下 hideUI 也可以"

这个简单的建议揭示了一个重要的设计原则：**让对象自己管理自己的状态**，而不是由外部管理器去控制所有对象的状态。

---

**优化完成日期：** 2025-12-19（最终版本）

**相关文件：**
- [GameStageBase.ts](poker_arena_client/assets/Scripts/Core/Stage/GameStageBase.ts) - 基类
- [StageManager.ts](poker_arena_client/assets/Scripts/Core/Stage/StageManager.ts) - 简化
- [ReadyStage.ts](poker_arena_client/assets/Scripts/Core/Stage/ReadyStage.ts) - 子类
- [PlayingStage.ts](poker_arena_client/assets/Scripts/Core/Stage/PlayingStage.ts) - 子类
- [EndStage.ts](poker_arena_client/assets/Scripts/Core/Stage/EndStage.ts) - 子类
