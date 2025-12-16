# 牌点击交互使用指南

## 📖 概述

现在你可以监听玩家点击（touch）牌的事件了！系统已经实现了完整的牌点击/选择功能。

## 🎯 功能特性

- ✅ **点击选择**：玩家可以点击牌来选择/取消选择
- ✅ **视觉反馈**：选中的牌会自动向上移动（默认 20px）
- ✅ **回调通知**：选择改变时会触发回调函数
- ✅ **多选支持**：可以同时选择多张牌
- ✅ **游戏模式通用**：适用于 Guandan 和 The Decree 模式

## 📁 相关文件

### 核心文件
- [Poker.ts](../UI/Poker.ts) - 单张牌组件，处理点击和选择状态
- [PlayerHandDisplay.ts](../UI/PlayerHandDisplay.ts) - 玩家手牌显示，管理牌的选择
- [GameHandsManager.ts](../UI/GameHandsManager.ts) - 所有玩家手牌管理器
- [Game.ts](../Game.ts) - 游戏主控制器，提供统一的出牌接口

### 示例文件
- [CardSelectionExample.ts](./CardSelectionExample.ts) - 完整使用示例

## 🚀 快速开始

### 1. 启用牌的点击交互

```typescript
import { Game } from '../Game';

// 获取 Game 实例
const game = this.node.getComponent(Game);

// 启用玩家 0（主玩家）的牌点击
game.handsManager.enableCardSelection(0, (selectedIndices: number[]) => {
    console.log(`选中的牌索引: [${selectedIndices.join(', ')}]`);

    // 在这里处理选择改变
    // 例如：更新 UI 按钮状态
});
```

### 2. 获取选中的牌

```typescript
// 获取玩家 0 当前选中的牌索引
const selectedIndices = game.handsManager.getSelectedIndices(0);
console.log(`已选中 ${selectedIndices.length} 张牌`);
```

### 3. 打出选中的牌

```typescript
// 获取选中的牌
const selectedIndices = game.handsManager.getSelectedIndices(0);

if (selectedIndices.length > 0) {
    // 使用统一的 playerSelectCards 接口打牌
    const success = game.playerSelectCards('0', selectedIndices);

    if (success) {
        // 打牌成功，清除选择
        game.handsManager.clearSelection(0);
    } else {
        console.error('打牌失败');
    }
}
```

### 4. 禁用点击交互

```typescript
// 禁用玩家 0 的牌点击
game.handsManager.disableCardSelection(0);
```

## 🎮 完整游戏流程示例

```typescript
import { _decorator, Component, Node } from 'cc';
import { Game } from '../Game';
const { ccclass } = _decorator;

@ccclass('GameUI')
export class GameUI extends Component {

    private _game: Game = null!;
    private _currentSelectedCards: number[] = [];

    start() {
        // 获取游戏实例
        this._game = this.node.getComponent(Game);

        // 游戏开始后启用牌选择
        this.scheduleOnce(() => {
            this.enableCardSelection();
        }, 2);
    }

    /**
     * 启用牌选择
     */
    private enableCardSelection(): void {
        this._game.handsManager.enableCardSelection(0, (selectedIndices) => {
            this._currentSelectedCards = selectedIndices;
            this.updatePlayButton();
        });
    }

    /**
     * 更新"出牌"按钮状态
     */
    private updatePlayButton(): void {
        const canPlay = this._currentSelectedCards.length > 0;
        // 更新按钮状态（enable/disable）
        console.log(`出牌按钮: ${canPlay ? '启用' : '禁用'}`);
    }

    /**
     * 玩家点击"出牌"按钮
     */
    public onPlayButtonClicked(): void {
        if (this._currentSelectedCards.length === 0) {
            console.log('请先选择牌！');
            return;
        }

        const success = this._game.playerSelectCards('0', this._currentSelectedCards);

        if (success) {
            console.log('出牌成功！');
            this._game.handsManager.clearSelection(0);
            this._currentSelectedCards = [];
            this.updatePlayButton();
        } else {
            console.log('出牌失败！');
        }
    }

    /**
     * 玩家点击"不出"按钮（Guandan 模式）
     */
    public onPassButtonClicked(): void {
        const success = this._game.playerPass('0');

        if (success) {
            console.log('Pass 成功！');
            this._game.handsManager.clearSelection(0);
            this._currentSelectedCards = [];
            this.updatePlayButton();
        } else {
            console.log('不能 Pass！');
        }
    }

    /**
     * 清除选择
     */
    public onClearSelectionClicked(): void {
        this._game.handsManager.clearSelection(0);
        this._currentSelectedCards = [];
        this.updatePlayButton();
    }
}
```

## 🛠️ API 参考

### Poker 组件 (单张牌)

```typescript
// 启用点击
poker.enableClick(cardIndex: number, callback: CardClickCallback): void

// 禁用点击
poker.disableClick(): void

// 设置选中状态
poker.setSelected(selected: boolean): void

// 检查是否选中
poker.isSelected(): boolean

// 获取牌索引
poker.getCardIndex(): number
```

### PlayerHandDisplay 组件 (手牌显示)

```typescript
// 启用牌选择
playerHandDisplay.enableCardSelection(callback: SelectionChangedCallback): void

// 禁用牌选择
playerHandDisplay.disableCardSelection(): void

// 获取选中的牌索引
playerHandDisplay.getSelectedIndices(): number[]

// 清除选择
playerHandDisplay.clearSelection(): void

// 程序化选择牌
playerHandDisplay.selectCards(indices: number[]): void
```

### GameHandsManager 组件 (管理所有玩家手牌)

```typescript
// 启用指定玩家的牌选择
enableCardSelection(playerIndex: number, callback: SelectionChangedCallback): void

// 禁用指定玩家的牌选择
disableCardSelection(playerIndex: number): void

// 获取指定玩家的选中牌
getSelectedIndices(playerIndex: number): number[]

// 清除指定玩家的选择
clearSelection(playerIndex: number): void

// 获取指定玩家的手牌显示组件
getPlayerHandDisplay(playerIndex: number): PlayerHandDisplay | null
```

### Game 组件 (游戏主控制器)

```typescript
// 通用出牌接口（支持所有游戏模式）
playerSelectCards(playerId: string, cardIndices: number[]): boolean

// 通用 Pass 接口（仅 Guandan 模式）
playerPass(playerId: string): boolean

// 获取手牌管理器
get handsManager(): GameHandsManager
```

## 📝 回调函数类型

```typescript
// 牌点击回调
export type CardClickCallback = (
    card: Poker,           // 被点击的牌组件
    cardValue: number,     // 牌的值
    cardIndex: number      // 牌在手牌中的索引
) => void;

// 选择改变回调
export type SelectionChangedCallback = (
    selectedIndices: number[]  // 当前选中的所有牌索引（已排序）
) => void;
```

## 💡 最佳实践

### 1. 轮到玩家时才启用点击
```typescript
// 当轮到玩家 0 时
if (currentPlayerIndex === 0) {
    game.handsManager.enableCardSelection(0, onSelectionChanged);
} else {
    game.handsManager.disableCardSelection(0);
}
```

### 2. 验证选择的牌是否合法
```typescript
private onSelectionChanged(selectedIndices: number[]): void {
    // 检查是否选择了足够的牌
    if (selectedIndices.length < 1) {
        this.disablePlayButton();
        return;
    }

    // 可以在这里添加更多验证逻辑
    // 例如：检查牌型是否合法

    this.enablePlayButton();
}
```

### 3. 出牌后清除选择
```typescript
const success = game.playerSelectCards('0', selectedIndices);
if (success) {
    // 重要：出牌成功后清除选择
    game.handsManager.clearSelection(0);
}
```

### 4. 使用视觉反馈
```typescript
// Poker 组件已经内置了视觉反馈
// 选中时会向上移动 20px
// 如需自定义，可以修改 Poker.ts 中的 SELECTED_OFFSET_Y 常量
```

## 🎨 自定义选择效果

如果想自定义选中的视觉效果，可以修改 [Poker.ts](../UI/Poker.ts)：

```typescript
// 在 Poker 类中
private readonly SELECTED_OFFSET_Y = 30; // 改为 30px

// 或者修改 setSelected 方法添加更多效果
public setSelected(selected: boolean): void {
    this._isSelected = selected;

    const pos = this.node.position;
    if (selected) {
        // 向上移动
        this.node.setPosition(pos.x, this._originalY + this.SELECTED_OFFSET_Y, pos.z);

        // 可以添加缩放效果
        // this.node.setScale(1.1, 1.1, 1);

        // 可以添加动画
        // tween(this.node).to(0.2, { scale: new Vec3(1.1, 1.1, 1) }).start();
    } else {
        this.node.setPosition(pos.x, this._originalY, pos.z);
        // this.node.setScale(1, 1, 1);
    }
}
```

## 🐛 常见问题

### Q1: 点击牌没有反应？
**A:** 检查以下几点：
1. 是否调用了 `enableCardSelection()`
2. 确保是 SPREAD 模式（只有展开的牌可以点击）
3. 检查 Prefab 是否有 Sprite 组件
4. 确保牌的节点大小足够接收点击

### Q2: 如何知道哪些牌被选中了？
**A:** 使用 `getSelectedIndices()` 方法：
```typescript
const selected = game.handsManager.getSelectedIndices(0);
console.log('选中的牌:', selected);
```

### Q3: 如何程序化地选中某些牌？
**A:** 使用 `selectCards()` 方法：
```typescript
const handDisplay = game.handsManager.getPlayerHandDisplay(0);
handDisplay?.selectCards([0, 1, 2]); // 选中前三张牌
```

### Q4: 出牌后手牌更新了，但选择状态还在？
**A:** 记得在出牌成功后调用 `clearSelection()`：
```typescript
if (success) {
    game.handsManager.clearSelection(0);
}
```

## 🎯 下一步

- 添加 UI 按钮来触发出牌和 Pass
- 实现牌型检测和提示
- 添加动画效果
- 实现 AI 玩家

## 📚 相关文档

- [Game.ts API 文档](../Game.ts) - 查看游戏主控制器的完整 API
- [Cocos Creator 触摸事件文档](https://docs.cocos.com/creator/manual/zh/scripting/events.html)

---

如有问题，请查看 [CardSelectionExample.ts](./CardSelectionExample.ts) 中的完整示例代码。
