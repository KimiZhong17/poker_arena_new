# 玩家托管功能实现指南

## 已完成的服务端实现 ✅

### 1. 数据结构和状态
- ✅ [TheDecreePlayer](poker_arena_server/src/game/Player.ts:87-111) 添加托管字段
  - `isAuto: boolean` - 是否托管中
  - `autoStartTime: number` - 托管开始时间
  - `lastActionTime: number` - 最后操作时间

### 2. 托管策略
- ✅ [AutoPlayStrategy.ts](poker_arena_server/src/game/the_decree/AutoPlayStrategy.ts) 创建托管策略接口和实现
  - `AutoPlayStrategy` 接口
  - `ConservativeStrategy` 保守策略（出最小的牌）
  - `AggressiveStrategy` 激进策略（出最大的牌）
  - `RandomStrategy` 随机策略

### 3. 游戏逻辑
- ✅ [TheDecreeMode.ts](poker_arena_server/src/game/the_decree/TheDecreeMode.ts:740-898) 添加托管逻辑
  - `setPlayerAuto()` - 设置玩家托管状态
  - `isPlayerTurn()` - 检查是否轮到该玩家
  - `scheduleAutoAction()` - 调度托管操作
  - `executeAutoAction()` - 执行托管操作
  - `updatePlayerActionTime()` - 更新最后操作时间
  - `checkAutoPlayTimeouts()` - 检查超时自动托管

### 4. 消息协议
- ✅ [Messages.ts](poker_arena_server/src/types/Messages.ts) 添加托管消息类型
  - `ClientMessageType.SET_AUTO` - 客户端设置托管请求
  - `ServerMessageType.PLAYER_AUTO_CHANGED` - 服务端托管状态变化事件
  - `SetAutoRequest` 接口
  - `PlayerAutoChangedEvent` 接口

### 5. 房间管理
- ✅ [GameRoom.ts](poker_arena_server/src/core/GameRoom.ts:514-535) 处理托管请求
  - `handleSetAuto()` - 处理设置托管请求
  - `onPlayerAutoChanged` 回调 - 广播托管状态变化

### 6. 服务器处理
- ✅ [GameServer.ts](poker_arena_server/src/core/GameServer.ts:99-102,452-472) 添加托管消息处理
  - 监听 `SET_AUTO` 消息
  - `handleSetAuto()` 方法

### 7. 配置
- ✅ [ServerConfig.ts](poker_arena_server/src/config/ServerConfig.ts:20-22) 添加托管配置
  - `AUTO_PLAY_TIMEOUT: 30000` - 30秒无操作自动托管
  - `AUTO_PLAY_ACTION_DELAY: 2000` - 托管操作延迟2秒

---

## 待完成的客户端实现 📋

### 1. 扩展 LocalGameStore 添加托管状态

**文件**: `poker_arena_client/assets/Scripts/LocalStore/LocalGameStore.ts`

**需要添加的内容**:

```typescript
// 在 PlayerGameData 接口中添加
export interface PlayerGameData {
    // ... 现有字段
    isAuto: boolean;              // 是否托管中
    autoReason?: 'manual' | 'timeout' | 'disconnect'; // 托管原因
}

// 在 LocalGameStore 类中添加方法
export class LocalGameStore {
    /**
     * 设置玩家托管状态
     */
    public setPlayerAuto(playerId: string, isAuto: boolean, reason?: string): void {
        const player = this.players.get(playerId);
        if (!player) return;

        player.isAuto = isAuto;
        player.autoReason = reason as any;

        EventCenter.emit(EventType.PLAYER_AUTO_CHANGED, {
            playerId,
            isAuto,
            reason
        });
    }

    /**
     * 获取玩家托管状态
     */
    public isPlayerAuto(playerId: string): boolean {
        return this.players.get(playerId)?.isAuto ?? false;
    }

    /**
     * 获取我的托管状态
     */
    public isMyAuto(): boolean {
        return this.isPlayerAuto(this.myPlayerId);
    }
}
```

---

### 2. 添加托管事件类型到 EventCenter

**文件**: `poker_arena_client/assets/Scripts/Core/EventCenter.ts`

**需要添加的内容**:

```typescript
export enum EventType {
    // ... 现有事件类型

    // 托管相关
    PLAYER_AUTO_CHANGED = 'player_auto_changed',
}
```

---

### 3. 扩展 TheDecreeModeClient 处理托管逻辑

**文件**: `poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeModeClient.ts`

**需要添加的内容**:

```typescript
import { ClientMessageType, ServerMessageType, PlayerAutoChangedEvent, SetAutoRequest } from '../../Network/Messages';

export class TheDecreeModeClient extends GameModeClient {

    public onEnter(): void {
        super.onEnter();

        // ... 现有监听

        // 监听托管状态变化
        NetworkClient.getInstance().on(
            ServerMessageType.PLAYER_AUTO_CHANGED,
            this.onPlayerAutoChanged.bind(this)
        );
    }

    public onExit(): void {
        // 移除托管监听
        NetworkClient.getInstance().off(
            ServerMessageType.PLAYER_AUTO_CHANGED,
            this.onPlayerAutoChanged.bind(this)
        );

        super.onExit();
    }

    /**
     * 处理托管状态变化
     */
    private onPlayerAutoChanged(data: PlayerAutoChangedEvent): void {
        console.log(`[TheDecreeModeClient] Player ${data.playerId} auto changed: ${data.isAuto} (${data.reason})`);

        LocalGameStore.getInstance().setPlayerAuto(
            data.playerId,
            data.isAuto,
            data.reason
        );
    }

    /**
     * 切换托管状态
     */
    public toggleAuto(): void {
        const myId = LocalGameStore.getInstance().getMyPlayerId();
        const isAuto = LocalGameStore.getInstance().isPlayerAuto(myId);

        const request: SetAutoRequest = {
            isAuto: !isAuto
        };

        NetworkClient.getInstance().emit(ClientMessageType.SET_AUTO, request);

        console.log(`[TheDecreeModeClient] Toggle auto mode: ${!isAuto}`);
    }

    /**
     * 设置托管状态
     */
    public setAuto(isAuto: boolean): void {
        const request: SetAutoRequest = {
            isAuto
        };

        NetworkClient.getInstance().emit(ClientMessageType.SET_AUTO, request);

        console.log(`[TheDecreeModeClient] Set auto mode: ${isAuto}`);
    }
}
```

---

### 4. 创建托管 UI 组件（可选）

**文件**: `poker_arena_client/assets/Scripts/UI/AutoPlayButton.ts` (新建)

**建议实现**:

```typescript
const { ccclass, property } = cc._decorator;

@ccclass
export default class AutoPlayButton extends cc.Component {
    @property(cc.Label)
    label: cc.Label = null;

    @property(cc.Node)
    indicator: cc.Node = null; // 托管指示器

    private isAuto: boolean = false;

    onLoad() {
        // 监听托管状态变化
        EventCenter.on(EventType.PLAYER_AUTO_CHANGED, this.onAutoChanged, this);

        // 点击事件
        this.node.on('click', this.onButtonClick, this);

        this.updateUI();
    }

    onDestroy() {
        EventCenter.off(EventType.PLAYER_AUTO_CHANGED, this.onAutoChanged, this);
        this.node.off('click', this.onButtonClick, this);
    }

    private onButtonClick(): void {
        TheDecreeModeClient.getInstance().toggleAuto();
    }

    private onAutoChanged(event: any): void {
        const myId = LocalGameStore.getInstance().getMyPlayerId();
        if (event.playerId === myId) {
            this.isAuto = event.isAuto;
            this.updateUI();

            // 显示提示
            if (this.isAuto) {
                this.showTip(event.reason);
            }
        }
    }

    private updateUI(): void {
        if (this.label) {
            this.label.string = this.isAuto ? '取消托管' : '托管';
        }

        if (this.indicator) {
            this.indicator.active = this.isAuto;
        }

        // 改变按钮颜色
        this.node.color = this.isAuto ? cc.Color.YELLOW : cc.Color.WHITE;
    }

    private showTip(reason?: string): void {
        let tip = '已开启托管';
        if (reason === 'timeout') {
            tip = '超时未操作，已自动托管';
        } else if (reason === 'disconnect') {
            tip = '断线重连，已自动托管';
        }

        // TODO: 显示提示UI
        console.log(tip);
    }
}
```

---

### 5. 在玩家头像上显示托管标识（可选）

**文件**: `poker_arena_client/assets/Scripts/UI/PlayerAvatar.ts` (修改现有文件)

**建议添加**:

```typescript
@ccclass
export default class PlayerAvatar extends cc.Component {
    @property(cc.Node)
    autoIndicator: cc.Node = null; // 托管标识节点

    private playerId: string = '';

    onLoad() {
        // 监听托管状态变化
        EventCenter.on(EventType.PLAYER_AUTO_CHANGED, this.onAutoChanged, this);
    }

    onDestroy() {
        EventCenter.off(EventType.PLAYER_AUTO_CHANGED, this.onAutoChanged, this);
    }

    public setPlayerId(playerId: string): void {
        this.playerId = playerId;
        this.updateAutoIndicator();
    }

    private onAutoChanged(event: any): void {
        if (event.playerId === this.playerId) {
            this.updateAutoIndicator();
        }
    }

    private updateAutoIndicator(): void {
        if (!this.autoIndicator) return;

        const isAuto = LocalGameStore.getInstance().isPlayerAuto(this.playerId);
        this.autoIndicator.active = isAuto;
    }
}
```

---

## 测试步骤

### 1. 服务端测试
```bash
cd poker_arena_server
npm run dev
```

### 2. 客户端测试
1. 启动 Cocos Creator
2. 打开项目
3. 运行游戏
4. 测试场景：
   - 手动开启/关闭托管
   - 30秒不操作自动托管
   - 托管状态下自动出牌
   - 多个玩家同时托管

### 3. 测试用例

#### 测试用例 1: 手动托管
1. 进入游戏
2. 点击"托管"按钮
3. 验证：
   - 按钮文字变为"取消托管"
   - 玩家头像显示托管标识
   - 轮到自己时自动出牌

#### 测试用例 2: 超时托管
1. 进入游戏
2. 轮到自己时不操作
3. 等待30秒
4. 验证：
   - 自动进入托管模式
   - 显示"超时未操作，已自动托管"提示
   - 自动出牌

#### 测试用例 3: 取消托管
1. 开启托管
2. 点击"取消托管"按钮
3. 验证：
   - 托管状态取消
   - 按钮文字变为"托管"
   - 托管标识消失

---

## 注意事项

1. **线程安全**: 服务端的托管定时器需要正确清理，避免内存泄漏
2. **网络延迟**: 托管操作有2秒延迟，模拟真实玩家思考
3. **状态同步**: 确保所有客户端都能收到托管状态变化通知
4. **UI反馈**: 托管状态变化时要有明显的视觉反馈
5. **断线重连**: 玩家断线后重连，需要恢复托管状态（可选功能）

---

## 扩展功能（可选）

### 1. 多种托管策略选择
允许玩家选择不同的托管策略（保守/激进/随机）

### 2. 托管历史记录
记录玩家的托管次数和时长

### 3. 托管提醒
在即将超时前提醒玩家

### 4. 托管统计
显示托管期间的胜率和得分

---

## 相关文件清单

### 服务端
- [poker_arena_server/src/game/Player.ts](poker_arena_server/src/game/Player.ts)
- [poker_arena_server/src/game/the_decree/AutoPlayStrategy.ts](poker_arena_server/src/game/the_decree/AutoPlayStrategy.ts)
- [poker_arena_server/src/game/the_decree/TheDecreeMode.ts](poker_arena_server/src/game/the_decree/TheDecreeMode.ts)
- [poker_arena_server/src/core/GameRoom.ts](poker_arena_server/src/core/GameRoom.ts)
- [poker_arena_server/src/core/GameServer.ts](poker_arena_server/src/core/GameServer.ts)
- [poker_arena_server/src/types/Messages.ts](poker_arena_server/src/types/Messages.ts)
- [poker_arena_server/src/config/ServerConfig.ts](poker_arena_server/src/config/ServerConfig.ts)

### 客户端
- [poker_arena_client/assets/Scripts/Network/Messages.ts](poker_arena_client/assets/Scripts/Network/Messages.ts) ✅
- poker_arena_client/assets/Scripts/LocalStore/LocalGameStore.ts (待修改)
- poker_arena_client/assets/Scripts/Core/EventCenter.ts (待修改)
- poker_arena_client/assets/Scripts/Core/GameMode/TheDecreeModeClient.ts (待修改)
- poker_arena_client/assets/Scripts/UI/AutoPlayButton.ts (待创建)
- poker_arena_client/assets/Scripts/UI/PlayerAvatar.ts (待修改)

---

## 总结

服务端的托管功能已经完全实现，包括：
- ✅ 托管策略系统（保守/激进/随机）
- ✅ 自动操作逻辑（选牌/叫牌/出牌）
- ✅ 超时检测机制
- ✅ 网络消息协议
- ✅ 房间和服务器处理

客户端还需要完成：
- 📋 LocalGameStore 托管状态管理
- 📋 EventCenter 事件类型
- 📋 TheDecreeModeClient 托管逻辑
- 📋 UI 组件（托管按钮、托管标识）

按照本指南完成客户端实现后，玩家托管功能即可正常使用。
