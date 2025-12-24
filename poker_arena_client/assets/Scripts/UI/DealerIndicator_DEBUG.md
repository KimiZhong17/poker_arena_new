# DealerIndicator 调试指南

## 问题：没看到显示

### 快速检查清单

#### 1. 检查场景设置 ✓

确认以下节点已正确设置：

- [ ] 在场景中创建了 `DealerIndicator` 节点
- [ ] `DealerIndicator` 节点添加了 `DealerIndicator` 组件
- [ ] `DealerIndicator` 节点添加了 `UITransform` 组件
- [ ] `DealerIndicator` 节点添加了 `Sprite` 组件
- [ ] `Sprite` 组件设置了图标（SpriteFrame）
- [ ] `UITransform` 设置了合适的大小（如 100x100）
- [ ] `DealerIndicator` 节点放在 Canvas 下（或其他 UI 容器下）

#### 2. 检查 PlayerUIManager 绑定 ✓

- [ ] `PlayerUIManager` 组件的 `Dealer Indicator` 属性已绑定到 `DealerIndicator` 节点
- [ ] PlayerUIManager 已正确初始化

#### 3. 检查代码调用 ✓

- [ ] 在代码中调用了 `playerUIManager.showDealer(index)` 或 `playerUIManager.showDealer(index, true)`
- [ ] 玩家索引有效（0 到玩家数量-1）

### 常见问题和解决方案

#### 问题 1: Sprite 没有设置图标

**症状**: 控制台显示 "Sprite Frame: NO"

**解决方案**:
1. 在编辑器中选择 `DealerIndicator` 节点
2. 在 Inspector 中找到 `Sprite` 组件
3. 拖拽一个图片资源到 `SpriteFrame` 属性

或在代码中设置：
```typescript
// 在游戏初始化时
const dealerIcon = await resources.load('images/dealer-icon', SpriteFrame);
this.playerUIManager.dealerIndicator?.setIcon(dealerIcon);
```

#### 问题 2: 节点大小为 0

**症状**: 节点存在但看不见

**解决方案**:
1. 选择 `DealerIndicator` 节点
2. 在 Inspector 的 `UITransform` 中设置 Content Size:
   - Width: 100
   - Height: 100

#### 问题 3: 节点被其他 UI 遮挡

**症状**: 节点存在但被遮挡

**解决方案**:
1. 调整 `DealerIndicator` 节点在层级中的顺序（放到最下面显示在最上层）
2. 或者调整节点的 Z 坐标

#### 问题 4: 没有调用 showDealer

**症状**: 控制台没有 "[DealerIndicator] Moving to dealer" 日志

**解决方案**:
使用测试组件来测试：
1. 创建一个空节点，添加 `DealerIndicatorTest` 组件
2. 绑定 `PlayerUIManager`
3. 运行游戏，会自动每 2 秒切换庄家

或者在代码中手动调用：
```typescript
// 游戏开始时设置玩家 0 为庄家
this.playerUIManager.showDealer(0, true);

// 切换庄家时
this.playerUIManager.showDealer(newDealerIndex);
```

#### 问题 5: 坐标转换错误

**症状**: 节点显示在错误的位置或屏幕外

**解决方案**:
1. 检查控制台日志中的坐标信息
2. 调整 `offsetX` 和 `offsetY` 值
3. 确保 `DealerIndicator` 和 `PlayerUIManager` 在同一个坐标系统下

### 使用测试组件快速诊断

1. 将 `DealerIndicatorTest.ts` 组件添加到场景中的任意节点
2. 在 Inspector 中绑定 `PlayerUIManager`
3. 运行游戏
4. 查看控制台输出，会有详细的调试信息：

```
[DealerIndicatorTest] Test component started
[DealerIndicatorTest] PlayerUIManager: <Component>
[DealerIndicatorTest] DealerIndicator: <Component>
[DealerIndicatorTest] Player count: 4
[DealerIndicatorTest] Setting initial dealer to player 0
[DealerIndicator] ========== Moving to dealer 0 ==========
[DealerIndicator] Target world position: (x, y)
[DealerIndicator] Offset: (-150, 50)
...
```

### 调试步骤

1. **检查 DealerIndicator 是否加载**
   - 查找日志: `[DealerIndicator] onLoad - Initializing...`
   - 如果没有，说明组件未添加或节点未激活

2. **检查是否调用了 moveToDealerPosition**
   - 查找日志: `[DealerIndicator] ========== Moving to dealer`
   - 如果没有，说明 `showDealer` 未被调用

3. **检查节点是否激活**
   - 查找日志: `Node is now active: true`
   - 如果是 false，节点未正确激活

4. **检查 Sprite 是否有图标**
   - 查找日志: `Sprite Frame: YES` 或 `NO`
   - 如果是 NO，需要设置图标

5. **检查坐标**
   - 查看日志中的 Position 和 Scale 值
   - 确保坐标在屏幕范围内

### 临时测试：强制显示

如果需要快速测试是否是显示问题，可以临时修改 `DealerIndicator.onLoad()`:

```typescript
protected onLoad(): void {
    // ... 原有代码 ...

    // 临时测试：不隐藏节点
    // this.node.active = false;  // 注释掉这行
    this.node.active = true;  // 强制显示

    console.log('[DealerIndicator] TEST MODE - Node is always visible');
}
```

如果这样能看到，说明问题在于 `showDealer` 未被调用或调用时机不对。

### 推荐的测试流程

1. **第一步**: 在编辑器中确认节点可见
   - 设置 Sprite 图标
   - 设置合适的大小
   - 暂时不隐藏节点（active = true）

2. **第二步**: 运行游戏，检查节点是否可见

3. **第三步**: 添加 `DealerIndicatorTest` 组件测试移动功能

4. **第四步**: 在实际游戏逻辑中集成 `showDealer` 调用

### 需要帮助？

提供以下信息可以帮助诊断：
- 控制台完整日志（搜索 "DealerIndicator"）
- PlayerUIManager 是否正确初始化
- 玩家数量和布局
- 是否有调用 showDealer 的代码
