import { _decorator, Component, Node, Vec3, tween, UITransform, Sprite, SpriteFrame } from 'cc';
import { logger } from '../Utils/Logger';

const log = logger('DealerIndicator');

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
        log.debug('onLoad - Initializing...');
        log.debug('Node position:', this.node.position);
        log.debug('Node scale:', this.node.scale);

        // 自动查找 Sprite 组件
        if (!this.iconSprite) {
            this.iconSprite = this.node.getComponent(Sprite);
            if (!this.iconSprite) {
                this.iconSprite = this.node.addComponent(Sprite);
                log.debug('Created Sprite component');
            }
        }

        log.debug('Sprite component:', this.iconSprite);
        log.debug('Sprite frame:', this.iconSprite?.spriteFrame);

        // 默认隐藏
        this.node.active = false;

        log.debug('Initialized - node will be hidden until showDealer is called');
    }

    /**
     * 设置庄家图标
     * @param spriteFrame 图标精灵帧
     */
    public setIcon(spriteFrame: SpriteFrame): void {
        if (this.iconSprite) {
            this.iconSprite.spriteFrame = spriteFrame;
            log.debug('Icon sprite set');
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
        log.debug(`========== Moving to dealer ${dealerIndex} ==========`);
        log.debug(`Target world position: (${targetWorldPos.x}, ${targetWorldPos.y})`);
        log.debug(`Offset: (${this.offsetX}, ${this.offsetY})`);
        log.debug(`Current node active: ${this.node.active}`);

        this._currentDealerIndex = dealerIndex;

        // 计算目标位置（加上偏移）
        const targetPos = new Vec3(
            targetWorldPos.x + this.offsetX,
            targetWorldPos.y + this.offsetY,
            0
        );
        log.debug(`Target position with offset: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

        // 获取父节点
        const parent = this.node.parent;
        if (!parent) {
            log.error('No parent node found!');
            return;
        }

        log.debug(`Parent node: ${parent.name}`);

        // 检查父节点是否有 UITransform
        const parentUITransform = parent.getComponent(UITransform);
        if (!parentUITransform) {
            log.warn('Parent node has no UITransform component!');
            log.warn('Attempting to use world position directly...');

            // 尝试使用世界坐标直接设置
            // 这种情况下，假设节点已经在世界坐标系中
            const localPos = new Vec3(targetPos.x, targetPos.y, 0);

            if (immediate || !this.node.active) {
                this.node.setWorldPosition(targetPos);
                this.node.active = true;
                this._isAnimating = false;
                log.debug(`✓ Set world position directly to (${targetPos.x}, ${targetPos.y})`);
            } else {
                this._isAnimating = true;
                this.node.active = true;
                tween(this.node).stop();

                // 获取当前世界坐标
                const currentWorldPos = this.node.getWorldPosition();
                log.debug(`Starting animation from world pos (${currentWorldPos.x}, ${currentWorldPos.y}) to (${targetPos.x}, ${targetPos.y})`);

                // 创建世界坐标动画
                tween({ x: currentWorldPos.x, y: currentWorldPos.y })
                    .to(this.moveDuration, { x: targetPos.x, y: targetPos.y }, {
                        easing: 'smooth',
                        onUpdate: (target: any) => {
                            this.node.setWorldPosition(target.x, target.y, 0);
                        },
                        onComplete: () => {
                            this._isAnimating = false;
                            log.debug(`✓ Animation complete at world pos (${targetPos.x}, ${targetPos.y})`);
                        }
                    })
                    .start();
            }

            log.debug(`Final node state (world space):`);
            const finalWorldPos = this.node.getWorldPosition();
            log.debug(`  - Active: ${this.node.active}`);
            log.debug(`  - World Position: (${finalWorldPos.x}, ${finalWorldPos.y}, ${finalWorldPos.z})`);
            log.debug(`  - Scale: (${this.node.scale.x}, ${this.node.scale.y}, ${this.node.scale.z})`);
            log.debug(`  - Has Sprite: ${!!this.iconSprite}`);
            log.debug(`  - Sprite Frame: ${this.iconSprite?.spriteFrame ? 'YES' : 'NO'}`);
            log.debug('==========================================');
            return;
        }

        // 父节点有 UITransform，使用局部坐标
        const localPos = new Vec3();
        parentUITransform.convertToNodeSpaceAR(targetPos, localPos);
        log.debug(`Converted local position: (${localPos.x}, ${localPos.y}, ${localPos.z})`);

        if (immediate || !this.node.active) {
            // 立即移动（初次显示时）
            this.node.setPosition(localPos);
            this.node.active = true;
            this._isAnimating = false;
            log.debug(`✓ Moved immediately to (${localPos.x}, ${localPos.y})`);
            log.debug(`Node is now active: ${this.node.active}`);
        } else {
            // 动画移动
            this._isAnimating = true;
            this.node.active = true;

            // 停止之前的动画
            tween(this.node).stop();

            log.debug(`Starting animation from (${this.node.position.x}, ${this.node.position.y}) to (${localPos.x}, ${localPos.y})`);

            // 创建移动动画
            tween(this.node)
                .to(this.moveDuration, { position: localPos }, {
                    easing: 'smooth',
                    onUpdate: () => {
                        // 可以在这里添加更新逻辑
                    },
                    onComplete: () => {
                        this._isAnimating = false;
                        log.debug(`✓ Animation complete at (${localPos.x}, ${localPos.y})`);
                    }
                })
                .start();
        }

        // 最终检查
        log.debug(`Final node state:`);
        log.debug(`  - Active: ${this.node.active}`);
        log.debug(`  - Position: (${this.node.position.x}, ${this.node.position.y}, ${this.node.position.z})`);
        log.debug(`  - Scale: (${this.node.scale.x}, ${this.node.scale.y}, ${this.node.scale.z})`);
        log.debug(`  - Has Sprite: ${!!this.iconSprite}`);
        log.debug(`  - Sprite Frame: ${this.iconSprite?.spriteFrame ? 'YES' : 'NO'}`);
        log.debug('==========================================');
    }

    /**
     * 显示指示器
     */
    public show(): void {
        this.node.active = true;
        log.debug('Shown');
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
        log.debug('Hidden');
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
        log.debug(`Offset set to (${offsetX}, ${offsetY})`);
    }
}
