import { Button, Label, Node, Color } from 'cc';
import { GameStageBase } from './GameStageBase';
import { Game } from '../../Game';
import { GameStage } from '../GameStage';
import { RoomManager } from '../Room/RoomManager';
import { UserManager } from '../../Manager/UserManager';

/**
 * 准备阶段
 *
 * 职责：
 * - 显示准备阶段UI（Node_ReadyStage）
 * - 管理准备/开始按钮（btn_start）
 * - 跟踪玩家准备状态
 * - 房主显示"开始"按钮，仅当所有人准备好才可点击
 * - 非房主显示"准备"按钮，点击后变为"已准备"并禁用
 * - 所有玩家准备好后房主点击开始切换到Playing阶段
 *
 * 使用场景：
 * 1. 游戏刚开始时
 * 2. 从EndStage点击"再来一局"后
 *
 * 生命周期：
 * onEnter() -> 显示UI，注册按钮事件，重置状态
 * onExit() -> 隐藏UI，注销按钮事件
 */
export class ReadyStage extends GameStageBase {
    // UI元素
    private btnStart: Button | null = null;
    private btnLabel: Label | null = null;

    // 玩家准备状态
    // key: playerId (e.g., 'player_0', 'player_1')
    // value: 是否已准备
    private playerReadyStates: Map<string, boolean> = new Map();

    // 配置
    private totalPlayers: number = 4; // 默认4人（The Decree模式）

    // 管理器引用
    private roomManager: RoomManager;
    private userManager: UserManager;

    // 本地玩家信息
    private localPlayerId: string = '';
    private isLocalPlayerHost: boolean = false;

    constructor(game: Game, rootNode: Node | null = null) {
        super(game, rootNode);
        this.roomManager = RoomManager.getInstance();
        this.userManager = UserManager.getInstance();
    }

    /**
     * 进入准备阶段
     */
    public onEnter(): void {
        console.log('[ReadyStage] Entering ready stage');
        this.isActive = true;

        // 1. 获取本地玩家信息
        this.initLocalPlayerInfo();

        // 2. 重置状态
        this.resetReadyStates();

        // 3. 显示UI
        this.showUI();

        // 4. 设置按钮事件
        this.setupButtons();

        // 5. 更新按钮显示
        this.updateButtonDisplay();

        console.log('[ReadyStage] Waiting for players to ready up...');
        console.log(`[ReadyStage] Local player: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}`);
    }

    /**
     * 初始化本地玩家信息
     */
    private initLocalPlayerInfo(): void {
        const currentRoom = this.roomManager.getCurrentRoom();
        const currentUser = this.userManager.getCurrentUser();

        if (currentUser) {
            this.localPlayerId = currentUser.id;
        } else {
            // 单机模式：默认为 player_0
            this.localPlayerId = 'player_0';
        }

        if (currentRoom) {
            // 多人模式：检查是否是房主
            const localPlayer = currentRoom.players.find(p => p.id === this.localPlayerId);
            this.isLocalPlayerHost = localPlayer?.isHost || false;
            this.totalPlayers = currentRoom.maxPlayers;
        } else {
            // 单机模式：默认为房主
            this.isLocalPlayerHost = true;
            this.totalPlayers = 4;
        }

        console.log(`[ReadyStage] Local player initialized: ${this.localPlayerId}, isHost: ${this.isLocalPlayerHost}, totalPlayers: ${this.totalPlayers}`);
    }

    /**
     * 离开准备阶段
     */
    public onExit(): void {
        console.log('[ReadyStage] Exiting ready stage');

        // 1. 清理按钮事件
        this.cleanupButtons();

        // 2. 调用基类的 onExit（会自动隐藏UI）
        super.onExit();
    }

    /**
     * 显示准备阶段UI
     */
    public showUI(): void {
        if (this.rootNode) {
            this.rootNode.active = true;
            console.log('[ReadyStage] UI shown');
        } else {
            console.warn('[ReadyStage] Root node not set, cannot show UI');
        }
    }

    /**
     * 隐藏准备阶段UI
     */
    public hideUI(): void {
        if (this.rootNode) {
            this.rootNode.active = false;
            console.log('[ReadyStage] UI hidden');
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        console.log('[ReadyStage] Cleaning up');
        this.cleanupButtons();
        this.playerReadyStates.clear();
    }

    // ==================== 私有方法 ====================

    /**
     * 重置所有玩家的准备状态
     */
    private resetReadyStates(): void {
        this.playerReadyStates.clear();

        // 在单机模式下，使用实际的玩家ID
        const currentRoom = this.roomManager.getCurrentRoom();

        if (currentRoom) {
            // 多人模式：使用房间中的玩家ID
            for (const player of currentRoom.players) {
                this.playerReadyStates.set(player.id, false);
            }
            console.log(`[ReadyStage] Reset ready states for ${currentRoom.players.length} players in room`);
        } else {
            // 单机模式：使用本地玩家ID和模拟玩家
            this.playerReadyStates.set(this.localPlayerId, false);

            // 添加其他模拟玩家（用于单机测试）
            for (let i = 1; i < this.totalPlayers; i++) {
                this.playerReadyStates.set(`player_${i}`, false);
            }
            console.log(`[ReadyStage] Reset ready states for ${this.totalPlayers} players (single player mode)`);
        }
    }

    /**
     * 设置按钮事件
     */
    private setupButtons(): void {
        if (!this.rootNode) {
            console.warn('[ReadyStage] Cannot setup buttons: root node not set');
            return;
        }

        // 查找开始按钮
        this.btnStart = this.findStartButton();

        if (this.btnStart) {
            // 查找按钮上的 Label 组件（用于显示文字）
            this.btnLabel = this.btnStart.node.getComponentInChildren(Label);

            if (!this.btnLabel) {
                console.warn('[ReadyStage] No label found on start button, text will not be updated');
            } else {
                console.log('[ReadyStage] Found label on start button');
            }

            // 注册点击事件
            this.btnStart.node.on(Button.EventType.CLICK, this.onStartButtonClicked, this);
            console.log('[ReadyStage] Start button registered');
        } else {
            console.warn('[ReadyStage] Start button not found');
        }
    }

    /**
     * 更新按钮显示（文字和可用状态）
     * 只修改文字内容和按钮交互状态，保留原有的样式设置
     */
    private updateButtonDisplay(): void {
        if (!this.btnStart) {
            return;
        }

        if (this.isLocalPlayerHost) {
            // 房主显示"开始"
            if (this.btnLabel) {
                this.btnLabel.string = '开 始';
            }

            // 检查是否所有非房主玩家都已准备
            const allReady = this.allNonHostPlayersReady();

            // 控制按钮是否可点击
            this.btnStart.interactable = allReady;

            if (allReady) {
                console.log('[ReadyStage] All players ready! Host can start game');
            } else {
                const readyCount = this.getReadyPlayerCount();
                console.log(`[ReadyStage] Waiting for players: ${readyCount}/${this.totalPlayers - 1} ready`);
            }
        } else {
            // 非房主显示"准备"或"已准备"
            const isReady = this.playerReadyStates.get(this.localPlayerId) || false;

            if (isReady) {
                if (this.btnLabel) {
                    this.btnLabel.string = '已准备';
                }
                this.btnStart.interactable = false; // 禁用按钮
            } else {
                if (this.btnLabel) {
                    this.btnLabel.string = '准 备';
                }
                this.btnStart.interactable = true; // 启用按钮
            }
        }
    }

    /**
     * 清理按钮事件
     */
    private cleanupButtons(): void {
        if (this.btnStart) {
            this.btnStart.node.off(Button.EventType.CLICK, this.onStartButtonClicked, this);
            this.btnStart = null;
            console.log('[ReadyStage] Start button unregistered');
        }
    }

    /**
     * 查找开始按钮
     * 尝试多种方式查找：
     * 1. 直接通过名称查找 'btn_start'
     * 2. 查找子节点中的Button组件
     */
    private findStartButton(): Button | null {
        if (!this.rootNode) return null;

        // 方式1: 通过名称查找
        const btnNode = this.rootNode.getChildByName('btn_start');
        if (btnNode) {
            const button = btnNode.getComponent(Button);
            if (button) {
                console.log('[ReadyStage] Found start button by name: btn_start');
                return button;
            }
        }

        // 方式2: 遍历所有子节点查找第一个Button组件
        for (const child of this.rootNode.children) {
            const button = child.getComponent(Button);
            if (button) {
                console.log(`[ReadyStage] Found start button by component: ${child.name}`);
                return button;
            }
        }

        return null;
    }

    /**
     * 开始按钮点击回调
     */
    private onStartButtonClicked(): void {
        console.log('[ReadyStage] Start button clicked');

        if (this.isLocalPlayerHost) {
            // 房主点击"开始游戏"
            if (this.allNonHostPlayersReady()) {
                console.log('[ReadyStage] Host starting game...');
                this.startGame();
            } else {
                console.warn('[ReadyStage] Cannot start: not all players are ready');
            }
        } else {
            // 非房主点击"准备"
            this.onPlayerReady(this.localPlayerId);
        }
    }

    /**
     * 玩家准备
     * @param playerId 玩家ID
     */
    private onPlayerReady(playerId: string): void {
        // 检查玩家是否存在
        if (!this.playerReadyStates.has(playerId)) {
            console.warn(`[ReadyStage] Unknown player: ${playerId}`);
            return;
        }

        // 房主不需要准备
        if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
            console.warn('[ReadyStage] Host does not need to ready up');
            return;
        }

        // 标记为已准备
        this.playerReadyStates.set(playerId, true);
        console.log(`[ReadyStage] Player ${playerId} is ready`);

        // 更新按钮显示
        this.updateButtonDisplay();

        // 如果是多人模式，通知 RoomManager
        const currentRoom = this.roomManager.getCurrentRoom();
        if (currentRoom) {
            this.roomManager.setPlayerReady(playerId, true);
        }

        // 显示进度信息
        const readyCount = this.getReadyPlayerCount();
        const totalNonHost = this.totalPlayers - 1;
        console.log(`[ReadyStage] ${readyCount}/${totalNonHost} players ready`);
    }

    /**
     * 检查是否所有非房主玩家都准备好
     */
    private allNonHostPlayersReady(): boolean {
        // 在单机模式下，如果是房主，直接返回 true
        if (this.totalPlayers === 1 || !this.roomManager.getCurrentRoom()) {
            return true;
        }

        // 检查所有非房主玩家是否准备
        for (const [playerId, isReady] of this.playerReadyStates) {
            // 跳过房主
            if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
                continue;
            }

            if (!isReady) {
                return false;
            }
        }

        return true;
    }

    /**
     * 检查是否所有玩家都准备好（旧方法，保留兼容性）
     */
    private allPlayersReady(): boolean {
        return this.allNonHostPlayersReady();
    }

    /**
     * 获取已准备的玩家数量（不包括房主）
     */
    private getReadyPlayerCount(): number {
        let count = 0;
        for (const [playerId, isReady] of this.playerReadyStates) {
            // 跳过房主
            if (playerId === this.localPlayerId && this.isLocalPlayerHost) {
                continue;
            }

            if (isReady) {
                count++;
            }
        }
        return count;
    }

    /**
     * 开始游戏
     * 切换到Playing阶段
     */
    private startGame(): void {
        console.log('[ReadyStage] Switching to Playing stage...');

        // 通过StageManager切换到Playing阶段
        const stageManager = this.game.stageManager;
        if (stageManager) {
            stageManager.switchToStage(GameStage.PLAYING);
        } else {
            console.error('[ReadyStage] StageManager not found on Game!');
        }
    }

    // ==================== 公共接口（供外部调用）====================

    /**
     * 设置总玩家数
     * 通常在多人游戏中使用
     * @param count 玩家数量
     */
    public setTotalPlayers(count: number): void {
        if (count < 1) {
            console.warn('[ReadyStage] Total players must be at least 1');
            return;
        }

        this.totalPlayers = count;
        console.log(`[ReadyStage] Total players set to ${count}`);

        // 如果已经进入阶段，重置状态
        if (this.isActive) {
            this.resetReadyStates();
        }
    }

    /**
     * 手动标记玩家为准备状态
     * 用于网络同步或测试
     * @param playerId 玩家ID
     */
    public markPlayerReady(playerId: string): void {
        this.onPlayerReady(playerId);
    }

    /**
     * 获取玩家准备状态
     * @param playerId 玩家ID
     */
    public isPlayerReady(playerId: string): boolean {
        return this.playerReadyStates.get(playerId) || false;
    }

    /**
     * 获取所有玩家的准备状态
     */
    public getAllReadyStates(): Map<string, boolean> {
        return new Map(this.playerReadyStates);
    }
}
