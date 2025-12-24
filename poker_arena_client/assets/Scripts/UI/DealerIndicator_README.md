# DealerIndicator 使用说明

## 概述

DealerIndicator 是一个独立的庄家指示器组件，可以显示一个图标/图案，并根据庄家变化自动移动到对应玩家旁边。

## 功能特性

- ✅ 独立的可移动图标组件
- ✅ 平滑的移动动画
- ✅ 自动跟随庄家位置
- ✅ 可自定义偏移量和动画时长
- ✅ 支持立即移动或动画移动

## 使用步骤

### 1. 在场景中创建 DealerIndicator 节点

在 Cocos Creator 编辑器中：

1. 在 Canvas 下创建一个新的空节点，命名为 `DealerIndicator`
2. 为该节点添加 `UITransform` 组件
3. 为该节点添加 `DealerIndicator` 组件
4. （可选）为该节点添加 `Sprite` 组件用于显示图标

### 2. 配置 DealerIndicator 属性

在 Inspector 面板中配置以下属性：

- **Icon Sprite**: 庄家图标的 Sprite 组件（如果没有会自动创建）
- **Move Duration**: 移动动画时长（秒），默认 0.5 秒
- **Offset X**: 相对于玩家位置的 X 偏移，默认 -150
- **Offset Y**: 相对于玩家位置的 Y 偏移，默认 50

### 3. 绑定到 PlayerUIManager

在 PlayerUIManager 节点的 Inspector 面板中：

1. 找到 `Dealer Indicator` 属性
2. 将刚创建的 DealerIndicator 节点拖拽到该属性

### 4. 设置庄家图标（可选）

如果你想在运行时设置图标：

```typescript
// 在你的游戏初始化代码中
const dealerIcon: SpriteFrame = ...; // 加载你的图标资源
this.playerUIManager.dealerIndicator?.setIcon(dealerIcon);
```

### 5. 显示庄家指示器

在游戏代码中，当庄家改变时调用：

```typescript
// dealerIndex 是庄家玩家的索引（0-4）
this.playerUIManager.showDealer(dealerIndex);

// 或者立即移动（不使用动画，适用于初始化时）
this.playerUIManager.showDealer(dealerIndex, true);
```

### 6. 隐藏庄家指示器

当需要隐藏指示器时：

```typescript
this.playerUIManager.hideAllDealers();
```

## API 参考

### DealerIndicator 组件

#### 属性

- `iconSprite: Sprite | null` - 图标精灵组件
- `moveDuration: number` - 移动动画时长（秒）
- `offsetX: number` - X轴偏移量
- `offsetY: number` - Y轴偏移量

#### 方法

**setIcon(spriteFrame: SpriteFrame): void**
- 设置庄家图标
- 参数：图标精灵帧

**moveToDealerPosition(dealerIndex: number, targetWorldPos: {x, y}, immediate?: boolean): void**
- 移动到庄家位置
- 参数：
  - `dealerIndex`: 庄家索引
  - `targetWorldPos`: 目标世界坐标
  - `immediate`: 是否立即移动（默认 false）

**show(): void**
- 显示指示器

**hide(): void**
- 隐藏指示器

**setOffset(offsetX: number, offsetY: number): void**
- 设置偏移量
- 参数：X和Y轴偏移

**getCurrentDealerIndex(): number**
- 获取当前庄家索引

**isAnimating(): boolean**
- 检查是否正在动画中

### PlayerUIManager 更新

**showDealer(dealerIndex: number, immediate?: boolean): void**
- 显示庄家指示器
- 参数：
  - `dealerIndex`: 庄家索引
  - `immediate`: 是否立即移动（默认 false）

**hideAllDealers(): void**
- 隐藏所有庄家标识

## 示例代码

```typescript
import { _decorator, Component } from 'cc';
import { PlayerUIManager } from './UI/PlayerUIManager';

const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    @property(PlayerUIManager)
    playerUIManager: PlayerUIManager = null!;

    start() {
        // 游戏开始时，设置玩家0为庄家（立即显示）
        this.playerUIManager.showDealer(0, true);
    }

    onDealerChanged(newDealerIndex: number) {
        // 当庄家改变时，移动指示器（带动画）
        this.playerUIManager.showDealer(newDealerIndex, false);
    }

    onGameEnd() {
        // 游戏结束时隐藏指示器
        this.playerUIManager.hideAllDealers();
    }
}
```

## 注意事项

1. **坐标系统**: DealerIndicator 使用世界坐标系统来定位，确保它放在 Canvas 层级下
2. **偏移调整**: 根据你的 UI 布局，可能需要调整 `offsetX` 和 `offsetY` 值
3. **图标大小**: 确保你的图标 Sprite 有合适的大小，可以在 UITransform 中调整
4. **动画时长**: 可以根据游戏节奏调整 `moveDuration`，更快或更慢
5. **Z 轴顺序**: 如果图标被其他 UI 遮挡，调整节点的顺序或 Z 坐标

## 自定义建议

### 调整不同玩家位置的偏移

如果需要为不同玩家设置不同的偏移，可以在调用前动态调整：

```typescript
// 根据玩家索引调整偏移
const offsets = [
    { x: -150, y: 50 },   // 玩家0（底部）
    { x: 100, y: 0 },     // 玩家1（左侧）
    { x: -150, y: -50 },  // 玩家2（顶部）
    { x: -100, y: 0 },    // 玩家3（右侧）
];

const offset = offsets[dealerIndex];
this.playerUIManager.dealerIndicator?.setOffset(offset.x, offset.y);
this.playerUIManager.showDealer(dealerIndex);
```

### 添加旋转动画

可以扩展 DealerIndicator 组件添加旋转效果：

```typescript
// 在 moveToDealerPosition 方法中添加
tween(this.node)
    .to(this.moveDuration, { position: localPos })
    .call(() => {
        // 到达后旋转一圈
        tween(this.node)
            .by(0.3, { angle: 360 })
            .start();
    })
    .start();
```

## 文件位置

- 组件实现: `assets/Scripts/UI/DealerIndicator.ts`
- 集成代码: `assets/Scripts/UI/PlayerUIManager.ts`
- 本说明文档: `assets/Scripts/UI/DealerIndicator_README.md`
