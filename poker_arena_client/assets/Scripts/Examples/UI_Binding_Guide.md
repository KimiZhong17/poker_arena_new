# UI 按钮绑定指南

## 🎯 推荐方案：独立 UI 控制器

**不要**直接在 Game.ts 中绑定按钮，而是为每个游戏模式创建独立的 UI 控制器。

## 📐 架构设计

```
Game.ts (游戏逻辑)
    ↑
    │ 调用游戏接口
    │
TheDecreeUIController.ts (The Decree UI 控制器)
    ↑
    │ 处理按钮点击
    │
ObjectTheDecreeNode (节点)
    └── PlayButton
    └── CallOneButton
    └── CallTwoButton
    └── CallThreeButton
    └── ClearSelectionButton
    └── StatusLabel
```

## 🚀 如何使用

### 步骤 1：在编辑器中设置节点结构

```
Main (场景根节点)
├── ObjectGuandanNode
│   ├── PlayButton (Button 组件)
│   ├── PassButton (Button 组件)
│   ├── ClearSelectionButton (Button 组件)
│   └── StatusLabel (Label 组件)
│
└── ObjectTheDecreeNode
    ├── PlayButton (Button 组件)
    ├── CallOneButton (Button 组件)
    ├── CallTwoButton (Button 组件)
    ├── CallThreeButton (Button 组件)
    ├── ClearSelectionButton (Button 组件)
    └── StatusLabel (Label 组件)
```

### 步骤 2：添加 UI 控制器组件

在编辑器中：

1. **选中 ObjectTheDecreeNode 节点**
2. **添加组件 → 搜索 "TheDecreeUIController"**
3. **（可选）在属性面板手动绑定按钮**

同样，对 ObjectGuandanNode 添加 GuandanUIController 组件。

### 步骤 3：两种绑定方式

#### 方式 1：自动查找（推荐用于简单项目）

只要按钮节点名称匹配，组件会自动查找：

```typescript
// 自动查找这些名称的节点
- PlayButton
- PassButton (Guandan)
- CallOneButton (The Decree)
- CallTwoButton (The Decree)
- CallThreeButton (The Decree)
- ClearSelectionButton
- StatusLabel
```

**优点**：不需要手动绑定，改名即可
**缺点**：节点名称必须严格匹配

#### 方式 2：手动绑定（推荐用于复杂项目）

在编辑器的属性面板中手动拖拽绑定：

![绑定示例](./images/ui-binding.png)

**优点**：灵活，节点名称随意
**缺点**：需要手动操作

## 📝 完整示例

### The Decree 模式按钮布局

```typescript
// TheDecreeUIController 自动处理以下逻辑：

// 1. 游戏开始 → 启用牌选择
onLoad() {
    this.enableCardSelection(); // 玩家可以点击牌
}

// 2. 玩家选择牌 → 更新按钮状态
onSelectionChanged(selectedIndices) {
    if (selectedIndices.length > 0) {
        this.playButton.interactable = true;  // 启用"出牌"按钮
    } else {
        this.playButton.interactable = false; // 禁用"出牌"按钮
    }
}

// 3. 玩家点击"出牌" → 调用游戏接口
onPlayButtonClicked() {
    this._game.playerSelectCards('player_0', this._selectedCardIndices);
    this._game.handsManager.clearSelection(0);
}

// 4. 庄家叫牌 → 调用游戏接口
onCallButtonClicked(cardsCount) {
    this._game.dealerCall(cardsCount); // 1, 2, or 3
    this.hideCallButtons(); // 叫完后隐藏叫牌按钮
}
```

### Guandan 模式按钮布局

```typescript
// GuandanUIController 自动处理以下逻辑：

// 1. 玩家点击"出牌"
onPlayButtonClicked() {
    this._game.playerSelectCards('0', this._selectedCardIndices);
    this._game.handsManager.clearSelection(0);
}

// 2. 玩家点击"不出"
onPassButtonClicked() {
    this._game.playerPass('0');
    this._game.handsManager.clearSelection(0);
}
```

## 🎨 自定义 UI 控制器

如果你需要自定义按钮逻辑，只需修改对应的 UI 控制器：

```typescript
// 例如：添加一个"提示"按钮
@property(Button)
public hintButton: Button | null = null;

private registerButtonEvents(): void {
    // ... 其他按钮

    if (this.hintButton) {
        this.hintButton.node.on(Button.EventType.CLICK, this.onHintButtonClicked, this);
    }
}

private onHintButtonClicked(): void {
    // 调用游戏接口获取提示
    const hint = this.getCardHint();
    this._game.handsManager.selectCards(0, hint);
}
```

## ✅ 为什么这样设计？

### 优点

1. **关注点分离**
   - Game.ts 只负责游戏逻辑
   - UI 控制器只负责 UI 交互
   - 职责清晰，易于维护

2. **易于扩展**
   - 添加新按钮只需修改 UI 控制器
   - 不会污染 Game.ts

3. **可复用**
   - 不同场景可以复用同一个 UI 控制器
   - 可以轻松创建不同的 UI 主题

4. **测试友好**
   - UI 逻辑和游戏逻辑分离
   - 可以独立测试

### 对比：如果绑定到 Game.ts

```typescript
// ❌ 不推荐：Game.ts 会变得臃肿
@ccclass('Game')
export class Game extends Component {
    // 游戏逻辑属性
    private _gameController: GameController;
    private _handsManager: GameHandsManager;

    // The Decree UI 属性
    @property(Button)
    public theDecreePlayButton: Button;
    @property(Button)
    public theDecreeCallOneButton: Button;
    // ... 更多 The Decree 按钮

    // Guandan UI 属性
    @property(Button)
    public guandanPlayButton: Button;
    @property(Button)
    public guandanPassButton: Button;
    // ... 更多 Guandan 按钮

    // 结果：Game.ts 变得非常臃肿，难以维护！
}
```

## 📚 相关文件

- [TheDecreeUIController.ts](../UI/TheDecreeUIController.ts) - The Decree UI 控制器
- [GuandanUIController.ts](../UI/GuandanUIController.ts) - Guandan UI 控制器
- [Game.ts](../Game.ts) - 游戏主控制器（提供接口）

## 🔧 FAQ

### Q1: 我想手动绑定按钮，怎么做？

在编辑器中：
1. 选中 ObjectTheDecreeNode
2. 在属性面板找到 TheDecreeUIController 组件
3. 将按钮节点拖拽到对应的属性上

### Q2: 自动查找按钮失败怎么办？

检查以下几点：
1. 节点名称是否正确（区分大小写）
2. 按钮是否在 UI 控制器节点的直接子节点下
3. 如果按钮在更深层级，修改 `autoFindUIElements()` 方法

### Q3: 我需要多个"出牌"按钮怎么办？

可以在 UI 控制器中添加多个按钮属性：

```typescript
@property(Button)
public playButton1: Button | null = null;

@property(Button)
public playButton2: Button | null = null;
```

### Q4: 如何在不同游戏阶段切换按钮状态？

在 UI 控制器中添加方法：

```typescript
public showDealerPhaseUI(): void {
    this.showCallButtons();
    this.playButton.node.active = false;
}

public showPlayingPhaseUI(): void {
    this.hideCallButtons();
    this.playButton.node.active = true;
}
```

然后在 Game.ts 中调用：

```typescript
// 在 Game.ts 中
private theDecreeUI: TheDecreeUIController;

private startDealerPhase(): void {
    this.theDecreeUI?.showDealerPhaseUI();
}
```

## 🎯 总结

✅ **推荐**：使用独立的 UI 控制器（TheDecreeUIController / GuandanUIController）
✅ **绑定方式**：自动查找（简单）或手动绑定（灵活）
❌ **避免**：在 Game.ts 中直接绑定 UI 元素

这样设计让代码更清晰、更易维护、更容易扩展！🚀
