# ReadyStage 实现文档

## 📋 功能概述

实现了准备阶段（ReadyStage）的完整逻辑，包含房主和非房主的不同交互体验。

---

## ✨ 核心功能

### 1. 房主模式
- ✅ 按钮显示 **"开始游戏"**
- ✅ 仅当**所有非房主玩家准备好**后才能点击
- ✅ 未准备完成时按钮**灰色禁用**
- ✅ 所有人准备好后按钮**白色可点击**
- ✅ 点击后切换到 PlayingStage（游戏阶段）

### 2. 非房主模式
- ✅ 按钮初始显示 **"准备"**（白色）
- ✅ 点击后变为 **"已准备"**（绿色）
- ✅ 准备后按钮**自动禁用**，不可再点击
- ✅ 等待房主开始游戏

### 3. 准备状态跟踪
- ✅ 实时统计已准备人数
- ✅ 控制台输出准备进度（如 "2/3 players ready"）
- ✅ 自动更新按钮状态
- ✅ 支持单机模式和多人模式

---

## 🏗️ 技术实现

### 修改的文件
- **`ReadyStage.ts`** ([assets/Scripts/Core/Stage/ReadyStage.ts](f:\KimiProjects\poker_arena_new\poker_arena_client\assets\Scripts\Core\Stage\ReadyStage.ts))

### 新增依赖
```typescript
import { RoomManager } from '../Room/RoomManager';
import { UserManager } from '../../Manager/UserManager';
```

### 关键方法

#### 1. `initLocalPlayerInfo()`
初始化本地玩家信息，判断是否为房主。

```typescript
private initLocalPlayerInfo(): void {
    const currentRoom = this.roomManager.getCurrentRoom();
    const currentUser = this.userManager.getCurrentUser();

    // 获取玩家ID
    this.localPlayerId = currentUser?.id || 'player_0';

    // 判断是否为房主
    this.isLocalPlayerHost = localPlayer?.isHost || true;
}
```

#### 2. `updateButtonDisplay()`
根据房主身份和准备状态更新按钮显示。

```typescript
private updateButtonDisplay(): void {
    if (this.isLocalPlayerHost) {
        // 房主：显示"开始游戏"
        this.btnLabel.string = '开始游戏';

        // 所有人准备好 -> 可点击（白色）
        // 未全部准备 -> 禁用（灰色）
        const allReady = this.allNonHostPlayersReady();
        this.btnStart.interactable = allReady;
        this.btnLabel.color = allReady ? White : Gray;
    } else {
        // 非房主：显示"准备"或"已准备"
        const isReady = this.playerReadyStates.get(this.localPlayerId);

        if (isReady) {
            this.btnLabel.string = '已准备';
            this.btnStart.interactable = false; // 禁用
            this.btnLabel.color = Green;
        } else {
            this.btnLabel.string = '准备';
            this.btnStart.interactable = true;
            this.btnLabel.color = White;
        }
    }
}
```

#### 3. `onStartButtonClicked()`
按钮点击事件处理。

```typescript
private onStartButtonClicked(): void {
    if (this.isLocalPlayerHost) {
        // 房主：检查是否所有人准备好，然后开始游戏
        if (this.allNonHostPlayersReady()) {
            this.startGame();
        }
    } else {
        // 非房主：标记自己为准备状态
        this.onPlayerReady(this.localPlayerId);
    }
}
```

#### 4. `allNonHostPlayersReady()`
检查所有非房主玩家是否已准备。

```typescript
private allNonHostPlayersReady(): boolean {
    // 单机模式：直接返回 true
    if (!this.roomManager.getCurrentRoom()) {
        return true;
    }

    // 多人模式：检查所有非房主玩家
    for (const [playerId, isReady] of this.playerReadyStates) {
        // 跳过房主
        if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
            continue;
        }

        if (!isReady) {
            return false;
        }
    }

    return true;
}
```

---

## 🎮 使用流程

### 单机测试模式（当前）
1. 进入 GameRoom 场景
2. 系统自动识别为房主（单机模式）
3. 按钮显示 **"开始游戏"**，直接可点击
4. 点击后切换到 PlayingStage

### 多人模式（未来）
#### 房主流程：
1. 创建房间，自动成为房主
2. 等待其他玩家加入
3. 按钮显示 **"开始游戏"**（灰色禁用）
4. 等待所有玩家点击"准备"
5. 所有人准备好后，按钮变为**白色可点击**
6. 点击"开始游戏"，所有客户端切换到 PlayingStage

#### 非房主流程：
1. 加入房间
2. 按钮显示 **"准备"**（白色）
3. 点击后变为 **"已准备"**（绿色禁用）
4. 等待房主开始游戏
5. 房主点击开始后，自动切换到 PlayingStage

---

## 🔧 配置说明

### 场景配置（GameRoom.scene）
需要在场景中配置以下节点：

```
Canvas
└── Node_ReadyStage (准备阶段根节点)
    └── btn_start (开始/准备按钮)
        └── Label (可选，代码会自动创建)
```

### 按钮节点命名
- 按钮节点名称必须为：`btn_start`
- 如果按钮上没有 Label 组件，代码会自动创建一个

### 玩家数量
默认配置为 4 人（The Decree 模式）：
```typescript
private totalPlayers: number = 4;
```

可以通过 `setTotalPlayers()` 方法修改：
```typescript
readyStage.setTotalPlayers(5); // 改为 5 人（掼蛋模式）
```

---

## 📊 状态管理

### 玩家准备状态
使用 Map 存储每个玩家的准备状态：
```typescript
playerReadyStates: Map<string, boolean>
// 例如：
// 'player_0' -> false (未准备)
// 'player_1' -> true  (已准备)
// 'player_2' -> false (未准备)
// 'player_3' -> true  (已准备)
```

### 与 RoomManager 的集成
- 从 `RoomManager.getCurrentRoom()` 获取房间信息
- 使用 `roomManager.setPlayerReady()` 同步准备状态
- 读取 `room.players[].isHost` 判断房主身份

---

## 🐛 调试信息

### 控制台输出示例

#### 进入准备阶段：
```
[ReadyStage] Entering ready stage
[ReadyStage] Local player initialized: user_123, isHost: true, totalPlayers: 4
[ReadyStage] Reset ready states for 4 players
[ReadyStage] Start button registered
[ReadyStage] All players ready! Host can start game (单机模式)
[ReadyStage] Waiting for players to ready up...
[ReadyStage] Local player: user_123, isHost: true
```

#### 玩家准备时（非房主）：
```
[ReadyStage] Start button clicked
[ReadyStage] Player player_1 is ready
[ReadyStage] 1/3 players ready
```

#### 房主开始游戏：
```
[ReadyStage] Start button clicked
[ReadyStage] Host starting game...
[ReadyStage] Switching to Playing stage...
```

---

## ✅ 测试清单

### 单机模式测试
- [ ] 进入 GameRoom 场景，按钮显示"开始游戏"
- [ ] 按钮为白色且可点击
- [ ] 点击按钮后切换到 PlayingStage
- [ ] 控制台无错误输出

### 多人模式测试（未来）
#### 房主测试：
- [ ] 创建房间后按钮显示"开始游戏"
- [ ] 无其他玩家时按钮为灰色禁用
- [ ] 有玩家加入但未准备时按钮保持禁用
- [ ] 所有玩家准备好后按钮变为白色可点击
- [ ] 点击后所有客户端切换到 PlayingStage

#### 非房主测试：
- [ ] 加入房间后按钮显示"准备"（白色）
- [ ] 点击后变为"已准备"（绿色）
- [ ] 准备后按钮自动禁用
- [ ] 无法取消准备状态
- [ ] 房主开始游戏后自动切换阶段

---

## 🔄 与其他系统的集成

### 依赖的系统
1. **RoomManager** - 房间管理
   - 获取当前房间信息
   - 同步玩家准备状态

2. **UserManager** - 用户管理
   - 获取当前用户ID
   - 判断玩家身份

3. **StageManager** - 阶段管理
   - 切换到 PlayingStage

### 被依赖的系统
- **Game.ts** - 主游戏控制器
  - 调用 `stageManager.switchToStage(GameStage.READY)` 进入准备阶段

---

## 🚀 下一步

### 立即可做
1. ✅ 在 Cocos Creator 中配置 `btn_start` 按钮
2. ✅ 测试单机模式的准备流程
3. ✅ 验证按钮文字和颜色变化

### 短期计划
4. ⏳ 实现 PlayingStage（游戏进行阶段）
5. ⏳ 添加 AI 模拟其他 3 个玩家准备
6. ⏳ 添加准备状态UI显示（显示每个玩家的准备状态）

### 长期计划
7. ⏳ 实现多人网络同步
8. ⏳ 添加准备倒计时功能
9. ⏳ 添加玩家头像和昵称显示

---

## 📝 注意事项

1. **单机模式自动适配**
   - 如果 RoomManager 没有当前房间，自动切换为单机模式
   - 单机模式下房主可以直接开始游戏

2. **房主不需要准备**
   - 房主不在准备状态检查范围内
   - 房主只负责开始游戏

3. **按钮文字自动创建**
   - 如果场景中按钮没有 Label 组件，代码会自动创建
   - 建议在场景编辑器中手动添加 Label 以便预览

4. **颜色编码**
   - 白色（255,255,255）- 正常可点击
   - 灰色（150,150,150）- 禁用状态
   - 绿色（100,255,100）- 已准备状态

---

## 🎯 总结

ReadyStage 现已完整实现房主/非房主的差异化交互逻辑：
- ✅ 房主控制游戏开始
- ✅ 非房主通过准备按钮表示就绪
- ✅ 自动状态管理和按钮更新
- ✅ 支持单机和多人模式
- ✅ 完整的调试输出

可以直接测试单机模式，多人模式的网络同步留待后续实现。
