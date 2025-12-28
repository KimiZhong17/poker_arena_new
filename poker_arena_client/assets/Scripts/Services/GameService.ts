import { NetworkClient } from '../Network/NetworkClient';
import { ClientMessageType } from '../Network/Messages';

/**
 * GameService - 游戏服务
 *
 * 职责：
 * - 处理所有游戏玩法相关的网络请求
 * - 出牌、叫牌、过牌等游戏操作
 * - 不同游戏模式共用的通用接口
 *
 * 注意：
 * - 不负责游戏状态管理（由 GameModeClient 负责）
 * - 只负责发送请求，接收响应由各个 Stage 监听
 */
export class GameService {
    private static instance: GameService;
    private networkClient: NetworkClient | null = null;

    private constructor() {}

    public static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService();
        }
        return GameService.instance;
    }

    /**
     * 设置网络客户端
     */
    public setNetworkClient(client: NetworkClient): void {
        this.networkClient = client;
    }

    // ==================== The Decree 模式相关 ====================

    /**
     * 庄家叫牌
     * @param cardsToPlay 要打的牌数 (1, 2, 或 3)
     */
    public dealerCall(cardsToPlay: 1 | 2 | 3): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot dealer call: not connected');
            return;
        }

        console.log('[GameService] Dealer call:', cardsToPlay);

        // TODO: 实现 dealerCall 方法
        // this.networkClient.emit(ClientMessageType.DEALER_CALL, { cardsToPlay });
    }

    /**
     * 出牌
     * @param cards 要打出的牌（牌的编码数组）
     */
    public playCards(cards: number[]): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot play cards: not connected');
            return;
        }

        console.log('[GameService] Play cards:', cards);

        // TODO: 实现 playCards 方法
        // this.networkClient.emit(ClientMessageType.PLAY_CARDS, { cards });
    }

    // ==================== Guandan 模式相关 ====================

    /**
     * 过牌
     * 只在 Guandan 模式中使用
     */
    public pass(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot pass: not connected');
            return;
        }

        console.log('[GameService] Pass');

        // TODO: 添加 PASS 消息类型
        // this.networkClient.emit('pass');
    }

    // ==================== 通用游戏操作 ====================

    /**
     * 投降/认输
     */
    public surrender(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot surrender: not connected');
            return;
        }

        console.log('[GameService] Surrender');

        // TODO: 添加 SURRENDER 消息类型
        // this.networkClient.emit('surrender');
    }

    /**
     * 请求提示
     * 向服务器请求可以打出的牌型提示
     */
    public requestHint(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot request hint: not connected');
            return;
        }

        console.log('[GameService] Request hint');

        // TODO: 添加 REQUEST_HINT 消息类型
        // this.networkClient.emit('request_hint');
    }

    /**
     * 准备下一轮
     * 在回合结束后，准备进入下一轮
     */
    public readyForNextRound(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[GameService] Cannot ready for next round: not connected');
            return;
        }

        console.log('[GameService] Ready for next round');

        // TODO: 添加消息类型
        // this.networkClient.emit('ready_next_round');
    }
}
