# ReadyStage 测试指南

## 🎯 测试目标

测试准备阶段（ReadyStage）的房主/非房主功能：
- ✅ 房主显示"开始游戏"按钮
- ✅ 非房主显示"准备"/"已准备"按钮
- ✅ 准备状态管理和按钮禁用逻辑

---

## 📋 前置准备

### 1. 确认文件已更新
确保以下文件已包含最新代码：
- ✅ `assets/Scripts/Core/Stage/ReadyStage.ts`

### 2. 确认依赖文件存在
- ✅ `assets/Scripts/Core/Room/RoomManager.ts`
- ✅ `assets/Scripts/Manager/UserManager.ts`
- ✅ `assets/Scripts/Core/Stage/GameStageBase.ts`
- ✅ `assets/Scripts/Game.ts`

---

## 🛠️ 步骤1：在 Cocos Creator 中配置场景

### 打开 GameRoom 场景
1. 启动 **Cocos Creator**
2. 打开项目：`f:\KimiProjects\poker_arena_new\poker_arena_client`
3. 在 **资源管理器** 中找到并双击：`assets/Scenes/GameRoom.scene`

### 检查场景结构
在 **层级管理器** 中，确认有以下节点结构：

```
GameRoom (场景)
└── Canvas
    ├── Camera
    ├── Background (背景图)
    ├── Main (Game 组件在这里)
    ├── HoleCards (手牌显示)
    ├── Node_ReadyStage (准备阶段UI)  ⬅️ 我们需要配置这个
    ├── Node_PlayingStage (游戏阶段UI)
    └── Node_EndStage (结束阶段UI)
```

### 如果没有 Node_ReadyStage，创建它：

1. 右键点击 **Canvas** 节点
2. 选择 **创建 → 创建空节点**
3. 重命名为：`Node_ReadyStage`
4. 设置位置：
   - Position: (0, 0, 0)
   - Active: ✅ 勾选

---

## 🛠️ 步骤2：添加开始按钮

### 创建按钮节点
1. 右键点击 **Node_ReadyStage** 节点
2. 选择 **创建 → UI 组件 → Button**
3. 重命名为：`btn_start` ⬅️ **必须是这个名字！**

### 配置按钮属性

#### A. 设置按钮位置和大小
选中 `btn_start` 节点，在 **属性检查器** 中设置：

**UITransform 组件：**
- Width: `300`
- Height: `100`
- Position: `(0, -200, 0)` （屏幕中下方）

#### B. 设置按钮背景图
在 **属性检查器** 中找到 **Sprite 组件**：

1. 点击 **SpriteFrame** 右侧的 **...** 按钮
2. 选择：`assets/Resources/UI/GameBtn01.png`
3. 设置 **Type** 为：`SIMPLE` 或 `SLICED`

#### C. 配置 Button 组件
在 **Button 组件** 中：
- Transition: `SPRITE` 或 `COLOR`
- Interactable: ✅ 勾选
- Target: 指向 `btn_start` 节点自己

### 添加文字标签（可选）

如果你想在编辑器中预览按钮文字：

1. 右键点击 `btn_start` 节点
2. 选择 **创建 → UI 组件 → Label**
3. 重命名为：`Label`

**配置 Label 属性：**
- String: `开始游戏`
- Font Size: `32`
- Color: 白色 `(255, 255, 255, 255)`
- Overflow: `CLAMP`
- Horizontal Align: `CENTER`
- Vertical Align: `CENTER`
- Position: `(0, 0, 0)`

> **注意**：即使不添加 Label，代码也会自动创建一个。但手动添加可以在编辑器中预览效果。

---

## 🛠️ 步骤3：配置 Main 节点（Game 组件）

### 找到 Main 节点
在 **层级管理器** 中找到 **Main** 节点（应该在 Canvas 下）

### 配置 Game 组件
选中 **Main** 节点，在 **属性检查器** 中找到 **Game 组件**：

#### 设置节点引用：
拖拽以下节点到对应的属性槽：

1. **Game Controller Node**: 拖拽 `Main` 节点自己
2. **Hands Manager Node**: 拖拽 `HoleCards` 节点
3. **Node Ready Stage**: 拖拽 `Node_ReadyStage` 节点 ⬅️ **重要！**
4. **Node Playing Stage**: 拖拽 `Node_PlayingStage` 节点
5. **Node End Stage**: 拖拽 `Node_EndStage` 节点

### 最终场景结构应该是：

```
GameRoom
└── Canvas
    ├── Camera
    ├── Background
    ├── Main (Game 组件)
    │   ├── nodeReadyStage → Node_ReadyStage
    │   ├── nodePlayingStage → Node_PlayingStage
    │   └── nodeEndStage → Node_EndStage
    ├── HoleCards
    ├── Node_ReadyStage ⬅️ 准备阶段
    │   └── btn_start (Button + Label)
    ├── Node_PlayingStage
    └── Node_EndStage
```

---

## 🛠️ 步骤4：保存场景

1. 按 **Ctrl+S** 保存场景
2. 确认控制台没有错误提示

---

## ▶️ 步骤5：运行测试

### 启动游戏
1. 点击 Cocos Creator 顶部的 **播放按钮** ▶️
2. 或按快捷键 **F5**

### 预期结果（单机模式）

#### 场景加载后：
- ✅ 可以看到"开始游戏"按钮
- ✅ 按钮文字为白色
- ✅ 按钮可以点击

#### 控制台输出：
```
[Game] Entering game - initializing systems...
[ReadyStage] Entering ready stage
[ReadyStage] Local player initialized: player_0, isHost: true, totalPlayers: 4
[ReadyStage] Reset ready states for 4 players
[ReadyStage] Start button registered
[ReadyStage] All players ready! Host can start game
[ReadyStage] Waiting for players to ready up...
[ReadyStage] Local player: player_0, isHost: true
```

#### 点击按钮后：
- ✅ 控制台输出：`[ReadyStage] Host starting game...`
- ✅ 控制台输出：`[ReadyStage] Switching to Playing stage...`
- ✅ 场景切换到 PlayingStage（如果已实现）

---

## 🐛 常见问题排查

### 问题1：按钮没有显示
**原因**：Node_ReadyStage 节点未激活

**解决方案**：
1. 选中 `Node_ReadyStage` 节点
2. 确保 **Active** 属性打勾 ✅

---

### 问题2：按钮显示但没有文字
**原因**：Label 组件未正确创建

**解决方案1**（手动创建）：
1. 右键点击 `btn_start` 节点
2. 创建 Label 子节点
3. 配置 Label 属性（参考步骤2）

**解决方案2**（让代码自动创建）：
- 代码会自动创建 Label，检查控制台是否有：
  ```
  [ReadyStage] Created label for start button
  ```

---

### 问题3：控制台报错 "Start button not found"
**原因**：按钮节点名称不正确

**解决方案**：
1. 确认按钮节点名称**必须是**：`btn_start`（区分大小写）
2. 不能是 `Button`、`StartButton` 等其他名称

---

### 问题4：点击按钮没反应
**原因**：Button 组件未配置或禁用

**解决方案**：
1. 选中 `btn_start` 节点
2. 检查 **Button 组件**：
   - Interactable: ✅ 必须勾选
   - Target: 必须指向 `btn_start` 节点

---

### 问题5：控制台报错找不到 RoomManager
**原因**：TypeScript 编译错误

**解决方案**：
1. 在 Cocos Creator 菜单中点击：**开发者 → 重新编译脚本**
2. 等待编译完成
3. 检查控制台是否有编译错误

---

## 🔍 调试技巧

### 1. 查看控制台日志
按 **F12** 打开浏览器开发者工具，查看控制台输出。

### 2. 检查按钮状态
在控制台输入以下代码，查看按钮状态：
```javascript
// 查看 ReadyStage 是否激活
console.log('ReadyStage active:', game.stageManager.currentStage);

// 查看玩家信息
console.log('Local player:', userManager.getCurrentUser());
console.log('Current room:', roomManager.getCurrentRoom());
```

### 3. 手动触发按钮
如果按钮无法点击，可以在控制台手动触发：
```javascript
// 手动切换到 Playing 阶段
game.stageManager.switchToStage(GameStage.PLAYING);
```

---

## 📊 测试清单

### 单机模式测试（当前阶段）
- [ ] 场景加载成功
- [ ] 按钮显示"开始游戏"
- [ ] 按钮文字为白色
- [ ] 按钮可以点击（不是灰色）
- [ ] 点击后控制台输出正确日志
- [ ] 点击后切换到 PlayingStage（如果已实现）

### 多人模式测试（未来阶段）
#### 房主测试：
- [ ] 创建房间后显示"开始游戏"
- [ ] 无其他玩家时按钮禁用（灰色）
- [ ] 其他玩家加入但未准备时按钮禁用
- [ ] 所有玩家准备后按钮可点击（白色）
- [ ] 点击后所有客户端切换阶段

#### 非房主测试：
- [ ] 加入房间后显示"准备"
- [ ] 按钮为白色可点击
- [ ] 点击后变为"已准备"（绿色）
- [ ] 准备后按钮自动禁用
- [ ] 房主开始游戏后自动切换阶段

---

## 🎥 测试截图位置

建议在以下时刻截图：
1. 场景加载后的按钮状态
2. 控制台日志输出
3. 点击按钮后的场景变化

---

## 🚀 下一步

测试通过后，可以继续实现：
1. **PlayingStage** - 游戏进行阶段
2. **AI 玩家** - 自动准备的模拟玩家
3. **准备状态 UI** - 显示每个玩家的准备状态

---

## 📞 遇到问题？

如果遇到任何问题：
1. 检查控制台错误日志
2. 确认所有文件路径正确
3. 重新编译脚本（开发者 → 重新编译脚本）
4. 重启 Cocos Creator

---

## 📝 预期的完整控制台输出

```log
[Game] Main onLoad
[Game] Game Mode: the_decree, Room ID: default_room
Poker bundle loaded.
所有扑克牌 SpriteFrame 加载完毕 [54 sprites]
Poker prefab loaded.
[Game] Entering game - initializing systems...
[Game] HandsManager component created (will init with player data later)
[Game] Creating Stage Manager...
[Game] Stage Manager created with 3 stages
[Game] All systems initialized, entering Ready stage

[ReadyStage] Entering ready stage
[ReadyStage] Local player initialized: player_0, isHost: true, totalPlayers: 4
[ReadyStage] Reset ready states for 4 players
[ReadyStage] Start button registered
[ReadyStage] Created label for start button (如果没有 Label)
[ReadyStage] All players ready! Host can start game
[ReadyStage] Waiting for players to ready up...
[ReadyStage] Local player: player_0, isHost: true

[点击按钮后]
[ReadyStage] Start button clicked
[ReadyStage] Host starting game...
[ReadyStage] Switching to Playing stage...
[ReadyStage] Exiting ready stage
[ReadyStage] Start button unregistered
[ReadyStage] UI hidden
[PlayingStage] Entering playing stage (如果已实现)
```

---

祝测试顺利！🎉
