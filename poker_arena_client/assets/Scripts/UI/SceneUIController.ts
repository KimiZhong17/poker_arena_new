import { _decorator, Component, Node, Button, Label, UITransform, Color, Sprite, SpriteFrame } from 'cc';
import { SceneManager } from '../SceneManager';
import { EventCenter } from '../Utils/EventCenter';
import { RoomService } from '../Services/RoomService';
import { logger } from '../Utils/Logger';

const log = logger('SceneUI');

const { ccclass, property } = _decorator;

/**
 * SceneUIController - 场景UI控制器
 *
 * 管理游戏场景中的通用UI元素：
 * - 退出房间按钮
 * - 设置按钮
 * - 房间号显示
 *
 * 使用方法：
 * 1. 将此组件附加到 Node_SceneUI 节点上
 * 2. 可以手动在编辑器中绑定按钮和标签，或者让组件自动创建
 * 3. 调用 init() 方法初始化（传入房间ID等信息）
 */
@ccclass('SceneUIController')
export class SceneUIController extends Component {

    // ===== 按钮引用 =====
    @property(Button)
    public exitButton: Button | null = null;

    @property(Button)
    public settingsButton: Button | null = null;

    // ===== 标签引用 =====
    @property(Label)
    public roomIdLabel: Label | null = null;

    // ===== 配置 =====
    @property
    public showRoomId: boolean = true; // 是否显示房间号

    @property
    public showExitButton: boolean = true; // 是否显示退出按钮

    @property
    public showSettingsButton: boolean = true; // 是否显示设置按钮

    // ===== 内部状态 =====
    private _roomId: string = '';
    private _isOnlineMode: boolean = false;
    private _sceneManager: SceneManager = null!;

    onLoad() {
        this._sceneManager = SceneManager.getInstance();

        // 自动查找或创建UI元素
        this.autoSetupUI();
    }

    /**
     * 初始化场景UI
     * @param roomId 房间ID
     * @param isOnlineMode 是否在线模式
     */
    public init(roomId: string, isOnlineMode: boolean = false): void {
        log.debug(`[SceneUIController] Initializing with roomId: ${roomId}, online: ${isOnlineMode}`);

        this._roomId = roomId;
        this._isOnlineMode = isOnlineMode;

        // 更新UI显示
        this.updateUI();
    }

    /**
     * 自动设置UI元素（查找或创建）
     */
    private autoSetupUI(): void {
        log.debug('[SceneUIController] Auto-setting up UI elements...');

        // 查找或创建退出按钮
        if (this.showExitButton) {
            if (!this.exitButton) {
                log.debug('[SceneUIController] Exit button not manually assigned, searching or creating...');
                this.exitButton = this.findOrCreateButton('btn_exit', '退出房间', { x: -500, y: 300 });
            } else {
                log.debug('[SceneUIController] Using manually assigned exit button');
            }
            if (this.exitButton) {
                log.debug('[SceneUIController] Exit button found/created, binding click event');
                log.debug('[SceneUIController] Exit button node:', this.exitButton.node);
                log.debug('[SceneUIController] Exit button node name:', this.exitButton.node?.name);
                this.exitButton.node.on(Button.EventType.CLICK, this.onExitButtonClicked, this);
                log.debug('[SceneUIController] Exit button click event bound successfully');
            } else {
                log.error('[SceneUIController] Failed to find or create exit button!');
            }
        }

        // 查找或创建设置按钮
        if (this.showSettingsButton) {
            if (!this.settingsButton) {
                log.debug('[SceneUIController] Settings button not manually assigned, searching or creating...');
                this.settingsButton = this.findOrCreateButton('btn_settings', '设置', { x: -400, y: 300 });
            } else {
                log.debug('[SceneUIController] Using manually assigned settings button');
            }
            if (this.settingsButton) {
                this.settingsButton.node.on(Button.EventType.CLICK, this.onSettingsButtonClicked, this);
            }
        }

        // 查找或创建房间号标签
        if (this.showRoomId) {
            if (!this.roomIdLabel) {
                log.debug('[SceneUIController] Room ID label not manually assigned, searching or creating...');
                this.roomIdLabel = this.findOrCreateLabel('label_room_id', '房间号: ', { x: 0, y: 300 });
            } else {
                log.debug('[SceneUIController] Using manually assigned room ID label');
            }
        }

        log.debug('[SceneUIController] UI setup complete');
    }

    /**
     * 查找或创建按钮
     */
    private findOrCreateButton(name: string, text: string, position: { x: number, y: number }): Button | null {
        // 尝试递归查找现有按钮（支持在子节点中查找）
        let buttonNode = this.findNodeByName(this.node, name);

        if (!buttonNode) {
            // 创建新按钮
            buttonNode = new Node(name);
            buttonNode.addComponent(UITransform);
            buttonNode.layer = this.node.layer;
            buttonNode.setPosition(position.x, position.y, 0);
            this.node.addChild(buttonNode);

            // 添加 Sprite 组件（背景）
            const sprite = buttonNode.addComponent(Sprite);
            sprite.type = Sprite.Type.SLICED;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const uiTransform = buttonNode.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.setContentSize(120, 50);
            }

            // 添加 Button 组件
            const button = buttonNode.addComponent(Button);

            // 创建文本标签
            const labelNode = new Node('Label');
            labelNode.addComponent(UITransform);
            labelNode.layer = this.node.layer;
            const label = labelNode.addComponent(Label);
            label.string = text;
            label.fontSize = 24;
            label.color = new Color(255, 255, 255, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            buttonNode.addChild(labelNode);

            log.debug(`[SceneUIController] Created button: ${name}`);
            return button;
        } else {
            // 返回现有按钮的 Button 组件
            const button = buttonNode.getComponent(Button);
            if (!button) {
                log.warn(`[SceneUIController] Node ${name} exists but has no Button component`);
                return null;
            }
            log.debug(`[SceneUIController] Found existing button: ${name}`);
            return button;
        }
    }

    /**
     * 查找或创建标签
     */
    private findOrCreateLabel(name: string, text: string, position: { x: number, y: number }): Label | null {
        // 尝试递归查找现有标签（支持在子节点中查找）
        let labelNode = this.findNodeByName(this.node, name);

        if (!labelNode) {
            // 创建新标签
            labelNode = new Node(name);
            labelNode.addComponent(UITransform);
            labelNode.layer = this.node.layer;
            labelNode.setPosition(position.x, position.y, 0);
            this.node.addChild(labelNode);

            // 添加 Label 组件
            const label = labelNode.addComponent(Label);
            label.string = text;
            label.fontSize = 28;
            label.color = new Color(255, 255, 255, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;

            log.debug(`[SceneUIController] Created label: ${name}`);
            return label;
        } else {
            // 返回现有标签的 Label 组件
            const label = labelNode.getComponent(Label);
            if (!label) {
                log.warn(`[SceneUIController] Node ${name} exists but has no Label component`);
                return null;
            }
            log.debug(`[SceneUIController] Found existing label: ${name}`);
            return label;
        }
    }

    /**
     * 递归查找节点（支持在子节点树中查找）
     * @param root 根节点
     * @param name 要查找的节点名称
     * @returns 找到的节点或 null
     */
    private findNodeByName(root: Node, name: string): Node | null {
        // 检查当前节点
        if (root.name === name) {
            return root;
        }

        // 递归搜索子节点
        for (const child of root.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * 更新UI显示
     */
    private updateUI(): void {
        // 更新房间号显示
        if (this.roomIdLabel && this.showRoomId) {
            if (this._roomId) {
                this.roomIdLabel.string = `房间号: ${this._roomId}`;
                this.roomIdLabel.node.active = true;
            } else {
                this.roomIdLabel.node.active = false;
            }
        }

        // 根据模式显示/隐藏按钮
        if (this.exitButton) {
            this.exitButton.node.active = this.showExitButton;
        }

        if (this.settingsButton) {
            this.settingsButton.node.active = this.showSettingsButton;
        }
    }

    /**
     * 退出按钮点击事件
     */
    private onExitButtonClicked(): void {
        log.debug('[SceneUIController] ========== EXIT BUTTON CLICKED ==========');
        log.debug('[SceneUIController] isOnlineMode:', this._isOnlineMode);
        log.debug('[SceneUIController] roomId:', this._roomId);

        // 发送退出房间事件
        EventCenter.emit('EXIT_ROOM_REQUESTED');
        log.debug('[SceneUIController] EXIT_ROOM_REQUESTED event emitted');

        // 延迟场景切换，避免在事件处理过程中销毁组件导致错误
        this.scheduleOnce(() => {
            log.debug('[SceneUIController] Executing delayed scene transition...');
            // 根据模式返回不同场景
            if (this._isOnlineMode) {
                // 在线模式：通知服务器离开房间，然后返回大厅
                log.debug('[SceneUIController] Leaving room (online mode)');
                const roomService = RoomService.getInstance();
                roomService.leaveRoom();

                // 返回大厅（需要传递游戏模式参数）
                log.debug('[SceneUIController] Navigating to Lobby...');
                this._sceneManager.goToLobby({
                    gameMode: 'the_decree',
                    minPlayers: 4,
                    maxPlayers: 4
                });
            } else {
                // 离线模式：直接返回大厅
                log.debug('[SceneUIController] Returning to Hall (offline mode)');
                this._sceneManager.goToHall();
            }
            log.debug('[SceneUIController] Scene transition initiated');
        }, 0);

        log.debug('[SceneUIController] ========== EXIT BUTTON HANDLER END ==========');
    }

    /**
     * 设置按钮点击事件
     */
    private onSettingsButtonClicked(): void {
        log.debug('[SceneUIController] Settings button clicked');

        // 发送打开设置事件
        EventCenter.emit('OPEN_SETTINGS_REQUESTED');

        // TODO: 实现设置面板
        log.debug('[SceneUIController] Settings panel not implemented yet');
    }

    /**
     * 设置房间ID
     */
    public setRoomId(roomId: string): void {
        this._roomId = roomId;
        this.updateUI();
    }

    /**
     * 获取房间ID
     */
    public getRoomId(): string {
        return this._roomId;
    }

    /**
     * 显示/隐藏退出按钮
     */
    public setExitButtonVisible(visible: boolean): void {
        this.showExitButton = visible;
        if (this.exitButton) {
            this.exitButton.node.active = visible;
        }
    }

    /**
     * 显示/隐藏设置按钮
     */
    public setSettingsButtonVisible(visible: boolean): void {
        this.showSettingsButton = visible;
        if (this.settingsButton) {
            this.settingsButton.node.active = visible;
        }
    }

    /**
     * 显示/隐藏房间号
     */
    public setRoomIdVisible(visible: boolean): void {
        this.showRoomId = visible;
        if (this.roomIdLabel) {
            this.roomIdLabel.node.active = visible && !!this._roomId;
        }
    }

    /**
     * 清理
     */
    onDestroy(): void {
        // 移除事件监听
        if (this.exitButton && this.exitButton.node) {
            this.exitButton.node.off(Button.EventType.CLICK, this.onExitButtonClicked, this);
        }

        if (this.settingsButton && this.settingsButton.node) {
            this.settingsButton.node.off(Button.EventType.CLICK, this.onSettingsButtonClicked, this);
        }
    }
}
