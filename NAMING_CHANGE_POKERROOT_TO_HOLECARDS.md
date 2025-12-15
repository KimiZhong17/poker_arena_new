# 节点命名变更：PokerRoot → HoleCards

## 📝 变更说明

**原名称：** `PokerRoot`
**新名称：** `HoleCards`

**变更原因：**
- `HoleCards` 更准确地描述了节点的用途（玩家的手牌/底牌）
- 符合扑克术语（Hole Cards = 底牌）
- 与 CommunityCards（公共牌）形成对应

---

## ✅ 已更新的文件

### 1. [Game.ts](poker_arena_client/assets/Scripts/Game.ts:149-172)

**变更内容：**
- `createHandsManagerStructure()` 方法中的所有引用
- 节点查找：`getChildByName("HoleCards")`
- 节点创建：`new Node("HoleCards")`
- 所有日志输出

**代码片段：**
```typescript
private createHandsManagerStructure(): Node {
    // Find existing HoleCards - it should be under the Main node (this.node)
    let holeCards = this.node.getChildByName("HoleCards");

    if (!holeCards) {
        console.warn("HoleCards not found under Main node, creating new one");
        holeCards = new Node("HoleCards");
        this.node.addChild(holeCards);
    }

    console.log("HoleCards found, current sibling index:", holeCards.getSiblingIndex());
    console.log("HoleCards parent:", holeCards.parent?.name);
    console.log("HoleCards siblings:", holeCards.parent?.children.map(c => c.name));

    // Create HandsManager node
    const handsManagerNode = new Node("HandsManager");
    holeCards.addChild(handsManagerNode);

    console.log("HandsManager added to HoleCards");

    // Make sure HoleCards is the last child of Main (rendered on top)
    const siblingCount = this.node.children.length;
    holeCards.setSiblingIndex(siblingCount - 1);
    console.log("HoleCards moved to index:", holeCards.getSiblingIndex(), "out of", siblingCount);
    // ...
}
```

### 2. [GAMEROOM_UI_STRUCTURE.md](GAMEROOM_UI_STRUCTURE.md)

**变更内容：**
- 节点结构图中的命名
- 渲染层级顺序中的引用

**节点结构：**
```
Canvas
  ├── Background (共享背景)
  │
  ├── SharedGameplayLayer (共享游戏层 - 扑克牌)
  │   └── HoleCards (玩家手牌)           ← 改名
  │       └── HandsManager (Game.ts 自动创建)
  │           ├── BottomHand (玩家0 - 主玩家)
  │           ├── LeftHand (玩家1)
  │           ├── TopLeftHand (玩家2)
  │           ├── TopRightHand (玩家3)
  │           └── RightHand (玩家4 - 仅 Guandan)
```

**渲染层级：**
```
4. SharedGameplayLayer/HoleCards (zIndex: 10)  ← 改名
```

### 3. [PLAYER_POSITION_SOLUTION.md](PLAYER_POSITION_SOLUTION.md)

**变更内容：**
- 解决方案描述中的命名
- 核心思想总结

**关键段落：**
```markdown
### ✅ 采用方案：共享 HoleCards + 动态调整位置

**核心思路：** 保持共享的 HoleCards/HandsManager，但根据游戏模式动态调整玩家手牌位置和可见性。
```

---

## 🎯 节点层级结构

### 完整层级（新命名）

```
Canvas
  └── HoleCards (玩家手牌根节点)
      └── HandsManager (手牌管理器)
          ├── BottomHand (底部玩家 - 主玩家)
          │   └── Container (卡牌容器)
          ├── LeftHand (左侧玩家)
          │   └── Container
          ├── TopLeftHand (左上玩家)
          │   └── Container
          ├── TopRightHand (右上玩家)
          │   └── Container
          └── RightHand (右侧玩家 - 仅 Guandan)
              └── Container
```

---

## 📋 注意事项

### 如果你在 Cocos Creator 编辑器中手动创建了节点

**需要做的事：**
1. 在场景中找到 `PokerRoot` 节点
2. 将其重命名为 `HoleCards`
3. 或者删除它，让 Game.ts 自动创建

**如何操作：**
1. 打开 GameRoom.scene
2. 在层级管理器中找到 `Canvas` 下的节点
3. 如果有 `PokerRoot` 节点：
   - 右键 → Rename → 改为 `HoleCards`
4. 保存场景

### 如果让 Game.ts 自动创建

**不需要做任何事！**
Game.ts 会自动查找或创建名为 `HoleCards` 的节点。

---

## 🔍 术语说明

### HoleCards（底牌/手牌）
在扑克游戏中，**Hole Cards** 指的是：
- 只有玩家自己能看到的牌
- 每个玩家独有的牌
- 区别于公共牌（Community Cards）

**在本项目中：**
- `HoleCards` = 所有玩家手牌的容器节点
- `HandsManager` = 管理所有玩家手牌显示的组件
- `BottomHand`, `LeftHand` 等 = 各个玩家的手牌显示区域

### CommunityCards（公共牌）
在 The Decree 游戏中：
- 4张所有玩家共享的牌
- 放在场地中央
- 用于与手牌组合成最终牌型

**节点位置：**
```
Objects_TheDecree
  └── GameplayLayer
      └── CommunityCards (4张公共牌)
```

---

## ✅ 迁移检查清单

- [x] **Game.ts** - 更新 `createHandsManagerStructure()` 方法
- [x] **GAMEROOM_UI_STRUCTURE.md** - 更新节点结构图
- [x] **GAMEROOM_UI_STRUCTURE.md** - 更新渲染层级说明
- [x] **PLAYER_POSITION_SOLUTION.md** - 更新解决方案描述
- [ ] **Scene 文件** - 如果手动创建了节点，需要重命名（可选）

---

## 🚀 优势

使用 `HoleCards` 这个名称的好处：

1. **✅ 语义清晰** - 一看就知道是玩家的手牌
2. **✅ 符合术语** - 符合扑克游戏的标准术语
3. **✅ 对应关系** - 与 `CommunityCards` 形成清晰对应
4. **✅ 易于理解** - 新开发者能立即理解节点用途

---

## 📞 总结

**命名变更：** `PokerRoot` → `HoleCards`

**影响范围：**
- 代码：Game.ts 中的自动创建逻辑
- 文档：GAMEROOM_UI_STRUCTURE.md, PLAYER_POSITION_SOLUTION.md
- 场景：如果手动创建了节点，需要重命名（可选）

**建议：**
- 如果场景中有手动创建的 `PokerRoot` 节点，重命名为 `HoleCards`
- 如果没有，让 Game.ts 自动创建即可

命名更新完成！✨
