import { _decorator, Component } from 'cc';
import { ReadyStage } from '../Core/Stage/ReadyStage';
const { ccclass, property } = _decorator;

/**
 * ReadyStage 测试工具
 * 用于测试房主和非房主的不同交互
 *
 * 使用方法：
 * 1. 将此组件添加到 Canvas 节点
 * 2. 设置 testAsNonHost 为 true 测试非房主模式
 * 3. 运行游戏查看效果
 */
@ccclass('ReadyStageTestHelper')
export class ReadyStageTestHelper extends Component {

    @property({
        tooltip: '测试非房主模式（勾选后玩家变为非房主，看到"准备"按钮）'
    })
    public testAsNonHost: boolean = false;

    @property({
        tooltip: '模拟其他玩家准备状态（勾选后模拟所有其他玩家已准备）'
    })
    public simulateOthersReady: boolean = false;

    start() {
        console.log('[ReadyStageTestHelper] Test helper active');
        console.log(`[ReadyStageTestHelper] Test as non-host: ${this.testAsNonHost}`);
        console.log(`[ReadyStageTestHelper] Simulate others ready: ${this.simulateOthersReady}`);
    }

    /**
     * 获取是否测试非房主模式
     */
    public isTestingNonHost(): boolean {
        return this.testAsNonHost;
    }

    /**
     * 获取是否模拟其他玩家已准备
     */
    public isSimulatingOthersReady(): boolean {
        return this.simulateOthersReady;
    }

    /**
     * 全局单例访问
     */
    private static _instance: ReadyStageTestHelper | null = null;

    public static getInstance(): ReadyStageTestHelper | null {
        return ReadyStageTestHelper._instance;
    }

    onLoad() {
        ReadyStageTestHelper._instance = this;
    }

    onDestroy() {
        if (ReadyStageTestHelper._instance === this) {
            ReadyStageTestHelper._instance = null;
        }
    }
}
