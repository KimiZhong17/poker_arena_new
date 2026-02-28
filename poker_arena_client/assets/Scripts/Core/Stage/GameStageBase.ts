import { Node } from 'cc';
import { Game } from '../../Scenes/Game';
import { logger } from '../../Utils/Logger';

const log = logger('Stage');

/**
 * 游戏阶段基类
 * 所有阶段（Ready、Playing、End）都必须继承此类
 *
 * 职责：
 * - 管理阶段的生命周期（进入、离开、更新）
 * - 控制阶段相关UI的显示和隐藏
 * - 提供清理资源的接口
 */
export abstract class GameStageBase {
    protected game: Game;
    protected rootNode: Node | null;
    protected isActive: boolean = false;

    /**
     * 构造函数
     * @param game Game主类引用，用于访问全局资源和管理器
     * @param rootNode 此阶段的根节点（可选），用于管理UI
     */
    constructor(game: Game, rootNode: Node | null = null) {
        this.game = game;
        this.rootNode = rootNode;
    }

    /**
     * 进入此阶段时调用
     * 实现此方法时应该：
     * 1. 显示阶段UI
     * 2. 初始化阶段状态
     * 3. 注册事件监听
     * 4. 开始阶段逻辑
     */
    abstract onEnter(): void;

    /**
     * 离开此阶段时调用
     * 默认会自动隐藏UI，子类可以覆盖此方法添加额外的清理逻辑
     * 实现此方法时应该：
     * 1. 清理阶段状态
     * 2. 注销事件监听
     * 3. 停止阶段逻辑
     * 注意：不需要手动调用 hideUI()，会自动调用
     */
    public onExit(): void {
        log.debug(`[${this.constructor.name}] Exiting stage`);
        this.isActive = false;
        this.hideUI();  // 自动隐藏 UI
    }

    /**
     * 每帧更新（可选实现）
     * 如果阶段需要逐帧更新逻辑，可以覆盖此方法
     * @param deltaTime 距离上一帧的时间间隔（秒）
     */
    update?(deltaTime: number): void;

    /**
     * 显示此阶段的UI
     * 通常在 onEnter() 中调用
     */
    abstract showUI(): void;

    /**
     * 隐藏此阶段的UI
     * 通常在 onExit() 中调用
     */
    abstract hideUI(): void;

    /**
     * 清理资源
     * 在阶段不再使用时调用，用于释放内存
     */
    abstract cleanup(): void;

    /**
     * 检查此阶段是否活跃
     */
    public isStageActive(): boolean {
        return this.isActive;
    }

    /**
     * 设置根节点
     * 可以在构造后动态设置
     */
    public setRootNode(node: Node): void {
        this.rootNode = node;
    }

    /**
     * 获取根节点
     */
    public getRootNode(): Node | null {
        return this.rootNode;
    }
}
