import { _decorator, Component, Node, Vec3, tween, UITransform, Sprite, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

/**
 * DealerIndicator - 庄家指示器组件
 *
 * 职责：
 * - 显示庄家图标/图案
 * - 根据庄家变化自动移动到对应玩家旁边
 * - 提供平滑的移动动画
 *
 * 使用方式：
 * 1. 在场景中创建一个节点并添加此组件
 * 2. 设置图标精灵（可选）
 * 3. 调用 moveToDealerPosition() 移动到指定玩家位置
 */
@ccclass('DealerIndicator')
export class DealerIndicator extends Component {
    // ===== 属性配置 =====

    @property(Sprite)
    public iconSprite: Sprite | null = null;  // 庄家图标精灵

    @property
    public moveDuration: number = 0.5;  // 移动动画时长（秒）

    @property
    public offsetX: number = -150;  // 相对于玩家位置的X偏移

    @property
    public offsetY: number = 50;  // 相对于玩家位置的Y偏移

    // ===== 私有属性 =====
    private _currentDealerIndex: number = -1;  // 当前庄家索引
    private _isAnimating: boolean = false;  // 是否正在动画中

    /**
     * 组件初始化
     */
    protected onLoad(): void {
        console.log('[DealerIndicator] onLoad - Initializing...');
        console.log('[DealerIndicator] Node position:', this.node.position);
        console.log('[DealerIndicator] Node scale:', this.node.scale);

        // 自动查找 Sprite 组件
        if (!this.iconSprite) {
            this.iconSprite = this.node.getComponent(Sprite);
            if (!this.iconSprite) {
                this.iconSprite = this.node.addComponent(Sprite);
                console.log('[DealerIndicator] Created Sprite component');
            }
        }

        console.log('[DealerIndicator] Sprite component:', this.iconSprite);
        console.log('[DealerIndicator] Sprite frame:', this.iconSprite?.spriteFrame);

        // 默认隐藏
        this.node.active = false;

        console.log('[DealerIndicator] Initialized - node will be hidden until showDealer is called');
    }

    /**
     * 设置庄家图标
     * @param spriteFrame 图标精灵帧
     */
    public setIcon(spriteFrame: SpriteFrame): void {
        if (this.iconSprite) {
            this.iconSprite.spriteFrame = spriteFrame;
            console.log('[DealerIndicator] Icon sprite set');
        }
    }

    /**
     * 移动到庄家位置（带动画）
     * @param dealerIndex 庄家玩家索引
     * @param targetWorldPos 目标玩家的世界坐标
     * @param immediate 是否立即移动（不使用动画）
     */
    public moveToDealerPosition(
        dealerIndex: number,
        targetWorldPos: { x: number, y: number },
        immediate: boolean = false
    ): void {
        console.log(`[DealerIndicator] ========== Moving to dealer ${dealerIndex} ==========`);
        console.log(`[DealerIndicator] Target world position: (${targetWorldPos.x}, ${targetWorldPos.y})`);
        console.log(`[DealerIndicator] Offset: (${this.offsetX}, ${this.offsetY})`);
        console.log(`[DealerIndicator] Current node active: ${this.node.active}`);

        this._currentDealerIndex = dealerIndex;

        // 计算目标位置（加上偏移）
        const targetPos = new Vec3(
            targetWorldPos.x + this.offsetX,
            targetWorldPos.y + this.offsetY,
            0
        );
        console.log(`[DealerIndicator] Target position with offset: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

        // 获取父节点
        const parent = this.node.parent;
        if (!parent) {
            console.error('[DealerIndicator] No parent node found!');
            return;
        }

        console.log(`[DealerIndicator] Parent node: ${parent.name}`);

        // 检查父节点是否有 UITransform
        const parentUITransform = parent.getComponent(UITransform);
        if (!parentUITransform) {
            console.warn('[DealerIndicator] Parent node has no UITransform component!');
            console.warn('[DealerIndicator] Attempting to use world position directly...');

            // 尝试使用世界坐标直接设置
            // 这种情况下，假设节点已经在世界坐标系中
            const localPos = new Vec3(targetPos.x, targetPos.y, 0);

            if (immediate || !this.node.active) {
                this.node.setWorldPosition(targetPos);
                this.node.active = true;
                this._isAnimating = false;
                console.log(`[DealerIndicator] ✓ Set world position directly to (${targetPos.x}, ${targetPos.y})`);
            } else {
                this._isAnimating = true;
                this.node.active = true;
                tween(this.node).stop();

                // 获取当前世界坐标
                const currentWorldPos = this.node.getWorldPosition();
                console.log(`[DealerIndicator] Starting animation from world pos (${currentWorldPos.x}, ${currentWorldPos.y}) to (${targetPos.x}, ${targetPos.y})`);

                // 创建世界坐标动画
                tween({ x: currentWorldPos.x, y: currentWorldPos.y })
                    .to(this.moveDuration, { x: targetPos.x, y: targetPos.y }, {
                        easing: 'smooth',
                        onUpdate: (target: any) => {
                            this.node.setWorldPosition(target.x, target.y, 0);
                        },
                        onComplete: () => {
                            this._isAnimating = false;
                            console.log(`[DealerIndicator] ✓ Animation complete at world pos (${targetPos.x}, ${targetPos.y})`);
                        }
                    })
                    .start();
            }

            console.log(`[DealerIndicator] Final node state (world space):`);
            const finalWorldPos = this.node.getWorldPosition();
            console.log(`  - Active: ${this.node.active}`);
            console.log(`  - World Position: (${finalWorldPos.x}, ${finalWorldPos.y}, ${finalWorldPos.z})`);
            console.log(`  - Scale: (${this.node.scale.x}, ${this.node.scale.y}, ${this.node.scale.z})`);
            console.log(`  - Has Sprite: ${!!this.iconSprite}`);
            console.log(`  - Sprite Frame: ${this.iconSprite?.spriteFrame ? 'YES' : 'NO'}`);
            console.log('[DealerIndicator] ==========================================');
            return;
        }

        // 父节点有 UITransform，使用局部坐标
        const localPos = new Vec3();
        parentUITransform.convertToNodeSpaceAR(targetPos, localPos);
        console.log(`[DealerIndicator] Converted local position: (${localPos.x}, ${localPos.y}, ${localPos.z})`);

        if (immediate || !this.node.active) {
            // 立即移动（初次显示时）
            this.node.setPosition(localPos);
            this.node.active = true;
            this._isAnimating = false;
            console.log(`[DealerIndicator] ✓ Moved immediately to (${localPos.x}, ${localPos.y})`);
            console.log(`[DealerIndicator] Node is now active: ${this.node.active}`);
        } else {
            // 动画移动
            this._isAnimating = true;
            this.node.active = true;

            // 停止之前的动画
            tween(this.node).stop();

            console.log(`[DealerIndicator] Starting animation from (${this.node.position.x}, ${this.node.position.y}) to (${localPos.x}, ${localPos.y})`);

            // 创建移动动画
            tween(this.node)
                .to(this.moveDuration, { position: localPos }, {
                    easing: 'smooth',
                    onUpdate: () => {
                        // 可以在这里添加更新逻辑
                    },
                    onComplete: () => {
                        this._isAnimating = false;
                        console.log(`[DealerIndicator] ✓ Animation complete at (${localPos.x}, ${localPos.y})`);
                    }
                })
                .start();
        }

        // 最终检查
        console.log(`[DealerIndicator] Final node state:`);
        console.log(`  - Active: ${this.node.active}`);
        console.log(`  - Position: (${this.node.position.x}, ${this.node.position.y}, ${this.node.position.z})`);
        console.log(`  - Scale: (${this.node.scale.x}, ${this.node.scale.y}, ${this.node.scale.z})`);
        console.log(`  - Has Sprite: ${!!this.iconSprite}`);
        console.log(`  - Sprite Frame: ${this.iconSprite?.spriteFrame ? 'YES' : 'NO'}`);
        console.log('[DealerIndicator] ==========================================');
    }

    /**
     * 显示指示器
     */
    public show(): void {
        this.node.active = true;
        console.log('[DealerIndicator] Shown');
    }

    /**
     * 隐藏指示器
     */
    public hide(): void {
        // 停止动画
        tween(this.node).stop();
        this._isAnimating = false;
        this.node.active = false;
        this._currentDealerIndex = -1;
        console.log('[DealerIndicator] Hidden');
    }

    /**
     * 获取当前庄家索引
     */
    public getCurrentDealerIndex(): number {
        return this._currentDealerIndex;
    }

    /**
     * 是否正在动画中
     */
    public isAnimating(): boolean {
        return this._isAnimating;
    }

    /**
     * 设置偏移量
     * @param offsetX X轴偏移
     * @param offsetY Y轴偏移
     */
    public setOffset(offsetX: number, offsetY: number): void {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        console.log(`[DealerIndicator] Offset set to (${offsetX}, ${offsetY})`);
    }
}
