# Hall 场景实现总结

## ✅ 已完成的工作

### 1. 创建了 HallScene.ts
**文件位置**: `UI/Scenes/HallScene.ts`

**主要功能**:
- 显示两个游戏模式按钮（The Decree 和 Guandan）
- 显示欢迎信息（`Welcome, [username]!`）
- 退出登录功能
- 游戏模式信息管理

**关键方法**:
```typescript
selectGameMode(gameModeId: string)  // 选择游戏模式并跳转
onTheDecreeClicked()                // The Decree 按钮
onGuandanClicked()                  // Guandan 按钮
onLogoutClicked()                   // 退出登录
```

---

### 2. 更新了 UserManager
**新增功能**: 保存和获取选中的游戏模式

```typescript
setSelectedGameMode(gameModeId: string): void
getSelectedGameMode(): string | null
clearSelectedGameMode(): void
getUsername(): string  // 新增：获取用户名
```

**用途**:
- 跨场景保存用户选择的游戏模式
- 作为场景数据传递的备选方案

---

### 3. 更新了 SceneManager
**新增场景**: `Hall`
**更新方法**:

```typescript
goToHall(): void
goToLobby(data: { gameMode, minPlayers?, maxPlayers? }): void
goToGame(data: { roomId, gameMode }): void
```

**场景流程**:
```
Login → Hall → Lobby → Game
```

**返回导航**:
```typescript
goBack():
  Game → Lobby
  Lobby → Hall
  Hall → Login
```

---

### 4. 创建了 LobbyScene.ts
**文件位置**: `UI/Scenes/LobbyScene.ts`

**主要功能**:
- 显示当前游戏模式的房间列表
- 创建房间按钮
- 加入房间功能
- 刷新房间列表
- 返回游戏大厅

**数据来源**（容错设计）:
1. 优先从 `SceneManager.getTransitionData()` 获取
2. 备选从 `UserManager.getSelectedGameMode()` 获取
3. 如果都没有，返回 Hall

```typescript
const transitionData = this.sceneManager.getTransitionData();
this.currentGameMode = transitionData.gameMode
    || this.userManager.getSelectedGameMode()
    || '';

if (!this.currentGameMode) {
    this.sceneManager.goToHall();
    return;
}
```

---

### 5. 更新了 LoginScene
- 修改登录成功后跳转到 `Hall`（而不是 GameSelect）
- 自动登录检查也跳转到 `Hall`

---

## 🎯 推荐的实现方案

### 数据传递策略（双保险）

**方案 1: SceneManager 传递（主要）**
- 优点：清晰、类型安全
- 场景间直接传递数据

```typescript
// Hall → Lobby
sceneManager.goToLobby({
    gameMode: 'the_decree',
    minPlayers: 2,
    maxPlayers: 4
});
```

**方案 2: UserManager 存储（备选）**
- 优点：持久化、容错
- 防止数据丢失

```typescript
// Hall 中保存
userManager.setSelectedGameMode('the_decree');

// Lobby 中读取（作为备选）
const gameMode = userManager.getSelectedGameMode();
```

**推荐组合使用**:
```typescript
// 优先使用传递的数据，失败时使用存储的数据
this.currentGameMode = transitionData.gameMode
    || this.userManager.getSelectedGameMode()
    || '';
```

---

## 📋 跳转顺序

### 完整流程
```
1. Login (用户登录)
   ↓
2. Hall (选择游戏：The Decree 或 Guandan)
   ↓ (传递 gameMode, minPlayers, maxPlayers)
3. Lobby (查看该游戏的房间列表)
   ↓ (创建/加入房间，传递 roomId, gameMode)
4. Game (进入游戏)
```

### 数据流
```
Hall:
  - 点击游戏按钮
  - userManager.setSelectedGameMode('the_decree')
  - sceneManager.goToLobby({ gameMode: 'the_decree', ... })

Lobby:
  - 读取 gameMode（从 transition data 或 userManager）
  - 过滤显示该游戏的房间
  - 创建/加入房间
  - sceneManager.goToGame({ roomId, gameMode })

Game:
  - 读取 roomId 和 gameMode
  - 初始化游戏实例
```

---

## 🎨 接下来需要做的 UI 工作

### Hall Scene
在 Cocos Creator 中创建：

1. **场景**: `Hall.scene`
2. **节点结构**:
   ```
   Canvas
   ├── Background
   ├── WelcomeLabel
   ├── TheDecreeButton
   │   ├── Label (The Decree)
   │   └── SubLabel (2-4 players)
   ├── GuandanButton
   │   ├── Label (Guandan)
   │   └── SubLabel (5 players)
   └── LogoutButton
   ```

3. **绑定组件**:
   - 在 Canvas 上添加 `HallScene` 组件
   - 拖拽各个节点到对应的 `@property` 属性

### Lobby Scene
在 Cocos Creator 中创建：

1. **场景**: `Lobby.scene`
2. **节点结构**:
   ```
   Canvas
   ├── Background
   ├── Header
   │   ├── GameModeLabel
   │   ├── BackButton
   │   └── RefreshButton
   ├── RoomListScrollView
   │   └── Content
   ├── CreateRoomButton
   └── EmptyLabel
   ```

3. **创建 Prefab**: `RoomItem.prefab`
   ```
   RoomItem
   ├── RoomNameLabel
   ├── PlayerCountLabel
   ├── HostLabel
   └── JoinButton
   ```

---

## 📦 文件清单

### 新增文件
- ✅ `UI/Scenes/HallScene.ts` - 游戏大厅场景控制器
- ✅ `UI/Scenes/LobbyScene.ts` - 房间列表场景控制器
- ✅ `SCENE_FLOW_DESIGN.md` - 完整的场景流程设计文档

### 修改文件
- ✅ `Manager/UserManager.ts` - 新增游戏模式选择功能
- ✅ `Manager/SceneManager.ts` - 更新场景枚举和导航方法
- ✅ `UI/Scenes/LoginScene.ts` - 更新登录后跳转到 Hall

---

## 🚀 使用示例

### 在 Hall 中选择游戏
```typescript
// HallScene.ts
private onTheDecreeClicked(): void {
    console.log('[HallScene] The Decree selected');
    this.selectGameMode('the_decree');
}

private selectGameMode(gameModeId: string): void {
    // 保存到 UserManager（备用）
    this.userManager.setSelectedGameMode(gameModeId);

    // 跳转到 Lobby 并传递数据（主要方式）
    this.sceneManager.goToLobby({
        gameMode: gameModeId,
        minPlayers: 2,
        maxPlayers: 4
    });
}
```

### 在 Lobby 中读取游戏模式
```typescript
// LobbyScene.ts
onLoad() {
    // 方法 1: 从传递的数据获取（优先）
    const transitionData = this.sceneManager.getTransitionData();

    // 方法 2: 从 UserManager 获取（备选）
    this.currentGameMode = transitionData.gameMode
        || this.userManager.getSelectedGameMode()
        || '';

    // 验证
    if (!this.currentGameMode) {
        this.sceneManager.goToHall();
        return;
    }

    // 过滤房间
    const rooms = this.roomManager.getAvailableRooms()
        .filter(room => room.gameMode === this.currentGameMode);
}
```

---

## ✨ 设计亮点

1. **双重数据保障**: SceneManager 传递 + UserManager 存储
2. **类型安全**: 使用 TypeScript 泛型定义传递数据类型
3. **容错处理**: 每个场景都验证数据完整性
4. **清晰的职责分离**: Hall 选游戏，Lobby 管房间，Game 玩游戏
5. **一致的导航**: 统一的 `goBack()` 方法

---

完成时间：2025-12-14
状态：✅ 代码实现完成，等待 UI 搭建
