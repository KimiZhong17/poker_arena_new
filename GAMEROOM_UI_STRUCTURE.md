# GameRoom Scene UI 架构设计（最终版）

## 🎯 设计理念

**使用同一个 GameRoom Scene，通过 Objects_TheDecree 和 Objects_Guandan 节点管理不同游戏模式的 UI**

基于你的设计，并添加了一些优化建议。

---

## 🏗️ 推荐的 Scene 节点结构

```
Canvas
  ├── Background (共享背景)
  │
  ├── SharedGameplayLayer (共享游戏层 - 扑克牌)
  │   └── HoleCards (玩家手牌)
  │       └── HandsManager (Game.ts 自动创建)
  │           ├── BottomHand (玩家0 - 主玩家)
  │           ├── LeftHand (玩家1)
  │           ├── TopLeftHand (玩家2)
  │           ├── TopRightHand (玩家3)
  │           └── RightHand (玩家4 - 仅 Guandan)
  │
  ├── Objects_TheDecree (The Decree 专用)
  │   ├── GameplayLayer
  │   │   └── CommunityCards (4张公共牌区域)
  │   │       ├── CardSlot1 (x: -150, y: 0)
  │   │       ├── CardSlot2 (x: -50, y: 0)
  │   │       ├── CardSlot3 (x: 50, y: 0)
  │   │       └── CardSlot4 (x: 150, y: 0)
  │   │
  │   └── UILayer
  │       ├── DealerIndicator (Dealer 标识 - Sprite)
  │       ├── RoundInfoLabel (回合信息 - Label)
  │       ├── DealerCallPanel (Dealer 叫牌面板 - Node)
  │       │   ├── Call1Button
  │       │   ├── Call2Button
  │       │   └── Call3Button
  │       ├── ConfirmPlayButton (确认出牌按钮)
  │       └── ScoreBoard (分数榜 - Node)
  │           ├── Player0Score
  │           ├── Player1Score
  │           ├── Player2Score
  │           └── Player3Score
  │
  ├── Objects_Guandan (Guandan 专用)
  │   ├── GameplayLayer
  │   │   ├── BossCardsArea (Boss 额外的牌区域)
  │   │   └── BurnedCardsArea (烧牌区域)
  │   │
  │   └── UILayer
  │       ├── BossIndicator (Boss 标识 - Sprite)
  │       ├── LevelDisplay (当前级别 - Label)
  │       ├── RemainingCardsLabel (剩余牌数 - Label)
  │       ├── PassButton (过牌按钮)
  │       └── PlayButton (出牌按钮)
  │
  └── SharedUILayer (共享 UI)
      ├── RoomInfoPanel
      │   ├── RoomIdLabel
      │   └── GameModeLabel
      └── ExitButton (退出按钮)
```

---

## 📊 你的设计 vs 优化建议对比

| 层级 | 你的设计 | 优化建议 | 原因 |
|------|----------|----------|------|
| 扑克牌 | Objects_TheDecree/GameplayLayer/HoleCards | SharedGameplayLayer/HandsManager | 两个游戏都需要显示手牌，共享更好 |
| 公共牌 | Objects_TheDecree/GameplayLayer/CommunityCards | ✅ 保持 | The Decree 专用，正确 |
| UI 层 | Objects_TheDecree/UILayer | ✅ 保持 | 分离 Gameplay 和 UI，清晰 |
| Guandan | Objects_Guandan (TODO) | 添加 GameplayLayer + UILayer | 与 TheDecree 保持一致 |

---

## 🔧 在 Cocos Creator 中创建节点

### 步骤 1: 创建共享层

1. **SharedGameplayLayer** (如果想手动创建)
   - 在 Canvas 下创建节点 `SharedGameplayLayer`
   - 位置：(0, 0)
   - zIndex: 10（在背景之上，UI 之下）
   - 注：如果使用 Game.ts 自动创建 HandsManager，可以跳过此步骤

### 步骤 2: 创建 Objects_TheDecree

1. **Objects_TheDecree** (主容器)
   - 位置：(0, 0)
   - 初始状态：active = false（根据游戏模式动态切换）

2. **Objects_TheDecree/GameplayLayer**
   - 子节点：`CommunityCards`
   - 位置：(0, 200)

3. **Objects_TheDecree/GameplayLayer/CommunityCards**
   - 创建 4 个空节点作为卡槽：
     - `CardSlot1` 位置：(-150, 0)
     - `CardSlot2` 位置：(-50, 0)
     - `CardSlot3` 位置：(50, 0)
     - `CardSlot4` 位置：(150, 0)

4. **Objects_TheDecree/UILayer**
   - 子节点：
     - `DealerIndicator` (Sprite) - 位置随 Dealer 动态变化
     - `RoundInfoLabel` (Label) - 位置：(400, 350)
     - `DealerCallPanel` (Node) - 位置：(0, 100)
     - `ConfirmPlayButton` (Button) - 位置：(0, -300)
     - `ScoreBoard` (Node) - 位置：(500, 0)

5. **DealerCallPanel** 子节点：
   - `Call1Button` (Button) - 位置：(-150, 0) - 文本："1 Card"
   - `Call2Button` (Button) - 位置：(0, 0) - 文本："2 Cards"
   - `Call3Button` (Button) - 位置：(150, 0) - 文本："3 Cards"

6. **ScoreBoard** 子节点：
   - `Player0Score` (Label) - 位置：(0, 150)
   - `Player1Score` (Label) - 位置：(0, 50)
   - `Player2Score` (Label) - 位置：(0, -50)
   - `Player3Score` (Label) - 位置：(0, -150)

### 步骤 3: 创建 Objects_Guandan

1. **Objects_Guandan** (主容器)
   - 位置：(0, 0)
   - 初始状态：active = true（默认游戏模式）

2. **Objects_Guandan/GameplayLayer**
   - 子节点：`BossCardsArea`, `BurnedCardsArea`

3. **Objects_Guandan/UILayer**
   - 子节点：
     - `BossIndicator` (Sprite)
     - `LevelDisplay` (Label) - 位置：(-400, 350)
     - `RemainingCardsLabel` (Label) - 位置：(0, 350)
     - `PassButton` (Button) - 位置：(200, -300)
     - `PlayButton` (Button) - 位置：(350, -300)

### 步骤 4: 创建共享 UI

1. **SharedUILayer**
   - 位置：(0, 0)
   - zIndex: 20（最上层）

2. **SharedUILayer/RoomInfoPanel**
   - 位置：(-500, 350)
   - 子节点：
     - `RoomIdLabel` (Label)
     - `GameModeLabel` (Label)

3. **SharedUILayer/ExitButton**
   - 位置：(550, 350)
   - 文本："Exit"

### 步骤 5: 绑定到 Game.ts

选中挂载了 Game.ts 的节点，在属性检查器中绑定：

```typescript
// 这些属性已经在 Game.ts 中定义好了
Objects Guandan Node → Objects_Guandan
Objects The Decree Node → Objects_TheDecree
Community Cards Node → Objects_TheDecree/GameplayLayer/CommunityCards
Dealer Call Panel Node → Objects_TheDecree/UILayer/DealerCallPanel
Hands Manager Node → (由 Game.ts 自动创建，或手动创建后绑定)
```

---

## 💻 代码实现

### Game.ts 中已实现的部分

```typescript
// ✅ 已定义的属性
@property(Node)
public handsManagerNode: Node = null!;

@property(Node)
public objectsGuandanNode: Node = null!;

@property(Node)
public objectsTheDecreeNode: Node = null!;

@property(Node)
public communityCardsNode: Node = null!;

@property(Node)
public dealerCallPanelNode: Node = null!;

// ✅ 已实现的 UI 切换方法
private setupTheDecreeUI(): void {
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

    // Hide 5th player position (RightHand)
    if (this.handsManagerNode) {
        const rightHandNode = this.handsManagerNode.getChildByName('RightHand');
        if (rightHandNode) {
            rightHandNode.active = false;
        }
    }
}

private setupGuandanUI(): void {
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

    // Show 5th player position (RightHand)
    if (this.handsManagerNode) {
        const rightHandNode = this.handsManagerNode.getChildByName('RightHand');
        if (rightHandNode) {
            rightHandNode.active = true;
        }
    }
}
```

---

## 🎮 UI 组件示例

### 1. The Decree Community Cards Display

创建新文件：`poker_arena_client/assets/Scripts/UI/TheDecreeCommunityCardsDisplay.ts`

```typescript
import { _decorator, Component, Node, find } from 'cc';
import { Game } from '../Game';
import { PokerFactory } from './PokerFactory';

const { ccclass, property } = _decorator;

@ccclass('TheDecreeCommunityCardsDisplay')
export class TheDecreeCommunityCardsDisplay extends Component {

    @property([Node])
    cardSlots: Node[] = [];  // 4 card slots

    private game: Game = null!;
    private pokerFactory: PokerFactory = null!;

    start() {
        // Find Game component (you may need to adjust the path)
        const gameNode = find('Canvas/GameController') || this.node.parent.parent.parent;
        this.game = gameNode?.getComponent(Game);
        this.pokerFactory = gameNode?.getComponent(PokerFactory);

        if (!this.game || !this.pokerFactory) {
            console.error('[CommunityCards] Failed to find Game or PokerFactory');
            return;
        }

        // Display community cards
        this.displayCommunityCards();
    }

    displayCommunityCards() {
        const communityCards = this.game.getCommunityCards();

        if (communityCards.length !== 4) {
            console.warn('[CommunityCards] Expected 4 cards, got', communityCards.length);
            return;
        }

        for (let i = 0; i < communityCards.length; i++) {
            const cardValue = communityCards[i];
            const cardNode = this.pokerFactory.createPoker(cardValue);

            // Position card in slot
            if (this.cardSlots[i]) {
                cardNode.setParent(this.cardSlots[i]);
                cardNode.setPosition(0, 0, 0);
                cardNode.setScale(1.2, 1.2, 1);  // Slightly larger for visibility
            }
        }

        console.log('[CommunityCards] Displayed 4 community cards');
    }
}
```

**如何使用：**
1. 将此组件挂载到 `Objects_TheDecree/GameplayLayer/CommunityCards` 节点
2. 在属性检查器中，拖拽 4 个 CardSlot 节点到 `cardSlots` 数组

---

### 2. The Decree Dealer Call Panel

创建新文件：`poker_arena_client/assets/Scripts/UI/TheDecreeDealerCallPanel.ts`

```typescript
import { _decorator, Component, Button, find, Node } from 'cc';
import { Game } from '../Game';

const { ccclass, property } = _decorator;

@ccclass('TheDecreeDealerCallPanel')
export class TheDecreeDealerCallPanel extends Component {

    @property(Button)
    call1Button: Button = null!;

    @property(Button)
    call2Button: Button = null!;

    @property(Button)
    call3Button: Button = null!;

    private game: Game = null!;

    start() {
        // Find Game component
        const gameNode = find('Canvas/GameController') || this.node.parent.parent.parent;
        this.game = gameNode?.getComponent(Game);

        if (!this.game) {
            console.error('[DealerCallPanel] Failed to find Game component');
            return;
        }

        // Bind button events
        if (this.call1Button) {
            this.call1Button.node.on(Button.EventType.CLICK, this.onCall1Clicked, this);
        }
        if (this.call2Button) {
            this.call2Button.node.on(Button.EventType.CLICK, this.onCall2Clicked, this);
        }
        if (this.call3Button) {
            this.call3Button.node.on(Button.EventType.CLICK, this.onCall3Clicked, this);
        }

        // Initially hide panel (only show when player is dealer)
        this.hide();
    }

    onCall1Clicked() {
        console.log('[DealerCallPanel] Call 1 card clicked');
        this.game.dealerCall(1);
        this.hide();
    }

    onCall2Clicked() {
        console.log('[DealerCallPanel] Call 2 cards clicked');
        this.game.dealerCall(2);
        this.hide();
    }

    onCall3Clicked() {
        console.log('[DealerCallPanel] Call 3 cards clicked');
        this.game.dealerCall(3);
        this.hide();
    }

    /**
     * Show panel when it's this player's turn to call
     */
    public show() {
        this.node.active = true;
    }

    /**
     * Hide panel after dealer makes a call
     */
    public hide() {
        this.node.active = false;
    }

    onDestroy() {
        // Clean up event listeners
        if (this.call1Button?.node.isValid) {
            this.call1Button.node.off(Button.EventType.CLICK, this.onCall1Clicked, this);
        }
        if (this.call2Button?.node.isValid) {
            this.call2Button.node.off(Button.EventType.CLICK, this.onCall2Clicked, this);
        }
        if (this.call3Button?.node.isValid) {
            this.call3Button.node.off(Button.EventType.CLICK, this.onCall3Clicked, this);
        }
    }
}
```

**如何使用：**
1. 将此组件挂载到 `Objects_TheDecree/UILayer/DealerCallPanel` 节点
2. 在属性检查器中绑定 3 个按钮

---

### 3. The Decree Score Board

创建新文件：`poker_arena_client/assets/Scripts/UI/TheDecreeScoreBoard.ts`

```typescript
import { _decorator, Component, Label, find } from 'cc';
import { Game } from '../Game';

const { ccclass, property } = _decorator;

@ccclass('TheDecreeScoreBoard')
export class TheDecreeScoreBoard extends Component {

    @property([Label])
    playerScoreLabels: Label[] = [];  // 4 player score labels

    private game: Game = null!;

    start() {
        // Find Game component
        const gameNode = find('Canvas/GameController') || this.node.parent.parent.parent;
        this.game = gameNode?.getComponent(Game);

        if (!this.game) {
            console.error('[ScoreBoard] Failed to find Game component');
            return;
        }

        // Initial update
        this.updateScores();
    }

    /**
     * Update all player scores
     * Call this after each round
     */
    public updateScores() {
        const scores = this.game.getPlayerScores();

        for (let i = 0; i < 4; i++) {
            const playerId = `player_${i}`;
            const score = scores.get(playerId) || 0;

            if (this.playerScoreLabels[i]) {
                this.playerScoreLabels[i].string = `P${i}: ${score}`;
            }
        }

        console.log('[ScoreBoard] Scores updated');
    }
}
```

**如何使用：**
1. 将此组件挂载到 `Objects_TheDecree/UILayer/ScoreBoard` 节点
2. 在属性检查器中拖拽 4 个 Label 到 `playerScoreLabels` 数组
3. 在 Game.ts 中，每回合结束后调用 `scoreBoard.updateScores()`

---

## 📋 完整实施清单

### ✅ 已完成（代码层面）
- [x] Game.ts 添加节点引用属性
- [x] setupTheDecreeUI() 实现
- [x] setupGuandanUI() 实现
- [x] The Decree 完整游戏逻辑 API

### 📝 待完成（编辑器中）
- [ ] 创建 Objects_TheDecree 节点结构
  - [ ] GameplayLayer/CommunityCards + 4个CardSlot
  - [ ] UILayer/DealerCallPanel + 3个按钮
  - [ ] UILayer/ScoreBoard + 4个分数Label
  - [ ] UILayer/RoundInfoLabel
  - [ ] UILayer/ConfirmPlayButton

- [ ] 创建 Objects_Guandan 节点结构
  - [ ] GameplayLayer (TODO)
  - [ ] UILayer (TODO)

- [ ] 创建 SharedUILayer
  - [ ] RoomInfoPanel
  - [ ] ExitButton

- [ ] 绑定节点到 Game.ts 组件

### 📝 待创建（组件脚本）
- [ ] TheDecreeCommunityCardsDisplay.ts
- [ ] TheDecreeDealerCallPanel.ts
- [ ] TheDecreeScoreBoard.ts
- [ ] TheDecreePlayerHandDisplay.ts (如果需要特殊显示)

---

## 🚀 渲染层级顺序

从下到上（zIndex 从小到大）：

```
1. Background (zIndex: 0)
2. Objects_TheDecree/GameplayLayer (zIndex: 5)
3. Objects_Guandan/GameplayLayer (zIndex: 5)
4. SharedGameplayLayer/HoleCards (zIndex: 10)
5. Objects_TheDecree/UILayer (zIndex: 15)
6. Objects_Guandan/UILayer (zIndex: 15)
7. SharedUILayer (zIndex: 20)
```

在 Cocos Creator 中，可以通过节点顺序或 zIndex 设置来控制。

---

## 🎯 你的设计优点

✅ **GameplayLayer 和 UILayer 分离** - 非常好！便于管理层级
✅ **Objects_XXX 作为容器** - 清晰的命名，易于理解
✅ **CommunityCards 独立节点** - 正确，The Decree 特有

## 💡 建议的改进

1. **添加 SharedGameplayLayer** - 避免扑克牌逻辑重复
2. **统一两个游戏模式的结构** - Objects_Guandan 也应该有 GameplayLayer + UILayer
3. **使用 zIndex 或节点顺序** - 明确控制渲染层级

---

## 📞 总结

你的设计思路非常好！主要建议是：

1. ✅ **保持 Objects_TheDecree 的结构**（GameplayLayer + UILayer）
2. ✅ **Objects_Guandan 使用相同结构**（而不是 TODO）
3. ✅ **考虑添加 SharedGameplayLayer**（如果想复用 HandsManager）
4. ✅ **已更新 Game.ts**，使用 `objectsTheDecreeNode` 和 `objectsGuandanNode`

现在你可以直接在编辑器中按照这个结构创建节点，代码已经准备好了！
