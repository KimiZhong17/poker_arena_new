import { _decorator, Component, Node, Label, UITransform, tween, Vec3, Tween } from 'cc';
import { UIAnimations, UIFonts, UIColors } from '../../Config/UIConfig';
import { logger } from '../../Utils/Logger';

const log = logger('CardsToPlayHint');

const { ccclass, property } = _decorator;

/**
 * CardsToPlayHint - 出牌数量提示组件
 *
 * 在庄家叫牌后显示 "本轮需要打出 n 张牌" 的持久提示，
 * 带有同步的透明度脉冲 + 微缩放呼吸动画。
 *
 * 使用方法：
 * 1. 将此组件附加到 TheDecree 下的一个子节点（命名为 "CardsToPlayHint"）
 * 2. 由 TheDecreeUIController 自动查找并控制显示/隐藏
 * 3. 调用 show(n) 显示提示，调用 hide() 隐藏
 */
@ccclass('CardsToPlayHint')
export class CardsToPlayHint extends Component {

    @property(Label)
    public hintLabel: Label | null = null;

    private breathTween: Tween<Node> | null = null;

    onLoad() {
        // 如果没有手动指定 Label，尝试自动查找
        if (!this.hintLabel) {
            this.hintLabel = this.node.getComponentInChildren(Label);

            // 如果还是没有，创建一个
            if (!this.hintLabel) {
                this.createDefaultLabel();
            }
        }

        // 初始时隐藏
        this.node.active = false;
    }

    /**
     * 创建默认的 Label
     */
    private createDefaultLabel(): void {
        const labelNode = new Node('HintLabel');
        labelNode.addComponent(UITransform);
        this.hintLabel = labelNode.addComponent(Label);
        this.hintLabel.fontSize = UIFonts.cardsToPlayHint.fontSize;
        this.hintLabel.lineHeight = UIFonts.cardsToPlayHint.lineHeight;
        this.hintLabel.color = UIColors.text.hint.clone();
        this.node.addChild(labelNode);
        log.debug('Created default label');
    }

    /**
     * 显示出牌数量提示并启动呼吸动画
     * @param cardsToPlay 需要打出的牌数 (1, 2, or 3)
     */
    public show(cardsToPlay: number): void {
        if (!this.hintLabel) {
            log.error('Hint label not found!');
            return;
        }

        // 设置文本、颜色和字体
        this.hintLabel.string = `本轮需要打出 ${cardsToPlay} 张牌`;
        this.hintLabel.color = UIColors.text.hint.clone();
        this.hintLabel.fontSize = UIFonts.cardsToPlayHint.fontSize;
        this.hintLabel.lineHeight = UIFonts.cardsToPlayHint.lineHeight;

        // 设置初始状态
        const config = UIAnimations.cardsToPlayHint;
        this.node.active = true;
        this.setOpacity(config.maxOpacity);
        this.node.setScale(new Vec3(config.maxScale, config.maxScale, 1));

        // 启动呼吸动画
        this.startBreathAnimation();

        log.debug(`Showing hint: ${cardsToPlay} cards`);
    }

    /**
     * 隐藏提示并停止动画
     */
    public hide(): void {
        this.stopBreathAnimation();
        this.node.active = false;
    }

    /**
     * 启动同步的呼吸动画（透明度脉冲 + 微缩放）
     */
    private startBreathAnimation(): void {
        // 先停止已有动画
        this.stopBreathAnimation();

        const config = UIAnimations.cardsToPlayHint;
        const halfDuration = config.breathDuration / 2;

        // 使用 tween 的 onUpdate 同步驱动透明度和缩放
        // 阶段1: max -> min (呼气)
        // 阶段2: min -> max (吸气)
        this.breathTween = tween(this.node)
            .repeatForever(
                tween(this.node)
                    // 呼气: max -> min
                    .to(halfDuration, {
                        scale: new Vec3(config.minScale, config.minScale, 1)
                    }, {
                        easing: 'sineInOut',
                        onUpdate: (target, ratio) => {
                            const opacity = config.maxOpacity -
                                (config.maxOpacity - config.minOpacity) * ratio;
                            this.setOpacity(opacity);
                        }
                    })
                    // 吸气: min -> max
                    .to(halfDuration, {
                        scale: new Vec3(config.maxScale, config.maxScale, 1)
                    }, {
                        easing: 'sineInOut',
                        onUpdate: (target, ratio) => {
                            const opacity = config.minOpacity +
                                (config.maxOpacity - config.minOpacity) * ratio;
                            this.setOpacity(opacity);
                        }
                    })
            )
            .start();
    }

    /**
     * 停止呼吸动画
     */
    private stopBreathAnimation(): void {
        if (this.breathTween) {
            this.breathTween.stop();
            this.breathTween = null;
        }
    }

    /**
     * 设置 Label 透明度（通过 color.a，与 MessageTip 模式一致）
     */
    private setOpacity(opacity: number): void {
        if (this.hintLabel) {
            const color = this.hintLabel.color.clone();
            color.a = Math.round(opacity);
            this.hintLabel.color = color;
        }
    }

    /**
     * 检查是否正在显示
     */
    public isShowing(): boolean {
        return this.node.active;
    }

    onDestroy() {
        this.stopBreathAnimation();
    }
}
