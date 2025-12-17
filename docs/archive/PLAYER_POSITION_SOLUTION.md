# 玩家位置布局解决方案

## 🤔 问题

你提出了一个非常好的问题：

> 不同游戏人数不同，会导致玩家位置也不同，PokerRoot放共享会有问题吗？

**具体情况：**
- **Guandan**: 5个玩家
- **The Decree**: 2-4个玩家（通常4人）

---

## 💡 解决方案

### ✅ 采用方案：共享 HoleCards + 动态调整位置

**核心思路：** 保持共享的 HoleCards/HandsManager，但根据游戏模式动态调整玩家手牌位置和可见性。

---

## 🎨 布局设计

### Guandan 布局（5人）

```
                TopLeft(-300, 280)    TopRight(300, 280)
                        *                    *


    Left(-550, 50)                                Right(550, 50)
          *                                             *


                        Bottom(0, -280)
                              *
```

### The Decree 布局（4人）

```
                      Top(0, 280)
                           *


    Left(-450, 0)                        Right(450, 0)
          *                                    *


                      Bottom(0, -280)
                           *
```

**关键差异：**
1. The Decree 使用钻石形状（菱形）布局
2. 顶部玩家居中（TopLeftHand 节点，但位置在 (0, 280)）
3. 左右玩家垂直居中
4. 第5个玩家位置（RightHand）隐藏

---

## 💻 代码实现

### Game.ts 中的实现

```typescript
/**
 * Setup UI for The Decree
 */
private setupTheDecreeUI(): void {
    console.log('[UI] Setting up The Decree UI');

    // Hide Guandan objects
    if (this.objectsGuandanNode) {
        this.objectsGuandanNode.active = false;
    }

    // Show The Decree objects
    if (this.objectsTheDecreeNode) {
        this.objectsTheDecreeNode.active = true;
    }

    // Show community cards
    if (this.communityCardsNode) {
        this.communityCardsNode.active = true;
    }

    // Adjust player positions for The Decree (4 players)
    this.adjustPlayerPositionsForTheDecree();
}

/**
 * Adjust player hand positions for The Decree layout (4 players)
 */
private adjustPlayerPositionsForTheDecree(): void {
    if (!this.handsManagerNode) return;

    // The Decree: 4 players in diamond formation
    const positions: Array<{ name: string; x: number; y: number; active: boolean }> = [
        { name: 'BottomHand', x: 0, y: -280, active: true },      // Player 0 (Bottom)
        { name: 'LeftHand', x: -450, y: 0, active: true },        // Player 1 (Left)
        { name: 'TopLeftHand', x: 0, y: 280, active: true },      // Player 2 (Top) - centered
        { name: 'TopRightHand', x: 450, y: 0, active: true },     // Player 3 (Right)
        { name: 'RightHand', x: 550, y: 50, active: false }       // Hidden for The Decree
    ];

    for (const config of positions) {
        const handNode = this.handsManagerNode.getChildByName(config.name);
        if (handNode) {
            handNode.active = config.active;
            if (config.active) {
                handNode.setPosition(config.x, config.y, 0);
            }
        }
    }

    console.log('[UI] Adjusted player positions for The Decree (4 players)');
}

/**
 * Setup UI for Guandan
 */
private setupGuandanUI(): void {
    console.log('[UI] Setting up Guandan UI');

    // Show Guandan objects
    if (this.objectsGuandanNode) {
        this.objectsGuandanNode.active = true;
    }

    // Hide The Decree objects
    if (this.objectsTheDecreeNode) {
        this.objectsTheDecreeNode.active = false;
    }

    // Hide community cards
    if (this.communityCardsNode) {
        this.communityCardsNode.active = false;
    }

    // Restore player positions for Guandan (5 players)
    this.adjustPlayerPositionsForGuandan();
}

/**
 * Adjust player hand positions for Guandan layout (5 players)
 */
private adjustPlayerPositionsForGuandan(): void {
    if (!this.handsManagerNode) return;

    // Guandan: 5 players layout
    const positions: Array<{ name: string; x: number; y: number; active: boolean }> = [
        { name: 'BottomHand', x: 0, y: -280, active: true },          // Player 0 (Main player)
        { name: 'LeftHand', x: -550, y: 50, active: true },           // Player 1 (Left)
        { name: 'TopLeftHand', x: -300, y: 280, active: true },       // Player 2 (Top Left)
        { name: 'TopRightHand', x: 300, y: 280, active: true },       // Player 3 (Top Right)
        { name: 'RightHand', x: 550, y: 50, active: true }            // Player 4 (Right)
    ];

    for (const config of positions) {
        const handNode = this.handsManagerNode.getChildByName(config.name);
        if (handNode) {
            handNode.active = config.active;
            handNode.setPosition(config.x, config.y, 0);
        }
    }

    console.log('[UI] Adjusted player positions for Guandan (5 players)');
}
```

---

## ✅ 优点

1. **✅ 代码复用** - PokerFactory 和 HandsManager 只需一份
2. **✅ 性能好** - 不需要重复创建/销毁节点，只是调整位置
3. **✅ 内存效率** - 共享节点，节省内存
4. **✅ 易于维护** - 集中管理扑克牌显示逻辑
5. **✅ 灵活** - 可以轻松添加新的游戏模式布局

---

## ⚠️ 注意事项

### 1. 节点命名约定

HandsManager 自动创建5个固定名称的节点：
- `BottomHand` - 主玩家（始终可见）
- `LeftHand` - 左侧玩家
- `TopLeftHand` - 左上玩家
- `TopRightHand` - 右上玩家
- `RightHand` - 右侧玩家（仅 Guandan 可见）

### 2. 位置调整时机

位置调整在 `setupTheDecreeUI()` 和 `setupGuandanUI()` 中进行，即：
- 切换游戏模式时
- 场景加载时

### 3. 支持动态玩家数量

如果 The Decree 需要支持 2-4 人动态变化，可以扩展 `adjustPlayerPositionsForTheDecree()` 方法：

```typescript
private adjustPlayerPositionsForTheDecree(playerCount: number = 4): void {
    // ... 现有代码 ...

    if (playerCount === 2) {
        // 2人布局：只显示 Bottom 和 Top
        positions[1].active = false;  // Hide Left
        positions[3].active = false;  // Hide Right
    } else if (playerCount === 3) {
        // 3人布局：Bottom, Left, Right（TopLeft居中作为Top）
        positions[3].active = false;  // Hide TopRight
    }

    // ... 应用位置 ...
}
```

---

## 🎯 替代方案（如果你想的话）

### 方案 B：每个游戏模式独立的 HandsManager

如果你觉得共享太复杂，也可以：

```
Objects_TheDecree
  └── GameplayLayer
      └── TheDecreeHandsManager (独立的4人HandsManager)

Objects_Guandan
  └── GameplayLayer
      └── GuandanHandsManager (独立的5人HandsManager)
```

**优点：**
- ✅ 完全独立，互不干扰
- ✅ 每个游戏可以有完全不同的手牌显示逻辑

**缺点：**
- ❌ 代码重复
- ❌ PokerFactory 需要在两个地方使用
- ❌ 维护成本高

---

## 📋 推荐

**推荐使用方案A（共享 HoleCards + 动态调整）**，因为：

1. 两个游戏都使用扑克牌，共享是合理的
2. 位置调整逻辑很简单，只是坐标和可见性
3. 性能和内存效率更好
4. 如果未来有第三个游戏模式，可以轻松添加新的布局

---

## 🚀 使用方法

1. **在 Cocos Creator 中**
   - HandsManager 会被 Game.ts 自动创建
   - 不需要手动调整位置，代码会自动处理

2. **测试不同游戏模式**
   - 从 Hall 选择 "The Decree" → 看到4人菱形布局
   - 从 Hall 选择 "Guandan" → 看到5人布局

3. **如果需要调整位置**
   - 修改 `adjustPlayerPositionsForTheDecree()` 或 `adjustPlayerPositionsForGuandan()` 中的坐标
   - 坐标单位是像素，原点在屏幕中心

---

## 📞 总结

你的担心是对的！不同游戏模式确实需要不同的布局。但通过**动态调整位置和可见性**，我们可以很好地解决这个问题，同时保持代码复用和性能优势。

**核心思想：**
- 共享节点结构（HoleCards/HandsManager）
- 动态调整位置、可见性
- 根据游戏模式选择合适的布局

这样既解决了你的问题，又保持了架构的清晰和高效！🎯
