# PlayerUIManager 重构方案

## 目标
将当前的扁平数组结构重构为层次化的 PlayerUINode 组件架构，提高代码可维护性和清晰度。

## 当前架构问题

### 1. 扁平数组结构
```typescript
// PlayerUIManager.ts - 当前结构
private _handDisplays: PlayerHandDisplay[] = [];
private _playerInfoNodes: Node[] = [];
private _nameLabels: Label[] = [];
private _scoreLabels: Label[] = [];
private _avatarSprites: Sprite[] = [];
private _dealerIndicators: Node[] = [];
```

**问题：**
- 多个数组需要保持索引同步
- 难以追踪哪些UI属于哪个玩家
- 新增UI元素需要修改多处代码
- 容易出现索引越界错误

### 2. Player 数据与 UI 分离
- Player 对象（数据模型）在 GameMode 中管理
- UI 元素在 PlayerUIManager 中管理
- 需要手动同步数据和UI状态

### 3. PlayerInfo 仅作为数据结构
- 当前 PlayerInfo 只是接口定义
- 没有封装行为和UI逻辑

---

## 新架构设计

### 整体结构
```
Node_PlayerUI (PlayerUIManager)
├── Player0Node (PlayerUINode)
│   ├── HandContainer (手牌容器)
│   │   └── PlayerHandDisplay 组件
│   ├── InfoPanel (玩家信息面板)
│   │   ├── Avatar (Sprite)
│   │   ├── NameLabel (Label)
│   │   └── ScoreLabel (Label)
│   └── DealerIndicator (庄家标识)
├── Player1Node (PlayerUINode)
│   ├── HandContainer
│   ├── InfoPanel
│   └── DealerIndicator
├── Player2Node (PlayerUINode)
└── Player3Node (PlayerUINode)
```

---

## 组件设计

### 1. PlayerUINode 组件（新增）

**职责：**
- 封装单个玩家的所有UI元素
- 管理手牌显示、玩家信息、庄家标识
- 与 Player 数据模型绑定

**代码结构：**
```typescript
/**
 * PlayerUINode - 单个玩家的UI节点组件
 * 封装了一个玩家的所有UI元素和行为
 */
@ccclass('PlayerUINode')
export class PlayerUINode extends Component {
    // ===== 属性（可在编辑器配置）=====
    @property(Node)
    public handContainer: Node = null!;  // 手牌容器

    @property(Node)
    public infoPanel: Node = null!;  // 信息面板

    @property(Node)
    public dealerIndicator: Node = null!;  // 庄家标识

    // 信息面板子元素（自动查找）
    private nameLabel: Label = null!;
    private scoreLabel: Label = null!;
    private avatarSprite: Sprite = null!;

    // ===== 数据绑定 =====
    private _player: Player = null!;  // 绑定的 Player 数据
    private _handDisplay: PlayerHandDisplay = null!;  // 手牌显示组件
    private _playerIndex: number = 0;  // 玩家索引

    // ===== 初始化方法 =====
    /**
     * 初始化 PlayerUINode
     * @param player 玩家数据模型
     * @param playerIndex 玩家索引（0-4）
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级（Guandan用）
     */
    public init(
        player: Player,
        playerIndex: number,
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number
    ): void {
        this._player = player;
        this._playerIndex = playerIndex;

        // 自动查找子节点
        this.setupChildNodes();

        // 初始化手牌显示
        this.setupHandDisplay(pokerSprites, pokerPrefab, levelRank);

        // 初始化玩家信息
        this.updatePlayerInfo();
    }

    /**
     * 查找并设置子节点引用
     */
    private setupChildNodes(): void {
        // 如果属性未在编辑器配置，自动查找
        if (!this.handContainer) {
            this.handContainer = this.node.getChildByName("HandContainer") || this.createHandContainer();
        }

        if (!this.infoPanel) {
            this.infoPanel = this.node.getChildByName("InfoPanel") || this.createInfoPanel();
        }

        if (!this.dealerIndicator) {
            this.dealerIndicator = this.node.getChildByName("DealerIndicator");
        }

        // 查找信息面板子元素
        if (this.infoPanel) {
            this.nameLabel = this.infoPanel.getChildByName("NameLabel")?.getComponent(Label)!;
            this.scoreLabel = this.infoPanel.getChildByName("ScoreLabel")?.getComponent(Label)!;
            this.avatarSprite = this.infoPanel.getChildByName("Avatar")?.getComponent(Sprite)!;
        }
    }

    /**
     * 创建手牌容器（如果不存在）
     */
    private createHandContainer(): Node {
        const container = new Node("HandContainer");
        container.addComponent(UITransform);
        container.layer = this.node.layer;
        this.node.addChild(container);
        return container;
    }

    /**
     * 创建信息面板（如果不存在）
     */
    private createInfoPanel(): Node {
        const panel = new Node("InfoPanel");
        panel.addComponent(UITransform);
        panel.layer = this.node.layer;

        // 创建子元素
        const nameLabel = new Node("NameLabel");
        nameLabel.addComponent(Label);
        panel.addChild(nameLabel);

        const scoreLabel = new Node("ScoreLabel");
        scoreLabel.addComponent(Label);
        panel.addChild(scoreLabel);

        const avatar = new Node("Avatar");
        avatar.addComponent(Sprite);
        panel.addChild(avatar);

        this.node.addChild(panel);
        return panel;
    }

    /**
     * 初始化手牌显示组件
     */
    private setupHandDisplay(pokerSprites: Map<string, SpriteFrame>, pokerPrefab: Prefab, levelRank: number): void {
        const displayMode = (this._playerIndex === 0) ? HandDisplayMode.SPREAD : HandDisplayMode.STACK;

        this._handDisplay = this.handContainer.addComponent(PlayerHandDisplay);
        this._handDisplay.handContainer = this.handContainer;
        this._handDisplay.init(this._player, displayMode, pokerSprites, pokerPrefab, levelRank, this._playerIndex);
    }

    // ===== 玩家信息管理 =====
    /**
     * 更新玩家信息显示
     */
    public updatePlayerInfo(): void {
        if (this.nameLabel) {
            this.nameLabel.string = this._player.name;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${this._player.score || 0}`;
        }
    }

    /**
     * 设置玩家名称
     */
    public setPlayerName(name: string): void {
        this._player.name = name;
        if (this.nameLabel) {
            this.nameLabel.string = name;
        }
    }

    /**
     * 更新玩家分数
     */
    public updateScore(score: number): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${score}`;
        }
    }

    /**
     * 设置头像（如果需要）
     */
    public setAvatar(spriteFrame: SpriteFrame): void {
        if (this.avatarSprite) {
            this.avatarSprite.spriteFrame = spriteFrame;
        }
    }

    // ===== 手牌显示管理 =====
    /**
     * 更新手牌显示
     */
    public updateHandDisplay(playedCards: number[] = []): void {
        if (this._handDisplay) {
            this._handDisplay.updateDisplay(playedCards);
        }
    }

    /**
     * 启用卡牌选择（仅主玩家）
     */
    public enableCardSelection(callback: SelectionChangedCallback | null = null): void {
        if (this._handDisplay) {
            this._handDisplay.enableCardSelection(callback);
        }
    }

    /**
     * 禁用卡牌选择
     */
    public disableCardSelection(): void {
        if (this._handDisplay) {
            this._handDisplay.disableCardSelection();
        }
    }

    /**
     * 获取选中的卡牌索引
     */
    public getSelectedIndices(): number[] {
        return this._handDisplay ? this._handDisplay.getSelectedIndices() : [];
    }

    /**
     * 清除卡牌选择
     */
    public clearSelection(): void {
        if (this._handDisplay) {
            this._handDisplay.clearSelection();
        }
    }

    // ===== 庄家标识管理 =====
    /**
     * 显示庄家标识
     */
    public showDealerIndicator(): void {
        if (this.dealerIndicator) {
            this.dealerIndicator.active = true;
        }
    }

    /**
     * 隐藏庄家标识
     */
    public hideDealerIndicator(): void {
        if (this.dealerIndicator) {
            this.dealerIndicator.active = false;
        }
    }

    // ===== Getters =====
    public getPlayer(): Player {
        return this._player;
    }

    public getPlayerIndex(): number {
        return this._playerIndex;
    }

    public getHandDisplay(): PlayerHandDisplay | null {
        return this._handDisplay;
    }

    /**
     * 获取世界坐标位置（用于动画）
     */
    public getWorldPosition(): { x: number, y: number } {
        const worldPos = this.node.getWorldPosition();
        return { x: worldPos.x, y: worldPos.y };
    }
}
```

---

### 2. PlayerUIManager 重构

**职责变化：**
- 从管理多个数组 → 管理 PlayerUINode 数组
- 提供批量操作接口（更新所有玩家、显示庄家等）
- 负责创建和初始化 PlayerUINode

**代码结构：**
```typescript
/**
 * PlayerUIManager - 管理所有玩家的UI节点
 * 简化为管理 PlayerUINode 数组
 */
@ccclass('PlayerUIManager')
export class PlayerUIManager extends Component {
    // ===== 玩家UI节点数组（核心）=====
    private _playerUINodes: PlayerUINode[] = [];

    // ===== 资源引用 =====
    private _pokerSprites: Map<string, SpriteFrame> = new Map();
    private _pokerPrefab: Prefab = null!;

    // ===== 配置 =====
    private _levelRank: number = 0;
    private _initialized: boolean = false;

    /**
     * 初始化 PlayerUIManager
     * @param players 玩家数据数组
     * @param pokerSprites 扑克牌精灵资源
     * @param pokerPrefab 扑克牌预制体
     * @param levelRank 当前关卡等级
     * @param layoutConfig 玩家布局配置
     */
    public init(
        players: Player[],
        pokerSprites: Map<string, SpriteFrame>,
        pokerPrefab: Prefab,
        levelRank: number = 0,
        layoutConfig: PlayerPosition[]
    ): void {
        if (this._initialized) {
            console.warn('[PlayerUIManager] Already initialized!');
            return;
        }

        this._pokerSprites = pokerSprites;
        this._pokerPrefab = pokerPrefab;
        this._levelRank = levelRank;

        // 创建 PlayerUINode 节点
        this.createPlayerUINodes(players, layoutConfig);

        this._initialized = true;
        console.log(`[PlayerUIManager] Initialized with ${this._playerUINodes.length} players`);
    }

    /**
     * 创建玩家UI节点
     */
    private createPlayerUINodes(players: Player[], layoutConfig: PlayerPosition[]): void {
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const config = layoutConfig[i];

            // 创建节点
            const playerNode = new Node(config.name);
            playerNode.addComponent(UITransform);
            playerNode.layer = this.node.layer;
            playerNode.setPosition(config.x, config.y, 0);
            playerNode.active = config.active;
            this.node.addChild(playerNode);

            // 添加 PlayerUINode 组件
            const playerUINode = playerNode.addComponent(PlayerUINode);
            playerUINode.init(player, i, this._pokerSprites, this._pokerPrefab, this._levelRank);

            this._playerUINodes.push(playerUINode);
        }
    }

    // ===== 批量操作接口 =====
    /**
     * 更新所有玩家手牌显示
     */
    public updateAllHands(): void {
        this._playerUINodes.forEach(node => node.updateHandDisplay());
    }

    /**
     * 更新指定玩家手牌
     */
    public updatePlayerHand(playerIndex: number, playedCards: number[] = []): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.updateHandDisplay(playedCards);
        }
    }

    /**
     * 更新所有玩家信息
     */
    public updateAllPlayerInfo(): void {
        this._playerUINodes.forEach(node => node.updatePlayerInfo());
    }

    /**
     * 显示庄家标识
     */
    public showDealer(dealerIndex: number): void {
        // 先隐藏所有
        this._playerUINodes.forEach(node => node.hideDealerIndicator());

        // 显示指定玩家
        const node = this._playerUINodes[dealerIndex];
        if (node) {
            node.showDealerIndicator();
        }
    }

    /**
     * 隐藏所有庄家标识
     */
    public hideAllDealers(): void {
        this._playerUINodes.forEach(node => node.hideDealerIndicator());
    }

    // ===== 卡牌选择接口 =====
    /**
     * 启用玩家卡牌选择
     */
    public enableCardSelection(playerIndex: number, callback: SelectionChangedCallback | null = null): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.enableCardSelection(callback);
        }
    }

    /**
     * 禁用玩家卡牌选择
     */
    public disableCardSelection(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.disableCardSelection();
        }
    }

    /**
     * 获取选中的卡牌索引
     */
    public getSelectedIndices(playerIndex: number): number[] {
        const node = this._playerUINodes[playerIndex];
        return node ? node.getSelectedIndices() : [];
    }

    /**
     * 清除选择
     */
    public clearSelection(playerIndex: number): void {
        const node = this._playerUINodes[playerIndex];
        if (node) {
            node.clearSelection();
        }
    }

    // ===== 访问器接口 =====
    /**
     * 获取 PlayerUINode
     */
    public getPlayerUINode(playerIndex: number): PlayerUINode | null {
        return this._playerUINodes[playerIndex] || null;
    }

    /**
     * 获取玩家数量
     */
    public getPlayerCount(): number {
        return this._playerUINodes.length;
    }

    /**
     * 获取玩家世界坐标
     */
    public getPlayerWorldPosition(playerIndex: number): { x: number, y: number } | null {
        const node = this._playerUINodes[playerIndex];
        return node ? node.getWorldPosition() : null;
    }
}
```

---

### 3. Player 类增强（保持现有结构，增加方法）

**当前 Player 已经很好，只需增加一些辅助方法：**

```typescript
/**
 * Player - 玩家数据模型
 * （保持现有代码，增加以下方法）
 */
export class Player {
    // ... 现有代码 ...

    /**
     * 更新分数
     */
    public updateScore(delta: number): void {
        this.score += delta;
    }

    /**
     * 重置玩家状态（新局开始时）
     */
    public reset(): void {
        this.handCards = [];
        this.score = 0;
    }

    /**
     * 获取手牌数量
     */
    public getHandSize(): number {
        return this.handCards.length;
    }

    /**
     * 是否有牌
     */
    public hasCards(): boolean {
        return this.handCards.length > 0;
    }
}
```

---

### 4. PlayerInfo 转为 UI 组件（可选）

如果需要在场景中手动配置玩家信息面板：

```typescript
/**
 * PlayerInfoPanel - 玩家信息面板组件
 * 可以在编辑器中单独配置和复用
 */
@ccclass('PlayerInfoPanel')
export class PlayerInfoPanel extends Component {
    @property(Label)
    public nameLabel: Label = null!;

    @property(Label)
    public scoreLabel: Label = null!;

    @property(Sprite)
    public avatar: Sprite = null!;

    /**
     * 设置玩家信息
     */
    public setPlayerInfo(name: string, score: number = 0): void {
        if (this.nameLabel) {
            this.nameLabel.string = name;
        }
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${score}`;
        }
    }

    /**
     * 更新分数
     */
    public updateScore(score: number): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `分数: ${score}`;
        }
    }

    /**
     * 设置头像
     */
    public setAvatar(spriteFrame: SpriteFrame): void {
        if (this.avatar) {
            this.avatar.spriteFrame = spriteFrame;
        }
    }
}
```

---

## GameModeBase 调整

**initializePlayerUIManager() 方法需要调整：**

```typescript
/**
 * 初始化 PlayerUIManager（GameModeBase.ts）
 */
protected initializePlayerUIManager(): void {
    console.log(`[${this.config.name}] initializePlayerUIManager() - Starting...`);

    const playerUIManager = this.game.playerUIManager;
    if (!playerUIManager) {
        console.error(`[${this.config.name}] PlayerUIManager not found!`);
        return;
    }

    // 获取 poker 资源
    // @ts-ignore
    const pokerSprites = this.game['_pokerSprites'];
    // @ts-ignore
    const pokerPrefab = this.game['_pokerPrefab'];

    if (!pokerSprites || !pokerPrefab) {
        console.error(`[${this.config.name}] Poker resources not loaded!`);
        return;
    }

    // 获取布局配置
    const layoutConfig = PlayerLayoutConfig.getStandardLayout(this.uiPlayers.length);

    // 初始化 PlayerUIManager（新接口）
    playerUIManager.init(
        this.uiPlayers,           // Player 数组
        pokerSprites,             // 扑克牌精灵
        pokerPrefab,              // 扑克牌预制体
        this.getCurrentLevelRank(), // 关卡等级
        layoutConfig              // 布局配置
    );

    console.log(`[${this.config.name}] PlayerUIManager initialized`);
}
```

---

## 迁移步骤

### 阶段 1：创建新组件（不影响现有代码）
1. 创建 [PlayerUINode.ts](PlayerUINode.ts)
2. 创建 [PlayerInfoPanel.ts](PlayerInfoPanel.ts)（可选）
3. 编译测试，确保没有语法错误

### 阶段 2：重构 PlayerUIManager
1. 备份当前 [PlayerUIManager.ts](PlayerUIManager.ts:1-442)
2. 实现新的 PlayerUIManager（管理 PlayerUINode 数组）
3. 保留旧的接口作为兼容层（暂时）

### 阶段 3：调整 GameModeBase
1. 修改 `initializePlayerUIManager()` 调用新接口
2. 测试 TheDecree 模式是否正常工作

### 阶段 4：清理旧代码
1. 删除 PlayerUIManager 中的兼容层代码
2. 删除不再使用的接口和方法
3. 更新所有调用处

### 阶段 5：场景配置（可选）
1. 在编辑器中手动创建 PlayerUINode 预制体
2. 配置信息面板样式
3. 复用预制体创建玩家节点

---

## 优势对比

### 重构前（当前）：
```typescript
// 需要维护多个数组的索引同步
playerUIManager.setPlayerInfo(0, "Alice", 100);
playerUIManager.updatePlayerScore(0, 120);
playerUIManager.showDealer(0);
playerUIManager.updatePlayerHand(0, [card1, card2]);
```

### 重构后（新架构）：
```typescript
// 直接操作玩家节点，逻辑更清晰
const player0 = playerUIManager.getPlayerUINode(0);
player0.setPlayerName("Alice");
player0.updateScore(120);
player0.showDealerIndicator();
player0.updateHandDisplay([card1, card2]);

// 或批量操作
playerUIManager.updateAllHands();
playerUIManager.showDealer(0);
```

---

## 待讨论问题

1. **是否需要在编辑器中手动创建 PlayerUINode 节点？**
   - 选项A：完全代码创建（当前方案）
   - 选项B：在场景中手动配置，代码只负责初始化

2. **PlayerInfo 是否需要独立组件？**
   - 当前方案：集成在 PlayerUINode 中
   - 可选方案：独立 PlayerInfoPanel 组件

3. **是否保留兼容层？**
   - 是否需要保留旧接口以逐步迁移？
   - 还是直接全面重构？

4. **Player 类是否需要更多行为？**
   - 是否需要添加更多游戏逻辑方法？
   - 还是保持纯数据模型？

5. **动画和特效如何处理？**
   - 是否需要在 PlayerUINode 中添加动画接口？
   - 还是由外部统一管理？

---

## 总结

此方案将扁平的数组结构重构为层次化的组件架构，主要改进：

✅ **更清晰的所有权**：每个 PlayerUINode 拥有自己的所有UI元素
✅ **更好的封装**：UI逻辑封装在 PlayerUINode 中
✅ **更易维护**：新增UI元素只需修改 PlayerUINode
✅ **更少的错误**：不再需要手动同步多个数组索引
✅ **更好的扩展性**：轻松添加新的玩家UI功能

请审阅此方案并提出修改建议！
