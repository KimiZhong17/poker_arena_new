# TheDecreeMode 详细代码分析

## 📋 概述

**TheDecreeMode** 是"天命之战"游戏模式的核心实现，基于德州扑克规则的4人卡牌游戏。

---

## 🏗️ 数据结构

### 1. PlayerState (玩家状态)
```typescript
interface PlayerState {
    id: string;              // 玩家ID (如 'player_0')
    hand: number[];          // 手牌（最多5张）
    score: number;           // 总分
    playedCards: number[];   // 本回合已打出的牌
    hasPlayed: boolean;      // 是否已出牌
}
```

### 2. RoundState (回合状态)
```typescript
interface RoundState {
    roundNumber: number;                    // 回合数
    dealerId: string;                       // 庄家ID
    cardsToPlay: number;                    // 要出多少张牌 (1/2/3)
    playerPlays: Map<string, number[]>;     // 每个玩家打出的牌
    roundWinnerId: string | null;           // 赢家
    roundLoserId: string | null;            // 输家
}
```

### 3. GameState (游戏状态机)
```typescript
enum GameState {
    SETUP                    = "setup"                 // 初始化
    FIRST_DEALER_SELECTION   = "first_dealer"          // 选首庄
    DEALER_CALL             = "dealer_call"           // 庄家叫牌
    PLAYER_SELECTION        = "player_selection"       // 玩家选牌
    SHOWDOWN                = "showdown"              // 摊牌
    SCORING                 = "scoring"               // 计分
    REFILL                  = "refill"                // 补牌
    GAME_OVER               = "game_over"             // 游戏结束
}
```

---

## 🎮 游戏规则（代码中实现的）

### 基本设置
- **玩家数量**: 4人（固定）
- **初始手牌**: 每人5张
- **公共牌**: 4张
- **牌库**: 标准52张（无大小王）

### 游戏流程
1. **发牌** → 2. **选庄家** → 3. **庄家叫牌** → 4. **玩家出牌** → 5. **比牌** → 6. **计分** → 7. **补牌**

   循环 3-7 直到牌库耗尽

### 计分规则（calculateScores）
```typescript
牌型得分：
- 高牌(High Card):        0分
- 一对(One Pair):         1分
- 两对(Two Pair):         2分
- 三条(Three of a Kind):  3分
- 顺子(Straight):         4分
- 同花(Flush):            5分
- 葫芦(Full House):       6分
- 四条(Four of a Kind):   7分
- 同花顺(Straight Flush): 8分
- 皇家同花顺(Royal Flush): 9分

额外奖励：
- 回合赢家: +1分
```

---

## 🔄 生命周期方法

### onEnter() - 进入游戏模式
```typescript
1. adjustPlayerLayout()      // 调整4人菱形布局
2. showUI()                   // 显示TheDecree UI
3. initGame(playerIds)        // 初始化游戏状态
4. dealCards()                // 发牌
```

**当前状态**: ✅ 完全实现

### onExit() - 退出游戏模式
```typescript
1. hideUI()                   // 隐藏UI
2. state = GameState.SETUP    // 重置状态
```

### cleanup() - 清理资源
```typescript
清空所有数据：players, deck, communityCards, currentRound
```

---

## 🎯 核心功能实现状态

### ✅ 已完成的功能

#### 1. 初始化和发牌 (initGame + dealCards)
```typescript
initGame(playerIds):
  - 创建4个玩家
  - 初始化牌库（52张标准扑克）
  - 洗牌（Fisher-Yates算法）

dealCards():
  - 发4张公共牌
  - 每个玩家发5张手牌
  - 状态 → FIRST_DEALER_SELECTION
  - 调用 displayCards() 显示到UI
```

#### 2. 选择首庄 (selectFirstDealer)
```typescript
selectFirstDealer(revealedCards):
  输入: Map<playerId, card>  // 每人翻开的牌
  逻辑: 比较点数（A最大），点数相同比花色（♠>♥>♣>♦）
  输出: 庄家ID
```

**注意**: 这个方法只是逻辑，没有自动流程！

#### 3. 开始新回合 (startNewRound)
```typescript
startNewRound(dealerId):
  - 创建新的RoundState
  - 回合数+1
  - 设置庄家
  - 重置所有玩家的hasPlayed和playedCards
  - 状态 → DEALER_CALL
```

#### 4. 庄家叫牌 (dealerCall)
```typescript
dealerCall(1 | 2 | 3):
  检查: 必须在DEALER_CALL状态
  设置: currentRound.cardsToPlay
  状态: → PLAYER_SELECTION
```

#### 5. 玩家出牌 (playCards)
```typescript
playCards(cards, playerId):
  验证:
    - 当前状态是PLAYER_SELECTION
    - 玩家未出过牌
    - 牌数正确
    - 玩家手中有这些牌

  执行:
    - 从手牌移除
    - 记录到playerPlays
    - 标记hasPlayed = true

  检查:
    - 如果所有人都出牌了 → processShowdown()
```

#### 6. 摊牌和计分 (processShowdown + calculateScores)
```typescript
processShowdown():
  1. 评估每个玩家的牌型（手牌+公共牌）
  2. 找出赢家和输家
  3. 计算得分
  4. 状态 → SCORING

calculateScores():
  - 根据牌型给分
  - 赢家额外+1分
```

#### 7. 补牌 (refillHands)
```typescript
refillHands():
  从庄家开始顺时针补牌:
    - 每人补到5张
    - 直到牌库耗尽

  开始下一轮:
    - 输家成为新庄家
    - 调用 startNewRound(loserId)
```

#### 8. UI控制
```typescript
showUI():
  - 显示 objectsTheDecreeNode
  - 显示 communityCardsNode
  - 隐藏 objectsGuandanNode

hideUI():
  - 隐藏 objectsTheDecreeNode
  - 隐藏 communityCardsNode

adjustPlayerLayout():
  4人菱形布局:
  Player 0: 底部 (0, -280)
  Player 1: 左侧 (-450, 0)
  Player 2: 顶部 (0, 280)
  Player 3: 右侧 (450, 0)
  Player 4: 隐藏
```

---

## ⚠️ 缺失的功能

### 1. 自动游戏流程 🔄
**问题**: 游戏不会自动进行，需要手动调用方法

**需要添加**:
```typescript
update(deltaTime: number) {
    switch(this.state) {
        case GameState.FIRST_DEALER_SELECTION:
            // 自动选庄家
            this.autoSelectFirstDealer();
            break;

        case GameState.DEALER_CALL:
            // 自动叫牌（AI或等待玩家）
            this.handleDealerCall();
            break;

        case GameState.PLAYER_SELECTION:
            // 自动出牌（AI或等待玩家）
            this.handlePlayerSelection();
            break;

        case GameState.SHOWDOWN:
            // 显示结果，等待一段时间
            this.handleShowdown();
            break;

        case GameState.REFILL:
            // 补牌，开始下一轮
            this.handleRefill();
            break;
    }
}
```

### 2. AI决策系统 🔄
**问题**: 没有AI逻辑，所有玩家需要手动操作

**需要添加**:
```typescript
class TheDecreeAI {
    // 选择翻牌
    selectCardForDealer(hand: number[]): number

    // 决定叫几张牌
    decideDealerCall(hand: number[]): 1 | 2 | 3

    // 选择要打出的牌
    selectCardsToPlay(hand, community, count): number[]
}
```

### 3. 玩家交互UI 🔄
**问题**: 没有UI让玩家选牌和叫牌

**需要添加**:
- 手牌可点击选择
- 确认/取消按钮
- 庄家叫牌面板（1/2/3张按钮）
- 游戏状态提示

### 4. 游戏结束判断 🔄
**问题**: isGameOver() 只检查手牌是否为空，但没有触发结束

**需要添加**:
```typescript
在 refillHands() 中:
if (this.isGameOver()) {
    this.state = GameState.GAME_OVER;
    this.onGameFinished();  // 通知PlayingStage
}
```

---

## 📊 状态机流转

### 当前实现的流转
```
SETUP
  ↓ (dealCards)
FIRST_DEALER_SELECTION
  ↓ (startNewRound)
DEALER_CALL
  ↓ (dealerCall)
PLAYER_SELECTION
  ↓ (playCards - 所有人出完)
SHOWDOWN (processShowdown)
  ↓
SCORING
  ↓ (refillHands)
DEALER_CALL (下一轮)
  ...
```

### 缺失的流转
```
❌ FIRST_DEALER_SELECTION → DEALER_CALL
   (没有自动调用 startNewRound)

❌ SCORING → REFILL
   (没有自动调用 refillHands)

❌ REFILL → GAME_OVER
   (没有检查游戏是否结束)
```

---

## 🔍 关键方法调用链

### 完整的一局游戏应该是：

```typescript
// 1. 初始化
onEnter()
  ├─ adjustPlayerLayout()
  ├─ showUI()
  ├─ initGame(['player_0', 'player_1', 'player_2', 'player_3'])
  └─ dealCards()
       └─ state = FIRST_DEALER_SELECTION

// 2. 选首庄 (需要手动调用)
selectFirstDealer({player_0: card1, player_1: card2, ...})
  返回: dealerId

// 3. 开始第一轮 (需要手动调用)
startNewRound(dealerId)
  └─ state = DEALER_CALL

// 4. 庄家叫牌 (需要手动调用)
dealerCall(2)  // 叫2张
  └─ state = PLAYER_SELECTION

// 5. 所有玩家出牌 (需要手动调用4次)
playCards([card1, card2], 'player_0')
playCards([card3, card4], 'player_1')
playCards([card5, card6], 'player_2')
playCards([card7, card8], 'player_3')  // 最后一个触发showdown
  └─ processShowdown()
       └─ state = SCORING

// 6. 补牌 (需要手动调用)
refillHands()
  └─ startNewRound(loserId)
       └─ 回到步骤4

// 7. 游戏结束 (需要添加)
if (isGameOver()) {
    state = GAME_OVER
    通知 PlayingStage
}
```

---

## 💡 使用示例

### 当前可以这样玩一轮：

```typescript
// 在 Game.ts 的 autoPlayTestRound() 中：
const mode = this.theDecreeMode;

// 1. 选庄家
const revealed = new Map();
revealed.set('player_0', mode.getPlayerState('player_0')!.hand[0]);
revealed.set('player_1', mode.getPlayerState('player_1')!.hand[0]);
revealed.set('player_2', mode.getPlayerState('player_2')!.hand[0]);
revealed.set('player_3', mode.getPlayerState('player_3')!.hand[0]);

const dealerId = mode.selectFirstDealer(revealed);

// 2. 开始回合
mode.startNewRound(dealerId);

// 3. 叫牌
mode.dealerCall(2);

// 4. 出牌
mode.playCards([hand[0], hand[1]], 'player_0');
mode.playCards([hand[0], hand[1]], 'player_1');
mode.playCards([hand[0], hand[1]], 'player_2');
mode.playCards([hand[0], hand[1]], 'player_3');

// 5. 补牌
mode.refillHands();  // 自动开始下一轮
```

---

## 🎯 总结

### ✅ 核心逻辑完整
- 发牌、选庄、叫牌、出牌、比牌、计分、补牌 **全部实现**
- 德州扑克评估器 **完整实现**
- 玩家布局和UI控制 **完整实现**

### ⚠️ 缺少自动化
- **没有 update() 循环** → 游戏不会自动进行
- **没有 AI 系统** → 需要手动调用所有方法
- **没有玩家交互UI** → 无法让玩家点击操作
- **没有游戏结束逻辑** → 不会自动切换到EndStage

### 🚀 下一步重点
1. **添加 update() 状态机循环** ← 最优先
2. **实现简单的 AI 决策**
3. **添加玩家交互UI**
4. **完善游戏结束流程**

---

## 📝 代码质量
- ✅ 结构清晰，职责分明
- ✅ 完整的类型定义
- ✅ 详细的注释
- ✅ 遵循游戏规则
- ⚠️ 缺少错误处理
- ⚠️ 缺少边界检查

---

这就是 TheDecreeMode 的完整分析！现在你应该清楚了整个设计思路。要开始添加自动游戏循环吗？
