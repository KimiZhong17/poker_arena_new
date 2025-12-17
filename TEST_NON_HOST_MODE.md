# 如何测试"准备"按钮（非房主模式）

## 🎯 问题
单机模式下默认是房主，看到的是"开始游戏"按钮。
如何测试非房主的"准备"按钮？

---

## 📝 方案1：临时修改代码（最简单）

### 步骤：

1. **打开 ReadyStage.ts**
   - 路径：`assets/Scripts/Core/Stage/ReadyStage.ts`

2. **找到第 101 行**（`initLocalPlayerInfo` 方法）
   ```typescript
   } else {
       // 单机模式：默认为房主
       this.isLocalPlayerHost = true;  // ⬅️ 找到这一行
       this.totalPlayers = 4;
   }
   ```

3. **临时修改为非房主**
   ```typescript
   } else {
       // 单机模式：【测试】改为非房主
       this.isLocalPlayerHost = false;  // ⬅️ 改成 false
       this.totalPlayers = 4;
   }
   ```

4. **保存并运行**
   - 按 `Ctrl+S` 保存
   - 按 `F5` 运行游戏

5. **预期结果**
   - ✅ 按钮显示 **"准备"**
   - ✅ 按钮可以点击
   - ✅ 点击后变为 **"已准备"**
   - ✅ 按钮自动禁用（不能再点击）

6. **控制台输出**
   ```log
   [ReadyStage] Local player initialized: player_0, isHost: false, totalPlayers: 4
   [ReadyStage] Found label on start button
   [ReadyStage] Waiting for players: 0/3 ready  ⬅️ 显示等待其他玩家

   [点击按钮后]
   [ReadyStage] Start button clicked
   [ReadyStage] Player player_0 is ready
   [ReadyStage] 1/3 players ready
   ```

7. **测试完后记得改回来！**
   ```typescript
   this.isLocalPlayerHost = true;  // ⬅️ 改回 true
   ```

---

## 📝 方案2：控制台测试（不用修改代码）

### 步骤：

1. **正常运行游戏**（房主模式）

2. **打开浏览器控制台**（按 F12）

3. **手动设置为非房主**
   ```javascript
   // 获取 ReadyStage 实例
   const game = find('Canvas/Main').getComponent('Game');
   const readyStage = game.stageManager.currentStage;

   // 强制设置为非房主
   readyStage['isLocalPlayerHost'] = false;

   // 重新更新按钮显示
   readyStage['updateButtonDisplay']();
   ```

4. **查看效果**
   - 按钮文字会立即变为 **"准备"**
   - 可以点击测试

---

## 📝 方案3：使用 Game 组件的调试属性（推荐）

我可以帮你在 Game.ts 中添加一个调试选项，这样你就可以在编辑器中直接切换测试模式。

### 需要修改：

在 `Game.ts` 中添加一个属性：
```typescript
@property({
    tooltip: '测试非房主模式（勾选后玩家变为非房主）'
})
public debugTestAsNonHost: boolean = false;
```

然后在 ReadyStage 初始化时检查这个属性。

**要我帮你实现这个方案吗？** 这样以后测试就更方便了。

---

## 🎮 测试流程

### 房主模式（默认）
1. 运行游戏
2. 看到 **"开始游戏"** 按钮
3. 按钮直接可点击
4. 点击后切换到 PlayingStage

### 非房主模式（测试）
1. 修改代码 `isLocalPlayerHost = false`
2. 运行游戏
3. 看到 **"准备"** 按钮
4. 点击按钮
5. 按钮变为 **"已准备"**（绿色或你设置的颜色）
6. 按钮自动禁用
7. 控制台显示 `1/3 players ready`

---

## 🔄 完整测试矩阵

| 场景 | 按钮文字 | 按钮状态 | 点击后 |
|------|---------|---------|--------|
| **房主，无其他玩家** | "开始游戏" | 可点击 | 开始游戏 |
| **房主，有玩家未准备** | "开始游戏" | 禁用（灰） | 无法点击 |
| **房主，所有人准备** | "开始游戏" | 可点击 | 开始游戏 |
| **非房主，未准备** | "准备" | 可点击 | 变为"已准备" |
| **非房主，已准备** | "已准备" | 禁用 | 无法点击 |

---

## 📸 测试截图建议

建议截图以下场景：
1. 房主看到"开始游戏"按钮
2. 非房主看到"准备"按钮
3. 非房主点击后变为"已准备"
4. 控制台日志输出

---

## 🚀 快速测试命令

### 测试非房主模式：
1. 打开 `ReadyStage.ts`
2. 搜索：`this.isLocalPlayerHost = true;`
3. 改为：`this.isLocalPlayerHost = false;`
4. 保存，运行测试
5. 测试完改回 `true`

---

## ❓ 常见问题

### Q1: 修改后看到的还是"开始游戏"？
**A**: 确认修改的是正确的位置（第 101 行），并且已经保存文件。

### Q2: 点击"准备"后游戏开始了？
**A**: 检查是否改错了位置，应该是 `initLocalPlayerInfo` 方法里的修改。

### Q3: 按钮没有文字？
**A**: 确认按钮上有 Label 组件，或者检查控制台是否有警告。

---

## 💡 建议

**最简单的测试方法**：
1. 打开 `ReadyStage.ts`
2. 临时把第 101 行的 `true` 改成 `false`
3. 测试"准备"按钮
4. 测试完改回 `true`

**一分钟就能测试完！** 🎉
