# LocalGameStore 托管功能实现完成 ✅

## 已完成的修改

### 1. 扩展 PlayerGameData 接口

在 [LocalGameStore.ts:10-20](poker_arena_client/assets/Scripts/LocalStore/LocalGameStore.ts#L10-L20) 中添加了托管相关字段：

```typescript
export interface PlayerGameData {
    // ... 现有字段
    isAuto: boolean;           // 是否托管中
    autoReason?: 'manual' | 'timeout' | 'disconnect'; // 托管原因
}
```

### 2. 初始化托管字段

在 `initializePlayers()` 方法中初始化托管状态：

```typescript
this.players.set(playerId, {
    // ... 现有字段
    isAuto: false,
    autoReason: undefined
});
```

### 3. 添加托管状态管理方法

在 [LocalGameStore.ts:307-361](poker_arena_client/assets/Scripts/LocalStore/LocalGameStore.ts#L307-L361) 中添加了以下方法：

#### `setPlayerAuto(playerId, isAuto, reason?)`
设置玩家托管状态，并触发 `PLAYER_AUTO_CHANGED` 事件通知UI更新。

```typescript
public setPlayerAuto(playerId: string, isAuto: boolean, reason?: 'manual' | 'timeout' | 'disconnect'): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isAuto = isAuto;
    player.autoReason = reason;

    // 触发事件通知UI更新
    EventCenter.emit(EventType.PLAYER_AUTO_CHANGED, {
        playerId,
        isAuto,
        reason
    });
}
```

#### `isPlayerAuto(playerId)`
检查指定玩家是否托管中。

```typescript
public isPlayerAuto(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player ? player.isAuto : false;
}
```

#### `isMyAuto()`
检查当前玩家是否托管中（便捷方法）。

```typescript
public isMyAuto(): boolean {
    return this.isPlayerAuto(this.myPlayerId);
}
```

#### `getPlayerAutoReason(playerId)`
获取玩家托管原因。

```typescript
public getPlayerAutoReason(playerId: string): 'manual' | 'timeout' | 'disconnect' | undefined {
    const player = this.players.get(playerId);
    return player ? player.autoReason : undefined;
}
```

---

## 使用示例

### 设置托管状态

```typescript
// 设置玩家托管（手动）
LocalGameStore.getInstance().setPlayerAuto('player123', true, 'manual');

// 设置玩家托管（超时）
LocalGameStore.getInstance().setPlayerAuto('player123', true, 'timeout');

// 取消托管
LocalGameStore.getInstance().setPlayerAuto('player123', false);
```

### 查询托管状态

```typescript
// 检查玩家是否托管
const isAuto = LocalGameStore.getInstance().isPlayerAuto('player123');

// 检查自己是否托管
const isMyAuto = LocalGameStore.getInstance().isMyAuto();

// 获取托管原因
const reason = LocalGameStore.getInstance().getPlayerAutoReason('player123');
```

### 监听托管状态变化

```typescript
// 在组件中监听托管状态变化
EventCenter.on(EventType.PLAYER_AUTO_CHANGED, (event) => {
    console.log(`Player ${event.playerId} auto: ${event.isAuto} (${event.reason})`);

    // 更新UI
    if (event.playerId === LocalGameStore.getInstance().getMyPlayerId()) {
        // 更新自己的托管按钮
        this.updateAutoButton(event.isAuto);
    } else {
        // 更新其他玩家的托管标识
        this.updatePlayerAutoIndicator(event.playerId, event.isAuto);
    }
}, this);
```

---

## 数据流

```
服务端 TheDecreeMode.setPlayerAuto()
    ↓
GameRoom.onPlayerAutoChanged 回调
    ↓
广播 PLAYER_AUTO_CHANGED 事件
    ↓
NetworkClient 接收
    ↓
TheDecreeModeClient.onPlayerAutoChanged()
    ↓
LocalGameStore.setPlayerAuto()
    ↓
EventCenter.emit(PLAYER_AUTO_CHANGED)
    ↓
UI 组件监听并更新显示
```

---

## 下一步

现在需要：

1. ✅ **LocalGameStore 托管状态** - 已完成
2. ⏳ **EventCenter 事件类型** - 需要添加 `PLAYER_AUTO_CHANGED` 事件
3. ⏳ **TheDecreeModeClient 托管逻辑** - 需要处理网络消息和调用 LocalGameStore

继续查看 [AUTOPLAY_IMPLEMENTATION_GUIDE.md](AUTOPLAY_IMPLEMENTATION_GUIDE.md) 完成剩余步骤。
