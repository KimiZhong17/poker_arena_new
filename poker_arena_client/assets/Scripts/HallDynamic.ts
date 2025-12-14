import { _decorator, Component, Node, Button, Label, Prefab, instantiate, ScrollView } from 'cc';
import { SceneManager } from './Manager/SceneManager';
import { UserManager } from './Manager/UserManager';
import { GameModeFactory } from './Core/GameMode/GameModeFactory';

const { ccclass, property } = _decorator;

/**
 * Game mode display information
 */
interface GameModeInfo {
    id: string;
    displayName: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    icon?: string; // 游戏图标路径（可选）
}

/**
 * Hall Scene - Dynamic Game List Version
 * 动态生成游戏列表，易于扩展
 */
@ccclass('HallDynamic')
export class HallDynamic extends Component {
    @property(Label)
    welcomeLabel: Label = null!;

    @property(ScrollView)
    gameListScrollView: ScrollView = null!;

    @property(Node)
    gameListContent: Node = null!;

    @property(Prefab)
    gameItemPrefab: Prefab = null!;

    @property(Button)
    logoutButton: Button = null!;

    private userManager: UserManager = null!;
    private sceneManager: SceneManager = null!;

    // 游戏模式数据（易于扩展）
    private gameModes: GameModeInfo[] = [
        {
            id: 'the_decree',
            displayName: 'The Decree',
            description: 'Dealer sets the number, you set the winner.',
            minPlayers: 2,
            maxPlayers: 4
        },
        {
            id: 'guandan',
            displayName: 'Guandan (掼蛋)',
            description: 'Classic card game with strategic combinations.',
            minPlayers: 5,
            maxPlayers: 5
        }
        // 添加新游戏只需在这里添加数据！
    ];

    start() {
        this.userManager = UserManager.getInstance();
        this.sceneManager = SceneManager.getInstance();

        // Check if user is logged in
        if (!this.userManager.isUserLoggedIn()) {
            console.warn('[Hall] User not logged in, redirecting to login');
            this.sceneManager.goToLogin();
            return;
        }

        this.setupUI();
        this.setupButtons();
        this.loadGameList();
    }

    private setupUI(): void {
        // Display welcome message
        const username = this.userManager.getUsername();
        if (this.welcomeLabel) {
            this.welcomeLabel.string = `Welcome, ${username}!`;
        }
    }

    private setupButtons(): void {
        // Logout button
        if (this.logoutButton?.node) {
            this.logoutButton.node.on(Button.EventType.CLICK, this.onLogoutClicked, this);
        }
    }

    /**
     * 动态加载游戏列表
     */
    private loadGameList(): void {
        if (!this.gameItemPrefab || !this.gameListContent) {
            console.error('[Hall] Game item prefab or content node not set');
            return;
        }

        // 清空现有列表
        this.gameListContent.removeAllChildren();

        // 为每个游戏创建一个列表项
        this.gameModes.forEach((gameMode) => {
            this.createGameItem(gameMode);
        });
    }

    /**
     * 创建游戏列表项
     */
    private createGameItem(gameModeInfo: GameModeInfo): void {
        const gameItem = instantiate(this.gameItemPrefab);

        // 设置游戏信息（假设 Prefab 有相应的脚本组件）
        const itemScript = gameItem.getComponent('GameItem');
        if (itemScript && typeof (itemScript as any).setGameInfo === 'function') {
            (itemScript as any).setGameInfo(gameModeInfo);
        }

        // 添加点击事件
        const button = gameItem.getComponent(Button);
        if (button) {
            button.node.on(Button.EventType.CLICK, () => {
                this.onGameItemClicked(gameModeInfo);
            }, this);
        }

        this.gameListContent.addChild(gameItem);
    }

    /**
     * 处理游戏项点击
     */
    private onGameItemClicked(gameModeInfo: GameModeInfo): void {
        console.log(`[Hall] Game selected: ${gameModeInfo.displayName}`);

        // 验证游戏模式存在
        const factory = GameModeFactory.getInstance();
        if (!factory.hasMode(gameModeInfo.id)) {
            console.error(`[Hall] Game mode not registered: ${gameModeInfo.id}`);
            return;
        }

        // 保存选择
        this.userManager.setSelectedGameMode(gameModeInfo.id);

        // 跳转到 Lobby
        this.sceneManager.goToLobby({
            gameMode: gameModeInfo.id,
            minPlayers: gameModeInfo.minPlayers,
            maxPlayers: gameModeInfo.maxPlayers
        });
    }

    /**
     * 退出登录
     */
    private onLogoutClicked(): void {
        console.log('[Hall] Logout clicked');
        this.userManager.logout();
        this.sceneManager.goToLogin();
    }

    onDestroy() {
        if (this.logoutButton?.node && this.logoutButton.isValid) {
            this.logoutButton.node.off(Button.EventType.CLICK, this.onLogoutClicked, this);
        }
    }
}
