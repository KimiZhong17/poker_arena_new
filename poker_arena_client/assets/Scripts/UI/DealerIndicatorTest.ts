import { _decorator, Component, Node } from 'cc';
import { PlayerUIManager } from './PlayerUIManager';

const { ccclass, property } = _decorator;

/**
 * DealerIndicatorTest - 用于测试 DealerIndicator 功能
 *
 * 使用方法：
 * 1. 将此组件添加到场景中的任意节点
 * 2. 在 Inspector 中绑定 PlayerUIManager
 * 3. 运行游戏，按空格键测试庄家指示器移动
 */
@ccclass('DealerIndicatorTest')
export class DealerIndicatorTest extends Component {
    @property(PlayerUIManager)
    public playerUIManager: PlayerUIManager | null = null;

    @property
    public autoTest: boolean = true;  // 是否自动测试

    @property
    public testDelay: number = 2;  // 自动测试间隔（秒）

    private _currentDealerIndex: number = 0;
    private _playerCount: number = 4;

    start() {
        console.log('[DealerIndicatorTest] Test component started');
        console.log('[DealerIndicatorTest] PlayerUIManager:', this.playerUIManager);
        console.log('[DealerIndicatorTest] DealerIndicator:', this.playerUIManager?.dealerIndicator);

        if (!this.playerUIManager) {
            console.error('[DealerIndicatorTest] PlayerUIManager not set! Please bind it in the Inspector.');
            return;
        }

        if (!this.playerUIManager.dealerIndicator) {
            console.error('[DealerIndicatorTest] DealerIndicator not configured in PlayerUIManager!');
            return;
        }

        this._playerCount = this.playerUIManager.getPlayerCount();
        console.log(`[DealerIndicatorTest] Player count: ${this._playerCount}`);

        // 初始显示第一个玩家为庄家
        this.scheduleOnce(() => {
            console.log('[DealerIndicatorTest] Setting initial dealer to player 0');
            this.showDealer(0, true);

            // 如果开启自动测试，开始循环
            if (this.autoTest) {
                this.schedule(this.nextDealer, this.testDelay);
            }
        }, 1);
    }

    update(deltaTime: number) {
        // 检测空格键手动切换庄家
        if (cc.systemEvent) {
            // Cocos Creator 3.x 用 input 系统
        }
    }

    /**
     * 显示指定玩家为庄家
     */
    private showDealer(index: number, immediate: boolean = false): void {
        if (!this.playerUIManager) return;

        console.log(`[DealerIndicatorTest] ======================================`);
        console.log(`[DealerIndicatorTest] Showing dealer for player ${index}`);
        console.log(`[DealerIndicatorTest] Immediate: ${immediate}`);

        try {
            this.playerUIManager.showDealer(index, immediate);
            console.log(`[DealerIndicatorTest] ✓ showDealer called successfully`);
        } catch (error) {
            console.error(`[DealerIndicatorTest] ✗ Error calling showDealer:`, error);
        }

        console.log(`[DealerIndicatorTest] ======================================`);
    }

    /**
     * 切换到下一个庄家（用于自动测试）
     */
    private nextDealer(): void {
        this._currentDealerIndex = (this._currentDealerIndex + 1) % this._playerCount;
        console.log(`[DealerIndicatorTest] AUTO TEST: Moving to next dealer ${this._currentDealerIndex}`);
        this.showDealer(this._currentDealerIndex, false);
    }

    /**
     * 手动测试：切换到下一个庄家
     */
    public testNextDealer(): void {
        this.nextDealer();
    }

    /**
     * 手动测试：隐藏庄家指示器
     */
    public testHideDealer(): void {
        console.log('[DealerIndicatorTest] Hiding dealer indicator');
        if (this.playerUIManager) {
            this.playerUIManager.hideAllDealers();
        }
    }

    /**
     * 手动测试：显示当前庄家（立即）
     */
    public testShowImmediate(): void {
        console.log('[DealerIndicatorTest] Showing dealer immediately');
        this.showDealer(this._currentDealerIndex, true);
    }

    /**
     * 手动测试：显示当前庄家（动画）
     */
    public testShowAnimated(): void {
        console.log('[DealerIndicatorTest] Showing dealer with animation');
        this.showDealer(this._currentDealerIndex, false);
    }

    onDestroy() {
        // 清理定时器
        this.unscheduleAllCallbacks();
    }
}
