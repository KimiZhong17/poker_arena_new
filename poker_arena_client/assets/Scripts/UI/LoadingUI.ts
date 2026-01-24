import { _decorator, Component, Node, Label, Sprite, UIOpacity, Color, ProgressBar } from 'cc';

const { ccclass, property } = _decorator;

/**
 * LoadingUI - 加载进度界面组件
 *
 * 功能：
 * - 显示加载进度百分比
 * - 显示加载提示文字
 * - 进度条动画
 * - 淡入淡出效果
 *
 * 使用方法：
 * 1. 在场景中创建 Node_LoadingUI 节点（添加 UITransform 组件）
 * 2. 添加此组件到 Node_LoadingUI
 * 3. 在编辑器中配置子节点引用
 * 4. 在代码中调用 show() / updateProgress() / hide()
 *
 * 节点结构（简化版）：
 * Node_LoadingUI (UITransform + LoadingUI 组件)
 * ├── Bg_Loading (Sprite) - 背景
 * ├── progressive bar (Sprite, Filled Mode) - 进度条
 * └── loadingTips (Label, 可选) - 提示文字
 */
@ccclass('LoadingUI')
export class LoadingUI extends Component {
    // 背景节点（可选）
    @property(Sprite)
    background: Sprite | null = null;

    // 进度条（ProgressBar 组件）
    @property(ProgressBar)
    progressBar: ProgressBar | null = null;

    // 提示文字（可选）
    @property(Label)
    tipLabel: Label | null = null;

    private currentProgress: number = 0;
    private _isShowing: boolean = false; // 🎯 标记是否正在显示

    onLoad() {
        // 初始化进度条为 0
        if (this.progressBar) {
            this.progressBar.progress = 0;
        }

        // 只有在没有显示的情况下才隐藏
        if (!this._isShowing) {
            this.node.active = false;
        }
    }

    /**
     * 显示加载界面
     */
    public show(): void {
        this._isShowing = true;
        this.node.active = true;
        this.currentProgress = 0;
        this.updateDisplay();

        // 确保完全不透明
        const uiOpacity = this.node.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
        }
    }

    /**
     * 隐藏加载界面
     */
    public hide(): void {
        this._isShowing = false;
        this.node.active = false;
    }

    /**
     * 更新加载进度
     * @param progress 进度值 0-1
     * @param tip 可选的提示文字
     */
    public updateProgress(progress: number, tip?: string): void {
        this.currentProgress = Math.max(0, Math.min(1, progress));

        if (tip && this.tipLabel) {
            this.tipLabel.string = tip;
        }

        this.updateDisplay();
    }

    /**
     * 更新显示
     */
    private updateDisplay(): void {
        if (this.progressBar) {
            this.progressBar.progress = this.currentProgress;
        }
    }

    /**
     * 设置进度条颜色
     * @param color 颜色
     */
    public setProgressBarColor(color: Color): void {
        if (this.progressBar) {
            // ProgressBar 的颜色在 Bar 子节点的 Sprite 上
            const barSprite = this.progressBar.barSprite;
            if (barSprite) {
                barSprite.color = color;
            }
        }
    }

    /**
     * 重置进度
     */
    public reset(): void {
        this.currentProgress = 0;
        this.updateDisplay();

        if (this.tipLabel) {
            this.tipLabel.string = '正在加载...';
        }
    }
}
