import { _decorator, Component, Node, Label, Sprite, SpriteFrame, UITransform, Color } from 'cc';
import { PlayerInfo } from '../LocalStore/LocalPlayerStore';

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
 * - 显示玩家的基本信息（名字、头像）
 * - 支持两种显示模式：
 *   - ROOM模式：显示座位号、准备状态（房主/已准备/未准备）
 *   - GAME模式：显示分数、牌型、剩余牌数
 *
 * 生命周期：
 * - 从玩家进入房间开始创建，一直到离开房间
 * - 在不同阶段切换显示模式
 */
@ccclass('PlayerInfoPanel')
export class PlayerInfoPanel extends Component {
    // ===== UI元素 =====
    private nameLabel: Label | null = null;
    private avatarSprite: Sprite | null = null;

    // ROOM模式专用
    private seatLabel: Label | null = null;      // 座位号
    private statusLabel: Label | null = null;    // 准备状态

    // GAME模式专用
    private scoreLabel: Label | null = null;     // 分数
    private handTypeLabel: Label | null = null;  // 牌型
    private cardCountLabel: Label | null = null; // 剩余牌数

    // ===== 状态 =====
    private currentMode: InfoPanelMode = InfoPanelMode.ROOM;
    private playerInfo: PlayerInfo | null = null;
    private isMyPlayer: boolean = false;

    /**
     * 初始化信息面板
     * @param playerInfo 玩家信息
     * @param isMyPlayer 是否是本地玩家
     * @param mode 显示模式
     */
    public init(playerInfo: PlayerInfo, isMyPlayer: boolean = false, mode: InfoPanelMode = InfoPanelMode.ROOM): void {
        this.playerInfo = playerInfo;
        this.isMyPlayer = isMyPlayer;
        this.currentMode = mode;

        // 创建UI元素
        this.createUIElements();

        // 更新显示
        this.refresh();
    }

    /**
     * 创建UI元素
     */
    private createUIElements(): void {
        // 清空现有子节点
        this.node.removeAllChildren();

        // 创建头像（可选）
        const avatarNode = new Node('Avatar');
        avatarNode.addComponent(UITransform);
        this.avatarSprite = avatarNode.addComponent(Sprite);
        avatarNode.setPosition(0, 35, 0);
        this.node.addChild(avatarNode);

        // 创建名字标签（始终显示）
        const nameNode = new Node('NameLabel');
        nameNode.addComponent(UITransform);
        this.nameLabel = nameNode.addComponent(Label);
        this.nameLabel.fontSize = 20;
        this.nameLabel.color = new Color(255, 255, 255, 255);
        nameNode.setPosition(0, 0, 0);
        this.node.addChild(nameNode);

        // 根据模式创建不同的UI元素
        if (this.currentMode === InfoPanelMode.ROOM) {
            this.createRoomModeUI();
        } else {
            this.createGameModeUI();
        }
    }

    /**
     * 创建房间模式UI
     */
    private createRoomModeUI(): void {
        // 座位标签
        const seatNode = new Node('SeatLabel');
        seatNode.addComponent(UITransform);
        this.seatLabel = seatNode.addComponent(Label);
        this.seatLabel.fontSize = 18;
        this.seatLabel.color = new Color(200, 200, 200, 255);
        seatNode.setPosition(0, -25, 0);
        this.node.addChild(seatNode);

        // 状态标签（房主/已准备/未准备）
        const statusNode = new Node('StatusLabel');
        statusNode.addComponent(UITransform);
        this.statusLabel = statusNode.addComponent(Label);
        this.statusLabel.fontSize = 18;
        statusNode.setPosition(0, -50, 0);
        this.node.addChild(statusNode);
    }

    /**
     * 创建游戏模式UI
     */
    private createGameModeUI(): void {
        // 分数标签
        const scoreNode = new Node('ScoreLabel');
        scoreNode.addComponent(UITransform);
        this.scoreLabel = scoreNode.addComponent(Label);
        this.scoreLabel.fontSize = 18;
        this.scoreLabel.color = new Color(255, 255, 255, 255);
        scoreNode.setPosition(0, -25, 0);
        this.node.addChild(scoreNode);

        // 牌型标签
        const handTypeNode = new Node('HandTypeLabel');
        handTypeNode.addComponent(UITransform);
        this.handTypeLabel = handTypeNode.addComponent(Label);
        this.handTypeLabel.fontSize = 16;
        this.handTypeLabel.color = new Color(255, 215, 0, 255); // 金色
        handTypeNode.setPosition(0, -50, 0);
        this.node.addChild(handTypeNode);

        // 剩余牌数标签（可选）
        const cardCountNode = new Node('CardCountLabel');
        cardCountNode.addComponent(UITransform);
        this.cardCountLabel = cardCountNode.addComponent(Label);
        this.cardCountLabel.fontSize = 16;
        this.cardCountLabel.color = new Color(150, 150, 150, 255);
        cardCountNode.setPosition(0, -75, 0);
        this.node.addChild(cardCountNode);
    }

    /**
     * 切换显示模式
     */
    public setMode(mode: InfoPanelMode): void {
        if (this.currentMode === mode) return;

        this.currentMode = mode;
        this.createUIElements(); // 重新创建UI元素
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
        if (!this.playerInfo) return;

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
        if (name.startsWith('guest_')) {
            const afterGuest = name.substring(6); // 去掉 "guest_"
            if (afterGuest.length > 3) {
                return `guest_${afterGuest.substring(0, 3)}`;
            }
            return name;
        }

        // 其他名字如果太长，也进行截断
        const maxLength = 8;
        if (name.length > maxLength) {
            return name.substring(0, maxLength) + '...';
        }

        return name;
    }

    /**
     * 刷新房间模式显示
     */
    private refreshRoomMode(): void {
        if (!this.playerInfo) return;

        // 显示座位
        if (this.seatLabel) {
            this.seatLabel.string = `座位 ${this.playerInfo.seatIndex + 1}`;
        }

        // 显示状态
        if (this.statusLabel) {
            if (this.playerInfo.isHost) {
                this.statusLabel.string = '房主';
                this.statusLabel.color = new Color(255, 215, 0, 255); // 金色
            } else if (this.playerInfo.isReady) {
                this.statusLabel.string = '已准备';
                this.statusLabel.color = new Color(0, 255, 0, 255); // 绿色
            } else {
                this.statusLabel.string = '未准备';
                this.statusLabel.color = new Color(150, 150, 150, 255); // 灰色
            }
        }
    }

    /**
     * 刷新游戏模式显示
     */
    private refreshGameMode(): void {
        // 游戏模式下，分数、牌型等由外部调用 updateScore、setHandType 等方法更新
        // 这里可以清空之前的显示
        if (this.scoreLabel) {
            this.scoreLabel.string = '分数: 0';
        }
        if (this.handTypeLabel) {
            this.handTypeLabel.string = '';
        }
        if (this.cardCountLabel) {
            this.cardCountLabel.string = '';
        }
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
     */
    public setHandType(handTypeText: string, color?: string): void {
        if (this.handTypeLabel && this.currentMode === InfoPanelMode.GAME) {
            this.handTypeLabel.string = handTypeText;
            if (color) {
                const hexColor = color.replace('#', '');
                const r = parseInt(hexColor.substring(0, 2), 16);
                const g = parseInt(hexColor.substring(2, 4), 16);
                const b = parseInt(hexColor.substring(4, 6), 16);
                this.handTypeLabel.color = new Color(r, g, b, 255);
            }
        }
    }

    /**
     * 清除牌型显示（仅GAME模式）
     */
    public clearHandType(): void {
        if (this.handTypeLabel && this.currentMode === InfoPanelMode.GAME) {
            this.handTypeLabel.string = '';
        }
    }

    /**
     * 更新剩余牌数（仅GAME模式）
     */
    public updateCardCount(count: number): void {
        if (this.cardCountLabel && this.currentMode === InfoPanelMode.GAME) {
            this.cardCountLabel.string = `剩余: ${count}`;
        }
    }

    /**
     * 设置头像
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
        if (this.seatLabel) this.seatLabel.string = '';
        if (this.statusLabel) this.statusLabel.string = '';
        if (this.scoreLabel) this.scoreLabel.string = '';
        if (this.handTypeLabel) this.handTypeLabel.string = '';
        if (this.cardCountLabel) this.cardCountLabel.string = '';
    }
}
