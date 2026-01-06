# 摊牌显示自动清除功能

## 功能说明

实现了摊牌后自动清除其他玩家出牌显示的功能，避免牌面一直显示到下次出牌。

## 清除时机

满足以下**任一条件**即会清除摊牌显示：

1. **定时自动清除**：摊牌后 3 秒自动清除
2. **下次 Dealer Call 时清除**：新回合开始，庄家叫牌时清除

## 实现细节

### 1. 添加定时器管理

```typescript
// TheDecreeModeClient.ts
private showdownClearTimer: number | null = null;
```

### 2. 摊牌时设置定时器

```typescript
private onShowdown(data: ShowdownEvent): void {
    // ... 显示摊牌结果 ...

    // 设置定时器，3秒后自动清除摊牌显示
    this.clearShowdownTimer(); // 先清除之前的定时器
    this.showdownClearTimer = window.setTimeout(() => {
        console.log('[TheDecreeModeClient] Auto-clearing showdown display after 3 seconds');
        this.clearShowdownDisplay();
    }, 3000);
}
```

### 3. Dealer Call 时清除

```typescript
private onDealerCalled(data: DealerCalledEvent): void {
    // 清除上一回合的摊牌显示
    this.clearShowdownDisplay();

    // ... 其他逻辑 ...
}
```

### 4. 清除摊牌显示方法

```typescript
/**
 * 清除摊牌显示
 * 将所有玩家的出牌显示恢复为手牌背面
 */
private clearShowdownDisplay(): void {
    console.log('[TheDecreeModeClient] Clearing showdown display...');

    // 清除定时器
    this.clearShowdownTimer();

    const playerUIManager = this.game.playerUIManager;
    if (!playerUIManager) {
        console.warn('[TheDecreeModeClient] PlayerUIManager not found');
        return;
    }

    // 获取玩家数量
    const playerCount = playerUIManager.getPlayerCount();

    // 遍历所有玩家（除了主玩家 index 0）
    for (let i = 1; i < playerCount; i++) {
        const playerUINode = playerUIManager.getPlayerUINode(i);
        if (playerUINode) {
            const handDisplay = playerUINode.getHandDisplay();
            if (handDisplay) {
                // 清除出牌显示，恢复为手牌背面
                handDisplay.updateDisplay([]);
                console.log(`[TheDecreeModeClient] Cleared showdown display for player at index ${i}`);
            }
        }
    }

    console.log('[TheDecreeModeClient] ✓ Showdown display cleared for all players');
}
```

### 5. 清除定时器方法

```typescript
/**
 * 清除摊牌显示定时器
 */
private clearShowdownTimer(): void {
    if (this.showdownClearTimer !== null) {
        window.clearTimeout(this.showdownClearTimer);
        this.showdownClearTimer = null;
        console.log('[TheDecreeModeClient] Showdown clear timer cancelled');
    }
}
```

### 6. 生命周期管理

在组件退出和清理时，确保清除定时器：

```typescript
public onExit(): void {
    // 清除摊牌显示定时器
    this.clearShowdownTimer();
    // ... 其他清理 ...
}

public cleanup(): void {
    this.clearShowdownTimer();
    // ... 其他清理 ...
}
```

## 工作流程

```
摊牌 (Showdown)
    ↓
显示所有玩家的牌
    ↓
设置 3 秒定时器
    ↓
    ├─→ 3 秒后自动清除 ✓
    │
    └─→ 或者下次 Dealer Call 时清除 ✓
            ↓
        清除定时器
            ↓
        恢复手牌背面显示
```

## 特性

### ✅ 双重保障
- 定时器确保最多 3 秒后清除
- Dealer Call 确保新回合开始时清除
- 两个条件满足任一即可

### ✅ 防止重复
- 每次设置新定时器前，先清除旧定时器
- 避免多个定时器同时存在

### ✅ 资源管理
- 组件退出时清除定时器
- 避免内存泄漏

### ✅ 只清除其他玩家
- 主玩家（index 0）的牌不清除
- 只清除其他玩家的出牌显示

## 调试日志

功能包含详细的日志输出：

```
[TheDecreeModeClient] Auto-clearing showdown display after 3 seconds
[TheDecreeModeClient] Clearing showdown display...
[TheDecreeModeClient] Cleared showdown display for player at index 1
[TheDecreeModeClient] Cleared showdown display for player at index 2
[TheDecreeModeClient] Cleared showdown display for player at index 3
[TheDecreeModeClient] ✓ Showdown display cleared for all players
```

## 测试建议

1. **测试定时清除**
   - 摊牌后等待 3 秒
   - 验证其他玩家的牌自动消失

2. **测试 Dealer Call 清除**
   - 摊牌后立即进入下一回合
   - 验证 Dealer Call 时牌立即消失

3. **测试定时器取消**
   - 摊牌后 2 秒内进入下一回合
   - 验证定时器被正确取消，不会重复清除

4. **测试组件清理**
   - 摊牌后立即退出游戏
   - 验证定时器被正确清除，无内存泄漏

## 注意事项

1. **主玩家不清除**
   - 主玩家（index 0）的牌保持显示
   - 只清除其他玩家的出牌显示

2. **定时器管理**
   - 使用 `window.setTimeout` 和 `window.clearTimeout`
   - 确保在组件生命周期结束时清除

3. **HandDisplay.updateDisplay([])**
   - 传入空数组表示清除出牌显示
   - 会恢复为手牌背面显示

## 相关文件

- [TheDecreeModeClient.ts](poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeModeClient.ts) - 主要实现
- [PlayerHandDisplay.ts](poker_arena_client/assets/Scripts/UI/PlayerHandDisplay.ts) - 手牌显示组件
