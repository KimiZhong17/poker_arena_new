# TheDecree 自动游戏流程测试指南

## 📋 已完成的功能

### ✅ 自动游戏循环
- **update() 方法** - 每帧驱动状态机
- **状态机自动流转** - 自动处理所有游戏状态
- **AI 决策系统** - 自动选庄、叫牌、选牌
- **游戏结束检测** - 自动切换到 EndStage

## 🎮 游戏流程说明

### 完整的自动流程

```
1. [SETUP] 初始化
   ↓ (onEnter 自动执行)
2. [FIRST_DEALER_SELECTION] 选首庄
   ↓ (2秒后自动执行)
3. [DEALER_CALL] 庄家叫牌
   ↓ (2秒后自动执行)
4. [PLAYER_SELECTION] 所有玩家选牌
   ↓ (2秒后自动执行)
5. [SHOWDOWN] 摊牌比较
   ↓ (立即执行)
6. [SCORING] 计分
   ↓ (3秒后自动执行)
7. [REFILL] 补牌
   ↓ (2秒后自动执行)

→ 循环到步骤 3，直到牌库耗尽
→ [GAME_OVER] 游戏结束，切换到 EndStage
```

## 🧪 测试步骤

### 1. 准备测试环境

确保以下文件已更新：
- ✅ `TheDecreeMode.ts` - 添加了 update() 和自动游戏逻辑
- ✅ `PlayingStage.ts` - 已有 update() 转发逻辑
- ✅ `Game.ts` - 已有 update() 调用 stageManager

### 2. 运行游戏

1. 启动 Cocos Creator
2. 打开 Login 场景
3. 点击"开始游戏"
4. 创建房间
5. 点击"准备"按钮（所有玩家准备好后自动开始）
6. **观察控制台输出** 👈 重点

### 3. 预期的控制台输出

```
[TheDecree] Entering game mode
[TheDecree] Game initialized and cards dealt
[TheDecree] Auto-selecting first dealer...
  player_0: A♠
  player_1: K♥
  player_2: 8♣
  player_3: Q♦
[TheDecree] First dealer selected: player_0
[TheDecree] Round 1: Dealer player_0 calls 2 card(s)
[TheDecree]   player_0 plays: [10♠, J♠]
[TheDecree]   player_1 plays: [5♥, 7♥]
[TheDecree]   player_2 plays: [3♣, 4♣]
[TheDecree]   player_3 plays: [2♦, 6♦]
[TheDecree] Round 1 Result:
  Winner: player_0
  Loser: player_3
  Current Scores:
    player_0: 2
    player_1: 0
    player_2: 0
    player_3: 0
[TheDecree] Refilling hands...
[TheDecree] Starting round 2... (Deck: 30 cards remaining)
[TheDecree] Round 2: Dealer player_3 calls 1 card(s)
...
```

### 4. 验证要点

#### ✅ 自动选庄
- [ ] 控制台显示每个玩家翻开的牌
- [ ] 正确选出点数最大的玩家作为庄家
- [ ] 自动进入下一状态（DEALER_CALL）

#### ✅ 自动叫牌
- [ ] 庄家自动决定出牌数量（1/2/3）
- [ ] 控制台显示叫牌信息
- [ ] 自动进入下一状态（PLAYER_SELECTION）

#### ✅ 自动选牌
- [ ] 所有玩家自动出牌
- [ ] 控制台显示每个玩家出的牌
- [ ] 自动进入下一状态（SHOWDOWN）

#### ✅ 自动摊牌和计分
- [ ] 控制台显示赢家和输家
- [ ] 显示当前得分
- [ ] 自动进入下一状态（REFILL）

#### ✅ 自动补牌
- [ ] 玩家手牌补充到5张
- [ ] 输家成为下一轮庄家
- [ ] 自动开始下一回合

#### ✅ 游戏结束
- [ ] 牌库耗尽时自动结束
- [ ] 显示最终得分和赢家
- [ ] 自动切换到 EndStage

## 🔍 调试技巧

### 1. 修改游戏速度

在 [TheDecreeMode.ts:66](poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeMode.ts#L66) 修改延迟时间：

```typescript
// 更快的游戏速度（测试用）
private readonly STATE_DELAY = 0.5;  // 0.5秒

// 正常游戏速度
private readonly STATE_DELAY = 2.0;  // 2秒

// 慢速（观察用）
private readonly STATE_DELAY = 5.0;  // 5秒
```

### 2. 查看详细日志

所有游戏事件都会输出到控制台，包括：
- 发牌结果
- 选庄过程
- 每轮叫牌
- 每个玩家出牌
- 回合结果
- 得分变化
- 牌库剩余数量

### 3. 手动触发某个状态

如果需要手动测试某个状态，可以在 Game.ts 的开发者控制台中执行：

```typescript
// 获取 TheDecreeMode
const mode = game.theDecreeMode;

// 查看当前状态
console.log(mode.getState());

// 查看当前回合
console.log(mode.getCurrentRound());

// 查看得分
console.log(mode.getScores());

// 查看牌库剩余
console.log(mode.getDeckSize());
```

## 🐛 常见问题

### 问题1：游戏不会自动进行

**可能原因**：
- PlayingStage 没有调用 gameMode.update()
- Game.ts 的 update() 没有调用 stageManager.update()

**解决方法**：
检查 [PlayingStage.ts:88](poker_arena_client/assets/Scripts/Core/Stage/PlayingStage.ts#L88) 确保有：
```typescript
public update(deltaTime: number): void {
    if (this.currentGameMode && this.currentGameMode.update) {
        this.currentGameMode.update(deltaTime);
    }
}
```

### 问题2：游戏结束后没有切换到 EndStage

**可能原因**：
- EndStage 还未实现
- StageManager 的 END 状态未注册

**临时方案**：
游戏会输出结果到控制台，然后停留在 GAME_OVER 状态。待 EndStage 实现后会自动切换。

### 问题3：控制台出现错误

**检查点**：
1. 所有玩家是否正确初始化
2. 牌库是否正确洗牌
3. 手牌数量是否正确
4. 公共牌是否正确发放

## 📊 性能指标

### 预期游戏时长

- **牌库**: 52张
- **初始发牌**: 4张公共牌 + 4人×5张 = 24张
- **剩余牌库**: 28张
- **每轮消耗**: 4人×(1-3)张 = 4-12张
- **预计回合数**: 2-7轮
- **总时长**: 约 30-90 秒（取决于 STATE_DELAY）

## ✅ 验收标准

完成以下所有项即表示自动游戏流程测试通过：

- [ ] 游戏可以从 ReadyStage 自动开始
- [ ] 自动选择首庄
- [ ] 自动进行 2-7 轮游戏
- [ ] 每轮自动叫牌、出牌、比牌、计分、补牌
- [ ] 控制台输出完整的游戏过程
- [ ] 游戏自动结束并显示最终结果
- [ ] 没有报错或崩溃
- [ ] 游戏逻辑符合规则（牌型评估正确）

## 🚀 下一步

在自动游戏流程测试通过后，可以进行：

1. **实现 EndStage** - 显示游戏结果和返回大厅
2. **添加玩家交互 UI** - 让玩家可以手动选牌
3. **优化 AI 决策** - 更智能的选牌策略
4. **添加动画效果** - 发牌、摊牌动画
5. **网络多人同步** - 支持真实的多人对战

---

## 📝 测试记录

测试日期：___________

测试人员：___________

### 测试结果

- [ ] ✅ 通过
- [ ] ⚠️ 部分通过（记录问题）
- [ ] ❌ 未通过（记录原因）

### 发现的问题

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### 备注

___________________________________________
___________________________________________
