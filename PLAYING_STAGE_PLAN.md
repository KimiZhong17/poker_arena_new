# PlayingStage 实现计划

## 📋 当前状态

### ✅ 已完成
- PlayingStage 基础框架（创建GameMode、进入/退出逻辑）
- TheDecreeMode 核心游戏逻辑
- 手牌管理系统

### ⚠️ 待完善
- TheDecreeMode 的 UI 交互
- 游戏流程自动化
- AI 玩家逻辑

---

## 🎯 PlayingStage 需要做什么

PlayingStage 本身是一个**代理/协调器**，它的职责是：

### 1. **创建和管理 GameMode** ✅ (已完成)
```typescript
onEnter() {
    创建 TheDecreeMode
    调用 gameMode.onEnter()
    显示 UI
}
```

### 2. **转发更新循环** ✅ (已完成)
```typescript
update(deltaTime) {
    gameMode.update(deltaTime)  // 转发给游戏模式
}
```

### 3. **监听游戏结束** ✅ (已完成)
```typescript
onGameFinished(result) {
    切换到 EndStage
}
```

**结论**：PlayingStage 本身基本完成了！

---

## 🎮 真正需要完善的是 TheDecreeMode

### TheDecreeMode 的游戏流程

```
游戏开始
  ↓
[1] 发牌阶段 (SETUP)
  - 洗牌、发手牌(每人5张)、发公共牌(4张)
  ↓
[2] 选择首庄 (FIRST_DEALER_SELECTION)
  - 每人翻1张牌，最大点数的成为庄家
  ↓
[3] 庄家叫牌 (DEALER_CALL)
  - 庄家选择出牌数量 (1/2/3张)
  ↓
[4] 玩家选牌 (PLAYER_SELECTION)
  - 所有玩家依次选择对应数量的牌
  ↓
[5] 摊牌比较 (SHOWDOWN)
  - 结合公共牌，比较牌型大小
  ↓
[6] 计分 (SCORING)
  - 赢家得分，最强牌型额外+1分
  ↓
[7] 补牌 (REFILL)
  - 所有玩家补牌至5张
  ↓
是否游戏结束？
  是 → [8] 游戏结束 (GAME_OVER)
  否 → 返回 [3]（输家成为下一轮庄家）
```

---

## 🛠️ 需要实现的功能

### 阶段1：完善 TheDecreeMode 的游戏流程自动化

#### 1.1 发牌阶段 ✅ (部分完成)
```typescript
// TheDecreeMode.ts - onEnter()
initGame(playerIds)  // 初始化玩家
dealInitialCards()   // 发牌
```

**需要补充**：
- ✅ 显示手牌动画
- ✅ 显示公共牌

#### 1.2 选择首庄 🔄 (需要实现)
```typescript
// 方案A：自动选择（AI模式）
selectFirstDealerAutomatically()

// 方案B：玩家交互（完整版）
showDealerSelectionUI()  // 显示"翻牌"按钮
waitForPlayerSelection() // 等待玩家点击
revealCards()            // 翻牌动画
determineDealer()        // 确定庄家
```

#### 1.3 庄家叫牌 🔄 (需要实现)
```typescript
// 显示庄家UI
showDealerCallPanel()  // 显示"1张"/"2张"/"3张"按钮

// 等待庄家选择
waitForDealerCall()

// AI模式
if (isAI) {
    autoCall()  // AI自动选择
}
```

#### 1.4 玩家选牌 🔄 (需要实现)
```typescript
// 显示选牌UI
enableCardSelection()  // 手牌可点击
showConfirmButton()    // 显示"确认"按钮

// 等待所有玩家选牌
for (player in players) {
    if (player.isAI) {
        autoSelectCards()
    } else {
        waitForPlayerSelection()
    }
}
```

#### 1.5 摊牌比较 ✅ (逻辑已完成)
```typescript
compareHands()        // 已有：TexasHoldEmEvaluator
determineWinner()     // 已实现
```

**需要补充**：
- 🔄 显示摊牌动画
- 🔄 显示牌型结果

#### 1.6 计分 ✅ (已完成)
```typescript
updateScores()  // 已实现
```

#### 1.7 补牌 ✅ (逻辑已完成)
```typescript
refillHands()  // 已实现
```

**需要补充**：
- 🔄 补牌动画

#### 1.8 游戏结束 🔄 (需要实现)
```typescript
checkGameOver()
onGameFinished()  // 通知 PlayingStage
```

---

### 阶段2：UI 交互实现

#### 2.1 玩家手牌交互 ✅ (部分完成)
- [x] 显示手牌
- [ ] 点击选择/取消选择
- [ ] 选中状态视觉反馈
- [ ] 确认/取消按钮

#### 2.2 庄家面板
- [ ] 显示庄家标记
- [ ] 叫牌按钮（1/2/3张）
- [ ] 等待提示

#### 2.3 游戏状态显示
- [ ] 当前回合数
- [ ] 当前庄家
- [ ] 玩家得分
- [ ] 轮到谁出牌

#### 2.4 公共牌显示
- [x] 显示4张公共牌
- [ ] 高亮使用的公共牌

---

### 阶段3：AI 玩家逻辑

#### 3.1 AI 决策系统
```typescript
class TheDecreeAI {
    // 翻牌选择
    selectCardForDealer(): number

    // 叫牌决策
    decideDealerCall(): 1 | 2 | 3

    // 选牌策略
    selectCards(handCards, communityCards, cardsToPlay): number[]
}
```

#### 3.2 AI 时间模拟
```typescript
// 模拟思考时间
setTimeout(() => {
    aiPlayer.makeDecision()
}, 1000-2000ms)
```

---

## 📝 实现优先级

### 🚀 优先级1：最小可玩版本 (1-2天)

**目标**：完整跑通一次游戏流程

1. **自动游戏流程** (无UI交互)
   ```typescript
   onEnter() {
       发牌
       自动选庄家
       自动叫牌
       自动选牌（所有玩家AI）
       自动摊牌
       自动计分
       自动补牌
       重复3-4轮
       游戏结束
   }
   ```

2. **控制台输出** (调试用)
   ```
   [TheDecree] Round 1 started
   [TheDecree] Dealer: player_0
   [TheDecree] Dealer calls: 2 cards
   [TheDecree] Player player_0 plays: [10♠, J♠]
   ...
   [TheDecree] Winner: player_1 (Flush)
   [TheDecree] Scores: {player_0: 2, player_1: 5, ...}
   ```

**实现要点**：
- ✅ 使用现有的 TheDecreeMode 逻辑
- 🔄 添加 AI 决策系统
- 🔄 添加游戏状态机自动流转
- 🔄 添加回合计时器

---

### 🎮 优先级2：玩家交互版本 (2-3天)

**目标**：玩家可以控制player_0，其他3个是AI

1. **玩家选牌UI**
   - 手牌可点击选择
   - 确认/取消按钮
   - 选中状态反馈

2. **庄家叫牌UI**
   - 1/2/3张按钮
   - 等待提示

3. **状态提示UI**
   - "轮到你了"
   - "等待其他玩家..."
   - "回合结束"

---

### ✨ 优先级3：完整体验版本 (3-5天)

**目标**：完整的视觉和交互体验

1. **动画效果**
   - 发牌动画
   - 翻牌动画
   - 摊牌动画

2. **音效**
   - 发牌音效
   - 出牌音效
   - 胜利音效

3. **精美UI**
   - 得分榜
   - 牌型显示
   - 玩家头像

---

## 🎯 建议的实施步骤

### 第1步：完善 TheDecreeMode 的自动游戏循环

```typescript
// TheDecreeMode.ts
class TheDecreeMode {
    private autoPlayTimer: number = 0;

    update(deltaTime: number) {
        switch(this.state) {
            case GameState.FIRST_DEALER_SELECTION:
                // 自动选择庄家
                this.autoSelectDealer();
                break;

            case GameState.DEALER_CALL:
                // 自动叫牌
                this.autoDealerCall();
                break;

            case GameState.PLAYER_SELECTION:
                // 自动选牌
                this.autoPlayerSelection();
                break;

            case GameState.SHOWDOWN:
                // 显示结果
                this.performShowdown();
                break;

            case GameState.REFILL:
                // 补牌并开始下一轮
                this.refillAndNextRound();
                break;
        }
    }
}
```

### 第2步：添加 AI 决策逻辑

```typescript
// AI/TheDecreeAI.ts
class TheDecreeAI {
    selectCardForDealer(hand: number[]): number {
        // 选择最大的牌
        return hand.reduce((max, card) =>
            getCardPoint(card) > getCardPoint(max) ? card : max
        );
    }

    decideDealerCall(hand: number[]): 1 | 2 | 3 {
        // 简单策略：随机选择
        return [1, 2, 3][Math.floor(Math.random() * 3)];
    }

    selectCards(hand, community, count): number[] {
        // 简单策略：随机选择
        return hand.slice(0, count);
    }
}
```

### 第3步：添加玩家交互UI

```typescript
// UI/TheDecreeUIController.ts
class TheDecreeUIController {
    showDealerCallPanel(callback) {
        // 显示1/2/3张按钮
    }

    enableCardSelection(maxCards, callback) {
        // 手牌可点击
    }

    showGameStatus(message) {
        // 显示状态提示
    }
}
```

---

## 📦 需要创建的新文件

1. **AI/TheDecreeAI.ts** - AI决策系统
2. **UI/TheDecreeUIController.ts** - UI控制器
3. **UI/DealerCallPanel.ts** - 庄家叫牌面板组件
4. **UI/GameStatusLabel.ts** - 游戏状态提示组件

---

## ✅ 验收标准

### 最小可玩版本
- [ ] 游戏可以自动完整运行3-5轮
- [ ] 控制台输出完整的游戏过程
- [ ] 所有玩家自动决策（AI）
- [ ] 正确计分和判断胜负
- [ ] 游戏结束后切换到 EndStage

### 玩家交互版本
- [ ] 玩家可以选择手牌
- [ ] 庄家可以叫牌
- [ ] 显示游戏状态提示
- [ ] 其他玩家自动决策（AI）

### 完整体验版本
- [ ] 发牌动画流畅
- [ ] 音效完整
- [ ] UI美观
- [ ] 交互反馈及时

---

## 🚀 下一步行动

**我建议从"优先级1：最小可玩版本"开始**，让游戏能够完整跑通。

你想：
1. **立即开始实现自动游戏循环**？
2. 还是**先实现玩家交互UI**？

选哪个我都可以帮你实现！😊
