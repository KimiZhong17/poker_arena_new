# The Decree 游戏接口文档

## 📖 完整实现总结

The Decree 游戏的所有核心接口已经实现完成，可以直接通过 `Game` 组件访问。

---

## 🎮 游戏流程

### 完整回合流程

```
1. 初始化游戏 (自动完成)
   ├─ 发4张公共牌
   └─ 每人发5张手牌

2. 选择第一个Dealer
   └─ selectFirstDealer(revealedCards)

3. Dealer叫牌
   └─ dealerCall(1|2|3)

4. 所有玩家选牌
   ├─ playerSelectCards('player_0', [indices])
   ├─ playerSelectCards('player_1', [indices])
   ├─ playerSelectCards('player_2', [indices])
   └─ playerSelectCards('player_3', [indices])

5. 比牌和计分 (自动完成)
   └─ 显示赢家和输家

6. 补牌并开始下一回合
   └─ refillHands()

7. 重复步骤3-6，直到牌堆用完
```

---

## 📚 API 参考

### 游戏状态查询

#### 1. `getCommunityCards(): number[]`
获取4张公共牌

**返回：** 牌的数组（card编码）

**示例：**
```typescript
const game = this.node.getComponent(Game);
const communityCards = game.getCommunityCards();
console.log('Community cards:', communityCards);
```

---

#### 2. `getPlayerHand(playerId: string): number[]`
获取玩家的手牌（5张）

**参数：**
- `playerId`: 玩家ID（'player_0', 'player_1', 'player_2', 'player_3'）

**返回：** 手牌数组

**示例：**
```typescript
const myHand = game.getPlayerHand('player_0');
console.log('My hand:', myHand);
```

---

#### 3. `getPlayerScores(): Map<string, number>`
获取所有玩家的分数

**返回：** Map<玩家ID, 分数>

**示例：**
```typescript
const scores = game.getPlayerScores();
for (const [playerId, score] of scores) {
    console.log(`${playerId}: ${score} points`);
}
```

---

#### 4. `getTheDecreeState(): string`
获取当前游戏状态

**返回值：**
- `'setup'` - 游戏设置中
- `'first_dealer'` - 选择第一个Dealer
- `'dealer_call'` - Dealer叫牌中
- `'player_selection'` - 玩家选牌中
- `'showdown'` - 比牌中
- `'scoring'` - 计分中
- `'game_over'` - 游戏结束

**示例：**
```typescript
const state = game.getTheDecreeState();
if (state === 'dealer_call') {
    // 显示Dealer叫牌UI
}
```

---

#### 5. `getCurrentRound(): RoundState | null`
获取当前回合信息

**返回对象包含：**
- `roundNumber`: 回合数
- `dealerId`: 当前Dealer的玩家ID
- `cardsToPlay`: 本回合要出几张牌（1/2/3）
- `playerPlays`: Map<玩家ID, 出的牌>
- `roundWinnerId`: 赢家ID
- `roundLoserId`: 输家ID

**示例：**
```typescript
const round = game.getCurrentRound();
if (round) {
    console.log(`Round ${round.roundNumber}`);
    console.log(`Dealer: ${round.dealerId}`);
    console.log(`Cards to play: ${round.cardsToPlay}`);
}
```

---

#### 6. `getPlayerPlayedCards(playerId: string): number[]`
获取玩家本回合出的牌

**参数：**
- `playerId`: 玩家ID

**返回：** 出的牌数组

**示例：**
```typescript
const playedCards = game.getPlayerPlayedCards('player_0');
console.log('Player 0 played:', playedCards);
```

---

#### 7. `allPlayersPlayed(): boolean`
检查是否所有玩家都已出牌

**返回：** true/false

**示例：**
```typescript
if (game.allPlayersPlayed()) {
    console.log('All players have played, showing results...');
}
```

---

### 游戏操作

#### 8. `selectFirstDealer(revealedCards: Map<string, number>): string`
**阶段1：选择第一个Dealer**

每个玩家展示一张牌，比大小，最大的成为Dealer

**参数：**
- `revealedCards`: Map<玩家ID, 手牌索引>

**返回：** Dealer的玩家ID

**示例：**
```typescript
// 每个玩家选择展示自己的第0张牌
const revealed = new Map<string, number>();
revealed.set('player_0', 0);
revealed.set('player_1', 0);
revealed.set('player_2', 0);
revealed.set('player_3', 0);

const dealerId = game.selectFirstDealer(revealed);
console.log(`Dealer is ${dealerId}`);
```

---

#### 9. `dealerCall(cardsToPlay: 1 | 2 | 3): boolean`
**阶段2：Dealer叫牌**

Dealer决定本回合每人出几张牌

**参数：**
- `cardsToPlay`: 1, 2, 或 3

**返回：** 成功/失败

**示例：**
```typescript
// Dealer叫2张牌
const success = game.dealerCall(2);
if (success) {
    console.log('Dealer called: 2 cards');
}
```

---

#### 10. `playerSelectCards(playerId: string, cardIndices: number[]): boolean`
**阶段3：玩家选牌**

玩家从手牌中选择指定数量的牌

**参数：**
- `playerId`: 玩家ID
- `cardIndices`: 手牌索引数组（例如 [0, 2] 表示选第1和第3张牌）

**返回：** 成功/失败

**示例：**
```typescript
// Player 0 选择第0和第1张牌
const success = game.playerSelectCards('player_0', [0, 1]);
if (success) {
    console.log('Player 0 played cards');
}

// 自动检测回合是否结束
if (game.allPlayersPlayed()) {
    const round = game.getCurrentRound();
    console.log(`Winner: ${round.roundWinnerId}`);
    console.log(`Loser: ${round.roundLoserId}`);
}
```

---

#### 11. `refillHands(): void`
**阶段4：补牌**

将所有玩家的手牌补到5张，开始下一回合

**自动处理：**
- 检查游戏是否结束
- 如果结束，显示最终分数
- 如果未结束，自动开始下一回合（输家成为新Dealer）

**示例：**
```typescript
game.refillHands();
// 控制台会自动输出补牌结果和下一回合信息
```

---

### 测试和调试

#### 12. `autoPlayTestRound(): void`
自动运行一个完整回合（用于测试）

**功能：**
1. 自动选择第一个Dealer
2. Dealer自动叫2张牌
3. 所有玩家自动出牌
4. 2秒后自动补牌

**示例：**
```typescript
game.autoPlayTestRound();
// 查看控制台输出，了解完整流程
```

---

## 🎯 使用示例

### 示例1：手动控制完整流程

```typescript
// 在你的组件中
const game = this.node.getComponent(Game);

// 1. 获取游戏状态
console.log('State:', game.getTheDecreeState());

// 2. 查看手牌
const myHand = game.getPlayerHand('player_0');
console.log('My cards:', myHand);

// 3. 选择Dealer（假设UI上玩家点击了第0张牌）
const revealed = new Map();
revealed.set('player_0', 0); // 玩家0选择第0张
revealed.set('player_1', 1); // 玩家1选择第1张
revealed.set('player_2', 0); // ...
revealed.set('player_3', 2);
const dealerId = game.selectFirstDealer(revealed);

// 4. Dealer叫牌（假设UI上选择了2张）
if (dealerId === 'player_0') {
    // 如果我是Dealer，显示叫牌UI
    game.dealerCall(2);
}

// 5. 玩家出牌（假设UI上选择了第0和第1张牌）
game.playerSelectCards('player_0', [0, 1]);

// 6. 等待其他玩家...
// 当所有玩家都出牌后
if (game.allPlayersPlayed()) {
    const round = game.getCurrentRound();
    console.log('Winner:', round.roundWinnerId);
    console.log('Loser:', round.roundLoserId);

    // 显示结果动画...

    // 2秒后补牌
    setTimeout(() => {
        game.refillHands();
    }, 2000);
}
```

---

### 示例2：绑定到UI按钮

```typescript
// DealerCallUI.ts
export class DealerCallUI extends Component {
    onButton1Clicked() {
        const game = find('GameController').getComponent(Game);
        game.dealerCall(1);
    }

    onButton2Clicked() {
        const game = find('GameController').getComponent(Game);
        game.dealerCall(2);
    }

    onButton3Clicked() {
        const game = find('GameController').getComponent(Game);
        game.dealerCall(3);
    }
}

// PlayerCardSelection.ts
export class PlayerCardSelection extends Component {
    private selectedIndices: number[] = [];

    onCardClicked(cardIndex: number) {
        // 切换选中状态
        const index = this.selectedIndices.indexOf(cardIndex);
        if (index > -1) {
            this.selectedIndices.splice(index, 1);
        } else {
            this.selectedIndices.push(cardIndex);
        }
    }

    onConfirmClicked() {
        const game = find('GameController').getComponent(Game);
        game.playerSelectCards('player_0', this.selectedIndices);
    }
}
```

---

## 📊 游戏状态机

```
[SETUP] 游戏初始化
   ↓
[FIRST_DEALER_SELECTION] 选择第一个Dealer
   ↓ selectFirstDealer()
[DEALER_CALL] Dealer叫牌
   ↓ dealerCall()
[PLAYER_SELECTION] 玩家选牌
   ↓ playerSelectCards() × 4
[SHOWDOWN] 比牌（自动）
   ↓
[SCORING] 计分（自动）
   ↓ refillHands()
[REFILL] 补牌
   ↓
   ├─→ [DEALER_CALL] 继续下一回合
   └─→ [GAME_OVER] 游戏结束
```

---

## 🎲 牌型比较规则

使用德州扑克规则（TexasHoldEmEvaluator）：

1. **皇家同花顺** (Royal Flush) - 9分
2. **同花顺** (Straight Flush) - 8分
3. **四条** (Four of a Kind) - 7分
4. **葫芦** (Full House) - 6分
5. **同花** (Flush) - 5分
6. **顺子** (Straight) - 4分
7. **三条** (Three of a Kind) - 3分
8. **两对** (Two Pair) - 2分
9. **一对** (One Pair) - 1分
10. **高牌** (High Card) - 0分

**计分规则：**
- 基础分：根据牌型得分
- 赢家额外+1分
- 输家不扣分

---

## 🔍 调试技巧

### 1. 查看控制台输出
所有接口都有详细的日志输出：
```
[The Decree] Game initialized
[The Decree] First dealer selected: player_2
[The Decree] Dealer called: 2 cards
[The Decree] Player player_0 played 2 cards
[The Decree] Round complete!
Winner: player_1
Loser: player_3
```

### 2. 检查游戏状态
```typescript
console.log('State:', game.getTheDecreeState());
console.log('Round:', game.getCurrentRound());
console.log('Scores:', game.getPlayerScores());
```

### 3. 使用自动测试
```typescript
game.autoPlayTestRound();
// 观察完整流程
```

---

## ✅ 实现清单

| 功能 | 状态 | 接口方法 |
|------|------|----------|
| 初始化游戏 | ✅ | 自动（startTheDecreeFlow） |
| 发公共牌 | ✅ | getCommunityCards() |
| 发手牌 | ✅ | getPlayerHand() |
| 选择Dealer | ✅ | selectFirstDealer() |
| Dealer叫牌 | ✅ | dealerCall() |
| 玩家出牌 | ✅ | playerSelectCards() |
| 比牌 | ✅ | 自动（内部） |
| 计分 | ✅ | getPlayerScores() |
| 补牌 | ✅ | refillHands() |
| 回合管理 | ✅ | getCurrentRound() |
| 游戏结束判定 | ✅ | 自动（refillHands中） |

---

## 🚀 下一步

**UI 实现建议：**

1. **公共牌显示**
   - 在场景中央显示4张牌
   - 使用 `getCommunityCards()` 获取牌数据

2. **手牌显示**
   - 显示当前玩家的5张牌
   - 使用 `getPlayerHand('player_0')` 获取数据

3. **Dealer指示器**
   - 高亮显示当前Dealer
   - 从 `getCurrentRound().dealerId` 获取

4. **叫牌UI**
   - 3个按钮：1张、2张、3张
   - 只在Dealer叫牌阶段显示
   - 绑定到 `dealerCall()`

5. **选牌UI**
   - 可点击的手牌
   - 选中后高亮
   - 确认按钮绑定到 `playerSelectCards()`

6. **回合结果显示**
   - 显示所有玩家的牌和牌型
   - 高亮赢家和输家
   - 显示分数变化

---

## 📞 需要帮助？

所有接口都已经可以使用，你可以：
1. 在控制台测试 `autoPlayTestRound()`
2. 开始实现UI绑定
3. 需要添加新接口随时告诉我

享受游戏开发！🎮
