# 扑克竞技场 - 资产需求清单

## 📋 项目概况
- **项目名称**: Poker Arena (扑克竞技场)
- **游戏模式**: The Decree (圣旨) + Guandan (掼蛋)
- **玩家数量**: 4-5人
- **引擎**: Cocos Creator

---

## ✅ 已有资产

### 1. 扑克牌资源 (完整)
- ✅ 54张标准扑克牌图片
- ✅ 3种卡牌背面 (CardBack, CardBack2, CardBack3)
- ✅ PokerPrefab.prefab (扑克牌预制体)
- ✅ PokerAtlas (图集)

### 2. 场景文件 (完整)
- ✅ Login.scene (登录)
- ✅ Hall.scene (大厅)
- ✅ Lobby.scene (房间)
- ✅ GameRoom.scene (游戏)

### 3. 背景图 (完整)
- ✅ HomePage.png (主页)
- ✅ Hall.jpg (大厅)
- ✅ Lobby.jpg/Lobby2.png (房间大厅)
- ✅ InGame2.jpg (游戏内)
- ✅ Receptionist.png (NPC)

### 4. 基础UI素材 (部分完整)
- ✅ GameBtn01-06.png (6个按钮背景)
- ✅ Dealer.png (庄家标记)
- ✅ btn_thedecree.png (圣旨按钮)
- ✅ btn_guandan.png (掼蛋按钮)
- ✅ btn_create_room.png (创建房间)
- ✅ btn_join_room.png (加入房间)
- ✅ btn_guest.png (游客登录)
- ✅ btn_wechat.png (微信登录)

---

## 🎯 需要补充的资产

### 优先级 1 - 立即需要 (核心游戏流程)

#### A. 游戏操作按钮文字/图标
需要为 GameBtn01-06 配置以下功能：

```
建议配置：
GameBtn01 → "准备" (Ready)
GameBtn02 → "开始游戏" (Start)
GameBtn03 → "出牌" (Play/Confirm)
GameBtn04 → "取消" (Cancel)
GameBtn05 → "过牌" (Pass) - 仅掼蛋
GameBtn06 → "返回" (Back)
```

**实现方式**：在按钮上添加 Label 组件显示文字即可

#### B. 玩家信息UI (临时方案：纯代码生成)
```
每个玩家位置需要显示：
- 玩家昵称 (Label)
- 准备状态指示 (Label: "已准备"/"未准备")
- 当前回合高亮 (Sprite 边框或箭头)
- 剩余手牌数量 (Label: "5张")

临时方案：用纯色 Sprite + Label 组合
```

#### C. 游戏状态提示文本 (Label组件)
```
需要显示的提示：
- "等待玩家准备..."
- "游戏开始！"
- "轮到你了！"
- "等待玩家X出牌..."
- "回合结束"
- "玩家X获胜！"
```

#### D. The Decree 专用UI
```
1. 庄家选择面板
   - 4个区域显示玩家翻开的牌
   - 庄家标记 (已有 Dealer.png ✅)

2. 庄家叫牌面板
   - "出1张" 按钮 (可用 GameBtn01)
   - "出2张" 按钮 (可用 GameBtn02)
   - "出3张" 按钮 (可用 GameBtn03)

3. 公共牌显示区
   - 4张公共牌的显示区域
   - (代码中已有 CommunityCardsNode ✅)
```

---

### 优先级 2 - 短期需要 (完善体验)

#### E. 倒计时UI
```
选项1 (推荐): 圆形进度条
- 需要素材: 圆形进度条背景 + 进度条填充图

选项2 (简单): 纯数字倒计时
- 只需要 Label 组件，显示 "10", "9", "8"...
```

#### F. 结算面板UI
```
EndStage 需要显示：
- 标题: "游戏结束"
- 排名列表 (4-5个玩家)
  - 排名、昵称、得分
- "再来一局" 按钮 (可用 GameBtn02)
- "返回大厅" 按钮 (可用 GameBtn06)

临时方案：用 ScrollView + Label 组合
```

#### G. 玩家头像框
```
需要：
- 默认头像图 (圆形或方形，1张即可)
- 头像边框 (当前回合高亮用)
- 尺寸: 80x80 或 100x100

临时方案：用纯色圆形 Sprite 代替
```

---

### 优先级 3 - 长期优化 (锦上添花)

#### H. 音效文件
```
推荐音效列表：
- button_click.mp3 (按钮点击)
- card_deal.mp3 (发牌)
- card_play.mp3 (出牌)
- card_flip.mp3 (翻牌)
- round_end.mp3 (回合结束)
- win.mp3 (胜利)
- lose.mp3 (失败)
- countdown.mp3 (倒计时警告，最后3秒)

格式: MP3 或 WAV
大小: 每个 < 100KB
```

#### I. 动画资源
```
1. 发牌动画
   - 卡牌从牌堆飞向玩家手牌区
   - 可用 Cocos 的 Tween 实现

2. 翻牌动画
   - 卡牌旋转翻面
   - 可用 3D旋转或缩放实现

3. 选中动画
   - 卡牌向上抬起 (已在代码中实现 ✅)
   - 可添加缩放或发光效果

4. 粒子特效
   - 胜利特效 (金币、星星)
   - 出牌特效 (光芒)
```

#### J. 精美UI替换
```
当前临时方案可以后续替换为：
- 精美玩家头像框 (带装饰边框)
- 精美按钮 (带图标和渐变)
- 精美背景 (带动态元素)
- 游戏LOGO和装饰元素
```

---

## 🚀 实施建议

### 阶段1: 核心流程 (当前阶段)
**目标**: 让游戏跑起来，完成完整流程

**需要资产**:
- ✅ 扑克牌 (已有)
- ✅ 按钮背景 (已有 GameBtn01-06)
- ⚠️ 按钮文字 (用Label添加)
- ⚠️ 玩家信息UI (纯代码生成)
- ⚠️ 状态提示 (用Label添加)

**时间**: 1-2天
**结果**: 可以完整游玩一局游戏

---

### 阶段2: 完善体验
**目标**: 添加视觉反馈和更好的UI

**需要资产**:
- 倒计时UI
- 结算面板
- 玩家头像

**时间**: 1-2天
**结果**: 游戏体验更流畅

---

### 阶段3: 锦上添花
**目标**: 音效、动画、美化

**需要资产**:
- 7-8个基础音效
- 粒子特效
- 精美UI素材

**时间**: 2-3天
**结果**: 完整的商业级游戏体验

---

## 📝 临时方案 (立即可用)

### 不需要新素材的临时方案：

1. **按钮文字**
   ```typescript
   // 在按钮节点上添加子节点 Label
   const label = buttonNode.addComponent(Label);
   label.string = "准备";
   label.fontSize = 32;
   ```

2. **玩家信息框**
   ```typescript
   // 用纯色 Sprite + Label
   const bg = playerNode.addComponent(Sprite);
   bg.color = new Color(50, 50, 50, 200); // 半透明灰色

   const nameLabel = nameNode.addComponent(Label);
   nameLabel.string = "玩家1";
   ```

3. **状态提示**
   ```typescript
   // 屏幕中央的大号文字提示
   const tipLabel = tipNode.addComponent(Label);
   tipLabel.string = "等待玩家准备...";
   tipLabel.fontSize = 48;
   ```

4. **倒计时**
   ```typescript
   // 纯数字倒计时
   const timerLabel = timerNode.addComponent(Label);
   timerLabel.string = "10";
   timerLabel.fontSize = 64;
   ```

---

## ✅ 总结

**现在可以开始开发！**

你已有的 GameBtn01-06 完全够用，我们只需要：
1. 在代码中为每个按钮添加 Label 文字
2. 用代码生成玩家信息UI（临时方案）
3. 添加文字提示（Label组件）

**不需要等待任何新素材，就可以实现完整的游戏流程！**

等游戏逻辑全部跑通后，再慢慢替换成精美UI。

---

## 📞 下一步

开始实现 ReadyStage！
