# 游戏场景流程设计文档

## 🎯 完整流程

```
Login → Hall → Lobby → Game
  ↓       ↓       ↓
  └───────┴───────┘
     (返回按钮)
```

## 📋 各场景职责

### 1. Login Scene（登录场景）
**文件**: `UI/Scenes/LoginScene.ts`

**功能**:
- 用户登录（用户名 + 密码）
- 游客登录
- 自动检查是否已登录

**跳转**:
- 登录成功 → `Hall`

---

### 2. Hall Scene（游戏大厅）
**文件**: `UI/Scenes/HallScene.ts`

**功能**:
- 显示所有可用的游戏模式
- 当前有两个按钮：
  - **The Decree** (2-4 人)
  - **Guandan (掼蛋)** (5 人)
- 显示欢迎信息
- 退出登录功能

**重要方法**:
```typescript
// 选择游戏模式
selectGameMode(gameModeId: string): void

// 获取游戏模式信息
getGameModeInfo(gameModeId: string): GameModeInfo
getAvailableGameModes(): GameModeInfo[]
```

**数据流**:
1. 用户点击游戏模式按钮
2. 调用 `UserManager.setSelectedGameMode(gameModeId)` 保存选择
3. 跳转到 Lobby，传递游戏模式信息：
   ```typescript
   sceneManager.goToLobby({
       gameMode: 'the_decree',
       minPlayers: 2,
       maxPlayers: 4
   })
   ```

**跳转**:
- 点击游戏模式 → `Lobby`（带游戏模式参数）
- 返回/退出 → `Login`

---

### 3. Lobby Scene（房间列表）
**文件**: `UI/Scenes/LobbyScene.ts`

**功能**:
- 显示当前游戏模式的房间列表
- 创建房间
- 加入房间
- 刷新房间列表
- 返回游戏大厅

**数据来源**:
```typescript
// 从 SceneManager 获取传递的数据
const transitionData = this.sceneManager.getTransitionData<{
    gameMode: string;
    minPlayers?: number;
    maxPlayers?: number;
}>();

// 备选：从 UserManager 获取之前选择的游戏模式
const gameMode = this.userManager.getSelectedGameMode();
```

**房间管理**:
```typescript
// 创建房间
const room = roomManager.createRoom({
    gameMode: 'the_decree',
    maxPlayers: 4,
    roomName: "玩家的房间",
    isPublic: true
});

// 加入房间
roomManager.joinRoom(roomId, playerId, playerName);

// 获取房间列表（过滤当前游戏模式）
const rooms = roomManager.getAvailableRooms()
    .filter(room => room.gameMode === currentGameMode);
```

**跳转**:
- 创建/加入房间 → `Game`（带房间 ID 和游戏模式）
- 返回 → `Hall`

---

### 4. Game Scene（游戏场景）
**文件**: `UI/Scenes/GameScene.ts`（待实现）

**功能**:
- 显示游戏界面（根据游戏模式不同而不同）
- The Decree：
  - 4 张公共牌
  - 玩家手牌
  - 庄家标识
  - 出牌选择
  - 分数面板
- Guandan：
  - 掼蛋专用界面

**数据来源**:
```typescript
const transitionData = this.sceneManager.getTransitionData<{
    roomId: string;
    gameMode: string;
}>();

// 获取房间信息
const room = roomManager.getRoomById(roomId);

// 创建游戏实例
const factory = GameModeFactory.getInstance();
const game = factory.createGameMode(gameMode);
```

**跳转**:
- 返回 → `Lobby`

---

## 🔄 数据传递机制

### 方案 1：SceneManager 传递数据（推荐）
**优点**: 清晰、类型安全、临时性

```typescript
// Hall → Lobby
sceneManager.goToLobby({
    gameMode: 'the_decree',
    minPlayers: 2,
    maxPlayers: 4
});

// Lobby 中接收
const data = sceneManager.getTransitionData<{
    gameMode: string;
    minPlayers?: number;
    maxPlayers?: number;
}>();
```

### 方案 2：UserManager 存储状态（备选）
**优点**: 跨场景持久化、容错性强

```typescript
// Hall 中保存
userManager.setSelectedGameMode('the_decree');

// Lobby 中读取（作为备选方案）
const gameMode = userManager.getSelectedGameMode();
```

### 推荐组合方案
```typescript
// Lobby Scene 中的实现
const transitionData = this.sceneManager.getTransitionData();
this.currentGameMode = transitionData.gameMode
    || this.userManager.getSelectedGameMode()  // 备选
    || '';  // 默认值

if (!this.currentGameMode) {
    // 没有游戏模式，返回 Hall
    this.sceneManager.goToHall();
    return;
}
```

---

## 📦 Manager 接口总览

### UserManager
```typescript
// 登录状态
isUserLoggedIn(): boolean
getCurrentUser(): UserData | null
getUsername(): string
login(username, password): Promise<boolean>
loginAsGuest(): Promise<boolean>
logout(): void

// 游戏模式选择（新增）
setSelectedGameMode(gameModeId: string): void
getSelectedGameMode(): string | null
clearSelectedGameMode(): void
```

### SceneManager
```typescript
// 场景跳转
goToLogin(): void
goToHall(): void
goToLobby(data: { gameMode, minPlayers?, maxPlayers? }): void
goToGame(data: { roomId, gameMode }): void
goBack(): void

// 数据传递
getTransitionData<T>(): T
clearTransitionData(): void
```

### RoomManager
```typescript
// 房间管理
createRoom(config: {
    gameMode: string,
    maxPlayers: number,
    roomName: string,
    isPublic: boolean,
    password?: string
}): RoomData

joinRoom(roomId: string, playerId: string, playerName: string): boolean
leaveRoom(roomId: string, playerId: string): void

// 查询
getRoomById(roomId: string): RoomData | undefined
getAvailableRooms(): RoomData[]
```

### GameModeFactory
```typescript
// 游戏模式创建
createGameMode(modeId: string): GameModeBase
hasMode(modeId: string): boolean
getRegisteredModeIds(): string[]
```

---

## 🎨 UI 实现建议

### Hall Scene UI 结构
```
HallScene
├── Background
├── WelcomeLabel (显示 "Welcome, [username]!")
├── GameModeContainer
│   ├── TheDecreeButton
│   │   ├── TitleLabel ("The Decree")
│   │   ├── DescriptionLabel ("2-4 players")
│   │   └── Icon
│   └── GuandanButton
│       ├── TitleLabel ("Guandan")
│       ├── DescriptionLabel ("5 players")
│       └── Icon
└── LogoutButton
```

### Lobby Scene UI 结构
```
LobbyScene
├── Background
├── Header
│   ├── GameModeLabel ("The Decree - Room List")
│   ├── BackButton
│   └── RefreshButton
├── RoomListScrollView
│   └── RoomListContent
│       ├── RoomItem 1
│       ├── RoomItem 2
│       └── ...
├── CreateRoomButton
└── EmptyLabel (无房间时显示)
```

### RoomItem Prefab 结构
```
RoomItem
├── RoomNameLabel
├── PlayerCountLabel ("2/4")
├── HostLabel ("Host: PlayerName")
├── StatusLabel ("Waiting" / "Full")
└── JoinButton
```

---

## ⚡ 关键实现细节

### 1. 游戏模式信息定义
```typescript
interface GameModeInfo {
    id: string;           // 'the_decree', 'guandan'
    displayName: string;  // 'The Decree', 'Guandan (掼蛋)'
    description: string;
    minPlayers: number;
    maxPlayers: number;
}
```

### 2. 错误处理
```typescript
// 检查登录状态
if (!this.userManager.isUserLoggedIn()) {
    console.warn('[Scene] User not logged in');
    this.sceneManager.goToLogin();
    return;
}

// 检查游戏模式是否有效
const factory = GameModeFactory.getInstance();
if (!factory.hasMode(gameModeId)) {
    console.error(`[Scene] Invalid game mode: ${gameModeId}`);
    this.sceneManager.goToHall();
    return;
}
```

### 3. 房间过滤
```typescript
// 只显示当前游戏模式的房间
const rooms = this.roomManager.getAvailableRooms()
    .filter(room => room.gameMode === this.currentGameMode);
```

---

## 🚀 下一步实现

### 优先级 1：基础 UI
- [ ] 创建 Hall.scene，绑定 HallScene.ts
- [ ] 创建两个游戏模式按钮
- [ ] 创建 Lobby.scene，绑定 LobbyScene.ts
- [ ] 创建房间列表 UI
- [ ] 创建 RoomItem Prefab

### 优先级 2：游戏场景
- [ ] 创建 The Decree 游戏界面
- [ ] 创建 Guandan 游戏界面
- [ ] 实现游戏逻辑绑定

### 优先级 3：增强功能
- [ ] 房间密码保护
- [ ] 房间设置（自定义规则）
- [ ] 快速加入功能
- [ ] 房间搜索/过滤

---

## 📝 代码示例

### Hall Scene 按钮点击
```typescript
// HallScene.ts
private onTheDecreeClicked(): void {
    this.selectGameMode('the_decree');
}

private selectGameMode(gameModeId: string): void {
    const modeInfo = this.gameModes.find(m => m.id === gameModeId);

    // 保存选择
    this.userManager.setSelectedGameMode(gameModeId);

    // 跳转到 Lobby
    this.sceneManager.goToLobby({
        gameMode: gameModeId,
        minPlayers: modeInfo.minPlayers,
        maxPlayers: modeInfo.maxPlayers
    });
}
```

### Lobby Scene 房间创建
```typescript
// LobbyScene.ts
private onCreateRoomClicked(): void {
    const user = this.userManager.getCurrentUser();

    const room = this.roomManager.createRoom({
        gameMode: this.currentGameMode,
        maxPlayers: this.maxPlayers,
        roomName: `${user.username}'s Room`,
        isPublic: true
    });

    this.roomManager.joinRoom(room.id, user.id, user.username);

    this.sceneManager.goToGame({
        roomId: room.id,
        gameMode: this.currentGameMode
    });
}
```

---

**文档更新**: 2025-12-14
**状态**: ✅ 架构设计完成，代码已实现
