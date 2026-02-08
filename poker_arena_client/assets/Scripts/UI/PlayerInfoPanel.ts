import { _decorator, Component, Node, Label, Sprite, SpriteFrame, Color, Prefab, instantiate, assetManager, Widget } from 'cc';
import { PlayerInfo } from '../LocalStore/LocalPlayerStore';
import { StateLabelAlignment } from '../Config/SeatConfig';
import { UIColors, StateLabelOffsets, PlayerNameConfig } from '../Config/UIConfig';

const { ccclass, property } = _decorator;

/**
 * 信息面板显示模式
 */
export enum InfoPanelMode {
    ROOM = 'room',      // 房间模式：显示座位、准备状态
    GAME = 'game'       // 游戏模式：显示分数、牌型
}

/**
 * PlayerInfoPanel - 玩家信息面板组件
 *
 * 职责：
 * - 显示玩家的基本信息（名字、头像、分数）
 * - 支持两种显示模式：
 *   - ROOM模式：显示准备状态（房主/已准备/未准备）
 *   - GAME模式：显示分数
 *
 * 使用 Prefab 结构：
 * - PlayerInfoPanelPrefab_0：主玩家版本（带背景）
 * - PlayerInfoPanelPrefab_1：其他玩家版本
 *
 * Prefab 结构：
 * - Label_PlayerName：玩家名称
 * - Label_PlayerScore：玩家分数
 * - Label_PlayerState：玩家状态（准备状态）
 * - Sprite_PlayerImage：玩家头像（预留）
 */
@ccclass('PlayerInfoPanel')
export class PlayerInfoPanel extends Component {
    // ===== UI元素引用 =====
    private nameLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private stateLabel: Label | null = null;
    private avatarSprite: Sprite | null = null;

    // ===== 状态 =====
    private currentMode: InfoPanelMode = InfoPanelMode.ROOM;
    private playerInfo: PlayerInfo | null = null;
    private isMyPlayer: boolean = false;
    private prefabLoaded: boolean = false;
    private isAuto: boolean = false;
    private autoReason?: 'manual' | 'timeout' | 'disconnect';
    private handTypeText: string | null = null;
    private handTypeColor: Color | null = null;
    private stateLabelAlignment: StateLabelAlignment = StateLabelAlignment.RIGHT;  // 默认右侧

    /**
     * 初始化信息面板
     * @param playerInfo 玩家信息
     * @param isMyPlayer 是否是本地玩家
     * @param mode 显示模式
     * @param stateLabelAlignment State Label 的对齐方式
     */
    public init(
        playerInfo: PlayerInfo,
        isMyPlayer: boolean = false,
        mode: InfoPanelMode = InfoPanelMode.ROOM,
        stateLabelAlignment: StateLabelAlignment = StateLabelAlignment.RIGHT
    ): void {
        this.playerInfo = playerInfo;
        this.isMyPlayer = isMyPlayer;
        this.currentMode = mode;
        this.stateLabelAlignment = stateLabelAlignment;

        // 加载并创建 Prefab
        this.loadPrefab();
    }

    /**
     * 加载对应的 Prefab
     */
    private loadPrefab(): void {
        // 1. 确定资源名 (注意：路径是相对于 Bundle 根目录的)
        // 如果 Prefab 就在 Presets 文件夹下，直接用文件名；
        // 如果在 Presets/SubFolder 下，则用 'SubFolder/FileName'
        const prefabName = this.isMyPlayer ? 'PlayerInfoPanelPrefab_0' : 'PlayerInfoPanelPrefab_1';
        
        // 2. 指定 Bundle 名称
        const bundleName = 'UI_Presets';

        console.log(`[PlayerInfoPanel] Start loading prefab: ${prefabName} from bundle: ${bundleName}`);

        // 3. 先获取或加载 Bundle
        assetManager.loadBundle(bundleName, (err, bundle) => {
            if (err) {
                console.error(`[PlayerInfoPanel] Failed to load Bundle: ${bundleName}`, err);
                return;
            }

            // 4. 从 Bundle 中加载特定的 Prefab
            bundle.load(prefabName, Prefab, (err, prefab) => {
                if (err) {
                    console.error(`[PlayerInfoPanel] Failed to load prefab: ${prefabName} in bundle: ${bundleName}`, err);
                    return;
                }

                // 清空现有子节点
                this.node.removeAllChildren();

                // 实例化 Prefab
                const prefabInstance = instantiate(prefab);
                this.node.addChild(prefabInstance);

                // 重置 Prefab 实例的本地位置，确保使用父节点设置的位置
                prefabInstance.setPosition(0, 0, 0);

                // 查找 UI 元素
                this.findUIElements(prefabInstance);

                this.prefabLoaded = true;

                // 更新显示
                this.refresh();

                console.log(`[PlayerInfoPanel] Prefab loaded successfully from ${bundleName}: ${prefabName}`);
            });
        });
    }

    /**
     * 查找 Prefab 中的 UI 元素
     */
    private findUIElements(root: Node): void {
        // 查找名称标签
        const nameNode = root.getChildByName('Label_PlayerName');
        if (nameNode) {
            this.nameLabel = nameNode.getComponent(Label);
        } else {
            console.warn('[PlayerInfoPanel] Label_PlayerName not found in prefab');
        }

        // 查找分数标签
        const scoreNode = root.getChildByName('Label_PlayerScore');
        if (scoreNode) {
            this.scoreLabel = scoreNode.getComponent(Label);
        } else {
            console.warn('[PlayerInfoPanel] Label_PlayerScore not found in prefab');
        }

        // 查找状态标签（注意：Prefab 中的名称是 Label_PlayerState）
        const stateNode = root.getChildByName('Label_PlayerState') || root.getChildByName('Label_State');
        if (stateNode) {
            this.stateLabel = stateNode.getComponent(Label);
            // 应用 state label 的对齐方式
            this.applyStateLabelAlignment(stateNode);
        } else {
            console.warn('[PlayerInfoPanel] Label_PlayerState or Label_State not found in prefab');
        }

        // 查找头像精灵
        const avatarNode = root.getChildByName('Sprite_PlayerImage');
        if (avatarNode) {
            this.avatarSprite = avatarNode.getComponent(Sprite);
        } else {
            console.warn('[PlayerInfoPanel] Sprite_PlayerImage not found in prefab');
        }
    }

    /**
     * 应用 State Label 的对齐方式
     */
    private applyStateLabelAlignment(stateNode: Node): void {
        // 获取或添加 Widget 组件
        let widget = stateNode.getComponent(Widget);
        if (!widget) {
            widget = stateNode.addComponent(Widget);
        }

        // 重置所有对齐
        widget.isAlignLeft = false;
        widget.isAlignRight = false;
        widget.isAlignTop = false;
        widget.isAlignBottom = false;
        widget.isAlignHorizontalCenter = false;
        widget.isAlignVerticalCenter = false;

        // 根据配置设置对齐方式
        // 注意：负值表示向外偏移（显示在面板外侧）
        switch (this.stateLabelAlignment) {
            case StateLabelAlignment.LEFT:
                widget.isAlignLeft = true;
                widget.isAlignVerticalCenter = true;
                widget.left = StateLabelOffsets.left;
                break;
            case StateLabelAlignment.RIGHT:
                widget.isAlignRight = true;
                widget.isAlignVerticalCenter = true;
                widget.right = StateLabelOffsets.right;
                break;
            case StateLabelAlignment.TOP:
                widget.isAlignTop = true;
                widget.isAlignHorizontalCenter = true;
                widget.top = StateLabelOffsets.top;
                break;
            case StateLabelAlignment.BOTTOM:
                widget.isAlignBottom = true;
                widget.isAlignHorizontalCenter = true;
                widget.bottom = StateLabelOffsets.bottom;
                break;
        }

        // 强制更新 Widget
        widget.updateAlignment();

        console.log(`[PlayerInfoPanel] Applied state label alignment: ${this.stateLabelAlignment}`);
    }

    /**
     * 切换显示模式
     */
    public setMode(mode: InfoPanelMode): void {
        if (this.currentMode === mode) return;

        this.currentMode = mode;
        this.refresh();
    }

    /**
     * 更新玩家信息
     */
    public updatePlayerInfo(playerInfo: PlayerInfo): void {
        this.playerInfo = playerInfo;
        this.refresh();
    }

    /**
     * 刷新显示
     */
    public refresh(): void {
        if (!this.playerInfo || !this.prefabLoaded) return;

        // 更新名字（如果是自己，加上标识）
        if (this.nameLabel) {
            const displayName = this.getShortenedName(this.playerInfo.name);
            const nameText = this.isMyPlayer ? `${displayName} (我)` : displayName;
            this.nameLabel.string = nameText;
        }

        // 根据模式更新不同的内容
        if (this.currentMode === InfoPanelMode.ROOM) {
            this.refreshRoomMode();
        } else {
            this.refreshGameMode();
        }
    }

    /**
     * 缩短玩家名字显示
     * 例如：guest_abc123 -> guest_abc
     * @param name 原始名字
     * @returns 缩短后的名字
     */
    private getShortenedName(name: string): string {
        // 如果名字以 guest_ 开头，只取前几位
        if (name.startsWith(PlayerNameConfig.guestPrefix)) {
            const afterGuest = name.substring(PlayerNameConfig.guestPrefix.length);
            if (afterGuest.length > PlayerNameConfig.guestDisplayLength) {
                return `${PlayerNameConfig.guestPrefix}${afterGuest.substring(0, PlayerNameConfig.guestDisplayLength)}`;
            }
            return name;
        }

        // 其他名字如果太长，也进行截断
        if (name.length > PlayerNameConfig.maxNameLength) {
            return name.substring(0, PlayerNameConfig.maxNameLength) + PlayerNameConfig.truncationSuffix;
        }

        return name;
    }

    /**
     * 刷新房间模式显示
     */
    private refreshRoomMode(): void {
        if (!this.playerInfo) return;

        // 隐藏分数标签
        if (this.scoreLabel) {
            this.scoreLabel.string = '';
        }

        // 显示状态
        if (this.stateLabel) {
            if (this.playerInfo.isHost) {
                this.stateLabel.string = '房主';
                this.stateLabel.color = UIColors.playerState.host;
            } else if (this.playerInfo.isReady) {
                this.stateLabel.string = '已准备';
                this.stateLabel.color = UIColors.playerState.ready;
            } else {
                this.stateLabel.string = '未准备';
                this.stateLabel.color = UIColors.playerState.notReady;
            }
        }
    }

    /**
     * 刷新游戏模式显示
     */
    private refreshGameMode(): void {
        // 游戏模式下，显示分数
        if (this.scoreLabel) {
            this.scoreLabel.string = '分数: 0';
        }

        // 暂时不显示状态
        this.updateGameStateLabel();
    }

    // ==================== 游戏模式专用方法 ====================

    /**
     * 更新分数（仅GAME模式）
     */
    public updateScore(score: number): void {
        if (this.scoreLabel && this.currentMode === InfoPanelMode.GAME) {
            this.scoreLabel.string = `分数: ${score}`;
        }
    }

    /**
     * 设置牌型显示（仅GAME模式）
     * TODO: 后续扩展，可能需要额外的 Label
     */
    public setHandType(handTypeText: string, color?: string): void {
        // 暂时使用 stateLabel 显示牌型
        if (this.currentMode !== InfoPanelMode.GAME) return;

        this.handTypeText = handTypeText;
        this.handTypeColor = null;
        if (color) {
            const hexColor = color.replace('#', '');
            const r = parseInt(hexColor.substring(0, 2), 16);
            const g = parseInt(hexColor.substring(2, 4), 16);
            const b = parseInt(hexColor.substring(4, 6), 16);
            this.handTypeColor = new Color(r, g, b, 255);
        }

        this.updateGameStateLabel();
    }

    /**
     * 清除牌型显示（仅GAME模式）
     */
    public clearHandType(): void {
        if (this.currentMode !== InfoPanelMode.GAME) return;

        this.handTypeText = null;
        this.handTypeColor = null;
        this.updateGameStateLabel();
    }

    public setAutoStatus(isAuto: boolean, reason?: 'manual' | 'timeout' | 'disconnect'): void {
        this.isAuto = isAuto;
        this.autoReason = reason;
        this.updateGameStateLabel();
    }

    private updateGameStateLabel(): void {
        if (!this.stateLabel || this.currentMode !== InfoPanelMode.GAME) return;

        if (this.isAuto) {
            this.stateLabel.string = '托管中...';
            this.stateLabel.color = UIColors.playerState.notReady;
        } else {
            this.stateLabel.string = '';
        }

        if (this.handTypeText) {
            this.stateLabel.string = this.handTypeText;
            if (this.handTypeColor) {
                this.stateLabel.color = this.handTypeColor;
            }
            return;
        }
    }

    /**
     * 更新剩余牌数（仅GAME模式）
     * TODO: 后续扩展，可能需要额外的 Label
     */
    public updateCardCount(count: number): void {
        // 暂时不实现，后续扩展
        console.log(`[PlayerInfoPanel] TODO: updateCardCount(${count})`);
    }

    /**
     * 设置头像
     * TODO: 实现头像加载逻辑
     */
    public setAvatar(spriteFrame: SpriteFrame): void {
        if (this.avatarSprite) {
            this.avatarSprite.spriteFrame = spriteFrame;
        }
    }

    /**
     * 清空所有显示
     */
    public clear(): void {
        if (this.nameLabel) this.nameLabel.string = '';
        if (this.scoreLabel) this.scoreLabel.string = '';
        if (this.stateLabel) this.stateLabel.string = '';
        this.isAuto = false;
        this.autoReason = undefined;
        this.handTypeText = null;
        this.handTypeColor = null;
    }
}
