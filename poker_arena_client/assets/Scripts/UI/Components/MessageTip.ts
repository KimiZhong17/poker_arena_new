import { _decorator, Component, Node, Label, UITransform, Color, tween, Vec3, Tween, Sprite } from 'cc';
import { logger } from '../../Utils/Logger';

const log = logger('MessageTip');

const { ccclass, property } = _decorator;

/**
 * MessageTip - 消息提示组件
 *
 * 用于在游戏中显示临时提示信息，例如：
 * - "庄家叫了 2 张牌"
 * - "玩家 XXX 已出牌"
 * - "等待其他玩家..."
 *
 * 使用方法：
 * 1. 将此组件附加到一个 Node 上
 * 2. 调用 showMessage() 显示消息
 * 3. 消息会自动淡入、停留、淡出
 */
@ccclass('MessageTip')
export class MessageTip extends Component {

    @property(Label)
    public messageLabel: Label | null = null;

    @property(Sprite)
    public backgroundSprite: Sprite | null = null;

    @property
    public defaultDuration: number = 2.0; // 默认显示时长（秒）

    @property
    public fadeInDuration: number = 0.3; // 淡入时长（秒）

    @property
    public fadeOutDuration: number = 0.3; // 淡出时长（秒）

    private isShowing: boolean = false;
    private currentTween: Tween<Node> | null = null; // 保存当前的 tween 引用

    onLoad() {
        // 如果没有手动指定 Label，尝试自动查找
        if (!this.messageLabel) {
            this.messageLabel = this.node.getComponentInChildren(Label);

            // 如果还是没有，创建一个
            if (!this.messageLabel) {
                this.createDefaultLabel();
            }
        }

        // 初始时隐藏
        this.hide();
    }

    /**
     * 创建默认的 Label
     */
    private createDefaultLabel(): void {
        const labelNode = new Node('MessageLabel');
        labelNode.addComponent(UITransform);
        this.messageLabel = labelNode.addComponent(Label);
        this.messageLabel.fontSize = 28;
        this.messageLabel.color = new Color(255, 255, 255, 255);
        this.messageLabel.lineHeight = 32;

        // 添加到当前节点
        this.node.addChild(labelNode);

        log.debug('Created default label');
    }

    /**
     * 显示消息
     * @param message 要显示的消息文本
     * @param duration 显示时长（秒），不包括淡入淡出时间。如果为 0，则使用默认时长
     * @param color 文字颜色（可选）
     */
    public showMessage(message: string, duration: number = 0, color?: Color): void {
        if (!this.messageLabel) {
            log.error('Message label not found!');
            return;
        }

        // 如果正在显示，先停止之前的动画
        if (this.isShowing && this.currentTween) {
            this.currentTween.stop();
            this.currentTween = null;
        }

        // 设置消息文本
        this.messageLabel.string = message;

        // 设置颜色
        if (color) {
            this.messageLabel.color = color;
        } else {
            this.messageLabel.color = new Color(255, 255, 255, 255);
        }

        // 使用默认时长
        const displayDuration = duration > 0 ? duration : this.defaultDuration;

        log.debug(`Showing message: "${message}" for ${displayDuration}s`);

        // 标记为正在显示
        this.isShowing = true;

        // 设置初始透明度为 0
        this.node.active = true;
        const startOpacity = 0;
        const endOpacity = 255;
        this.setOpacity(startOpacity);

        // 创建动画序列：淡入 -> 停留 -> 淡出
        this.currentTween = tween(this.node)
            // 淡入
            .call(() => {
                this.setOpacity(startOpacity);
            })
            .to(this.fadeInDuration, {}, {
                onUpdate: (target, ratio) => {
                    this.setOpacity(startOpacity + (endOpacity - startOpacity) * ratio);
                }
            })
            // 停留
            .delay(displayDuration)
            // 淡出
            .to(this.fadeOutDuration, {}, {
                onUpdate: (target, ratio) => {
                    this.setOpacity(endOpacity - (endOpacity - startOpacity) * ratio);
                }
            })
            // 完成后隐藏
            .call(() => {
                this.hide();
                this.isShowing = false;
                this.currentTween = null;
            })
            .start();
    }

    /**
     * 设置节点透明度
     */
    private setOpacity(opacity: number): void {
        if (this.messageLabel) {
            const color = this.messageLabel.color.clone();
            color.a = opacity;
            this.messageLabel.color = color;
        }
        if (this.backgroundSprite) {
            const bgColor = this.backgroundSprite.color.clone();
            bgColor.a = opacity;
            this.backgroundSprite.color = bgColor;
        }
    }

    /**
     * 立即隐藏消息
     */
    public hide(): void {
        // 停止当前动画
        if (this.currentTween) {
            this.currentTween.stop();
            this.currentTween = null;
        }

        this.node.active = false;
        this.isShowing = false;
    }

    /**
     * 检查是否正在显示
     */
    public isMessageShowing(): boolean {
        return this.isShowing;
    }
}
