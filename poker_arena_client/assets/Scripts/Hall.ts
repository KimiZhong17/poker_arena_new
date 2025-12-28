import { _decorator, Component, Node, Button, Label } from 'cc';
import { SceneManager } from './SceneManager';
import { AuthService } from './Services/AuthService';
import { LocalPlayerStore } from './LocalStore/LocalPlayerStore';
import { GameModeClientFactory } from './Core/GameMode/GameModeClientFactory';

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
}

/**
 * Hall Scene - Game Mode Selection
 * Players choose which game mode they want to play
 */
@ccclass('Hall')
export class Hall extends Component {
    @property(Node)
    theDecreeButton: Node = null!;

    @property(Node)
    guandanButton: Node = null!;

    @property(Button)
    logoutButton: Button = null!;

    @property(Label)
    welcomeLabel: Label = null!;

    private authService: AuthService = null!;
    private localPlayerStore: LocalPlayerStore = null!;
    private sceneManager: SceneManager = null!;

    // Game mode information
    private gameModes: GameModeInfo[] = [
        {
            id: 'the_decree',
            displayName: 'The Decree',
            description: 'Dealer sets the number, you set the winner. 2-4 players.',
            minPlayers: 2,
            maxPlayers: 4
        },
        {
            id: 'guandan',
            displayName: 'Guandan (掼蛋)',
            description: 'Classic Guandan gameplay with strategic card combinations. 5 players.',
            minPlayers: 5,
            maxPlayers: 5
        }
    ];

    start() {
        this.authService = AuthService.getInstance();
        this.localPlayerStore = LocalPlayerStore.getInstance();
        this.sceneManager = SceneManager.getInstance();

        // Check if user is logged in
        if (!this.authService.isLoggedIn()) {
            console.warn('[Hall] User not logged in, redirecting to login');
            this.sceneManager.goToLogin();
            return;
        }

        this.setupUI();
        this.setupButtons();
    }

    private setupUI(): void {
        // Display welcome message
        const username = this.authService.getUsername();
        if (this.welcomeLabel) {
            this.welcomeLabel.string = `Welcome, ${username}!`;
        }
    }

    private setupButtons(): void {
        // The Decree button
        if (this.theDecreeButton) {
            const button = this.theDecreeButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onTheDecreeClicked, this);
            }
        }

        // Guandan button
        if (this.guandanButton) {
            const button = this.guandanButton.getComponent(Button);
            if (button) {
                button.node.on(Button.EventType.CLICK, this.onGuandanClicked, this);
            }
        }

        // Logout button
        if (this.logoutButton) {
            this.logoutButton.node.on(Button.EventType.CLICK, this.onLogoutClicked, this);
        }
    }

    /**
     * Handle The Decree game mode selection
     */
    private onTheDecreeClicked(): void {
        console.log('[Hall] The Decree selected');
        this.selectGameMode('the_decree');
    }

    /**
     * Handle Guandan game mode selection
     */
    private onGuandanClicked(): void {
        console.log('[Hall] Guandan selected');
        this.selectGameMode('guandan');
    }

    /**
     * Select a game mode and navigate to lobby
     */
    private selectGameMode(gameModeId: string): void {
        const modeInfo = this.gameModes.find(m => m.id === gameModeId);

        if (!modeInfo) {
            console.error(`[Hall] Game mode not found: ${gameModeId}`);
            return;
        }

        // Validate that the game mode exists in factory
        const factory = GameModeClientFactory.getInstance();
        if (!factory.hasMode(gameModeId)) {
            console.error(`[Hall] Game mode not registered: ${gameModeId}`);
            return;
        }

        // Store selected game mode in LocalPlayerStore
        this.localPlayerStore.setSelectedGameMode(gameModeId);

        console.log(`[Hall] Navigating to lobby for game mode: ${modeInfo.displayName}`);

        // Navigate to lobby with game mode info
        this.sceneManager.goToLobby({
            gameMode: gameModeId,
            minPlayers: modeInfo.minPlayers,
            maxPlayers: modeInfo.maxPlayers
        });
    }

    /**
     * Handle logout
     */
    private onLogoutClicked(): void {
        console.log('[Hall] Logout clicked');

        // Clear user session via AuthService
        this.authService.logout();

        // Return to login
        this.sceneManager.goToLogin();
    }

    /**
     * Get game mode info by id
     */
    public getGameModeInfo(gameModeId: string): GameModeInfo | undefined {
        return this.gameModes.find(m => m.id === gameModeId);
    }

    /**
     * Get all available game modes
     */
    public getAvailableGameModes(): GameModeInfo[] {
        return [...this.gameModes];
    }

    onDestroy() {
        // Clean up event listeners with null checks
        if (this.theDecreeButton && this.theDecreeButton.isValid) {
            const button = this.theDecreeButton.getComponent(Button);
            if (button?.node) {
                button.node.off(Button.EventType.CLICK, this.onTheDecreeClicked, this);
            }
        }
        if (this.guandanButton && this.guandanButton.isValid) {
            const button = this.guandanButton.getComponent(Button);
            if (button?.node) {
                button.node.off(Button.EventType.CLICK, this.onGuandanClicked, this);
            }
        }
        if (this.logoutButton?.node && this.logoutButton.isValid) {
            this.logoutButton.node.off(Button.EventType.CLICK, this.onLogoutClicked, this);
        }
    }
}
