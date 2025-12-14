import { _decorator, Component, Button, Label, EditBox } from 'cc';
import { SceneManager } from './Manager/SceneManager';
import { UserManager } from './Manager/UserManager';

const { ccclass, property } = _decorator;

/**
 * Lobby Scene - Simplified version
 * Players can create a room or join by room ID
 */
@ccclass('Lobby')
export class Lobby extends Component {
    @property(Button)
    createRoomButton: Button = null!;

    @property(Button)
    joinRoomButton: Button = null!;

    @property(EditBox)
    roomIdInput: EditBox = null!;

    @property(Button)
    backButton: Button = null!;

    @property(Label)
    statusLabel: Label = null!;

    private userManager: UserManager = null!;
    private sceneManager: SceneManager = null!;
    private currentGameMode: string = '';

    start() {
        this.userManager = UserManager.getInstance();
        this.sceneManager = SceneManager.getInstance();

        // Check if user is logged in
        if (!this.userManager.isUserLoggedIn()) {
            console.warn('[Lobby] User not logged in, redirecting to login');
            this.sceneManager.goToLogin();
            return;
        }

        // Get transition data
        const transitionData = this.sceneManager.getTransitionData<{
            gameMode: string;
        }>();

        // Get game mode from transition data or UserManager
        this.currentGameMode = transitionData.gameMode || this.userManager.getSelectedGameMode() || '';

        if (!this.currentGameMode) {
            console.error('[Lobby] No game mode selected');
            this.sceneManager.goToHall();
            return;
        }

        console.log(`[Lobby] Game mode: ${this.currentGameMode}`);

        this.setupUI();
        this.setupButtons();
    }

    private setupUI(): void {
        // Clear status initially
        if (this.statusLabel) {
            this.statusLabel.string = '';
        }

        // Clear room ID input
        if (this.roomIdInput) {
            this.roomIdInput.string = '';
        }
    }

    private setupButtons(): void {
        // Create Room button
        if (this.createRoomButton?.node) {
            this.createRoomButton.node.on(Button.EventType.CLICK, this.onCreateRoomClicked, this);
        }

        // Join Room button
        if (this.joinRoomButton?.node) {
            this.joinRoomButton.node.on(Button.EventType.CLICK, this.onJoinRoomClicked, this);
        }

        // Back button
        if (this.backButton?.node) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClicked, this);
        }
    }

    /**
     * Handle create room button click
     * For now, directly go to GameRoom scene
     */
    private onCreateRoomClicked(): void {
        console.log('[Lobby] Create room clicked');

        const user = this.userManager.getCurrentUser();
        if (!user) {
            console.error('[Lobby] No user logged in');
            this.showStatus('Error: User not logged in');
            return;
        }

        // Generate a simple room ID (timestamp-based)
        const roomId = `room_${Date.now()}`;
        console.log(`[Lobby] Created room: ${roomId}`);

        // TODO: In future, create actual room with RoomManager
        // For now, just navigate to game scene
        this.sceneManager.goToGame({
            roomId: roomId,
            gameMode: this.currentGameMode
        });
    }

    /**
     * Handle join room button click
     * Join a room by entering room ID
     */
    private onJoinRoomClicked(): void {
        console.log('[Lobby] Join room clicked');

        const user = this.userManager.getCurrentUser();
        if (!user) {
            console.error('[Lobby] No user logged in');
            this.showStatus('Error: User not logged in');
            return;
        }

        // Get room ID from input
        const roomId = this.roomIdInput?.string?.trim();

        if (!roomId) {
            console.warn('[Lobby] No room ID entered');
            this.showStatus('Please enter a room ID');
            return;
        }

        console.log(`[Lobby] Attempting to join room: ${roomId}`);

        // TODO: In future, validate room exists with RoomManager
        // For now, just navigate to game scene with the entered room ID
        this.sceneManager.goToGame({
            roomId: roomId,
            gameMode: this.currentGameMode
        });
    }

    /**
     * Handle back button
     */
    private onBackClicked(): void {
        console.log('[Lobby] Back clicked');
        this.sceneManager.goToHall();
    }

    /**
     * Show status message
     */
    private showStatus(message: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = message;

            // Auto-hide after 3 seconds
            this.scheduleOnce(() => {
                if (this.statusLabel) {
                    this.statusLabel.string = '';
                }
            }, 3);
        }
    }

    onDestroy() {
        // Clean up event listeners with null checks
        if (this.createRoomButton?.node && this.createRoomButton.isValid) {
            this.createRoomButton.node.off(Button.EventType.CLICK, this.onCreateRoomClicked, this);
        }
        if (this.joinRoomButton?.node && this.joinRoomButton.isValid) {
            this.joinRoomButton.node.off(Button.EventType.CLICK, this.onJoinRoomClicked, this);
        }
        if (this.backButton?.node && this.backButton.isValid) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClicked, this);
        }
    }
}
