import { NetworkClient } from '../Network/NetworkClient';
import { LocalPlayerStore } from '../LocalStore/LocalPlayerStore';
import { LocalRoomStore } from '../LocalStore/LocalRoomStore';
import { ClientMessageType } from '../Network/Messages';

/**
 * RoomService - 房间服务
 *
 * 职责：
 * - 处理所有房间相关的网络请求
 * - 创建/加入/离开房间
 * - 玩家准备/开始游戏
 *
 * 注意：
 * - 不负责本地房间状态存储（由 LocalRoomStore 负责）
 * - LocalRoomStore 会自动监听网络事件并同步状态
 */
export class RoomService {
    private static instance: RoomService;
    private networkClient: NetworkClient | null = null;
    private localPlayerStore: LocalPlayerStore;
    private localRoomStore: LocalRoomStore;

    private constructor() {
        this.localPlayerStore = LocalPlayerStore.getInstance();
        this.localRoomStore = LocalRoomStore.getInstance();
    }

    public static getInstance(): RoomService {
        if (!RoomService.instance) {
            RoomService.instance = new RoomService();
        }
        return RoomService.instance;
    }

    /**
     * 设置网络客户端
     * 在需要网络通信的场景中调用
     */
    public setNetworkClient(client: NetworkClient): void {
        this.networkClient = client;

        // 绑定 LocalRoomStore 的自动同步
        this.localRoomStore.bindNetworkEvents(client);
    }

    // ==================== 房间管理接口 ====================

    /**
     * 创建房间
     * @param gameMode 游戏模式 (e.g., 'the_decree', 'guandan')
     * @param maxPlayers 最大玩家数
     */
    public createRoom(gameMode: string, maxPlayers: number): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[RoomService] Cannot create room: not connected to server');
            return;
        }

        const playerName = this.localPlayerStore.getUsername();

        console.log('[RoomService] Creating room:', { playerName, gameMode, maxPlayers });
        this.networkClient.createRoom(playerName, gameMode as any, maxPlayers);
    }

    /**
     * 加入房间
     * @param roomId 房间ID (4位数字)
     */
    public joinRoom(roomId: string): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[RoomService] Cannot join room: not connected to server');
            return;
        }

        const playerName = this.localPlayerStore.getUsername();

        console.log('[RoomService] Joining room:', { roomId, playerName });
        this.networkClient.joinRoom(roomId, playerName);
    }

    /**
     * 离开房间
     */
    public leaveRoom(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.warn('[RoomService] Cannot leave room: not connected to server');
            return;
        }

        console.log('[RoomService] Leaving room');
        this.networkClient.leaveRoom();

        // 清理本地房间状态
        this.localRoomStore.clearCurrentRoom();
        this.localPlayerStore.clearCurrentRoomPlayerId();
    }

    /**
     * 切换准备状态
     * 非房主玩家点击"准备"按钮时调用
     */
    public toggleReady(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[RoomService] Cannot toggle ready: not connected to server');
            return;
        }

        console.log('[RoomService] Toggling ready state');
        this.networkClient.toggleReady();
    }

    /**
     * 开始游戏
     * 仅房主可调用
     */
    public startGame(): void {
        if (!this.networkClient || !this.networkClient.getIsConnected()) {
            console.error('[RoomService] Cannot start game: not connected to server');
            return;
        }

        const currentRoom = this.localRoomStore.getCurrentRoom();
        if (!currentRoom) {
            console.error('[RoomService] Cannot start game: not in a room');
            return;
        }

        const myPlayerId = this.localPlayerStore.getCurrentRoomPlayerId();
        const isHost = currentRoom.hostId === myPlayerId;

        if (!isHost) {
            console.error('[RoomService] Cannot start game: not the host');
            return;
        }

        console.log('[RoomService] Starting game');
        this.networkClient.startGame();
    }

    // ==================== 状态查询接口 ====================

    /**
     * 检查是否在房间内
     */
    public isInRoom(): boolean {
        return this.localRoomStore.getCurrentRoom() !== null;
    }

    /**
     * 检查是否是房主
     */
    public isHost(): boolean {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        if (!currentRoom) return false;

        const myPlayerId = this.localPlayerStore.getCurrentRoomPlayerId();
        return currentRoom.hostId === myPlayerId;
    }

    /**
     * 获取当前房间ID
     */
    public getCurrentRoomId(): string | null {
        const currentRoom = this.localRoomStore.getCurrentRoom();
        return currentRoom?.id || null;
    }
}
