/**
 * User data structure
 */
export interface UserData {
    id: string;
    username: string;
    nickname: string;
    avatar?: string;
    level: number;
    exp: number;
    token?: string;
}

/**
 * User manager - handles user authentication and data
 */
export class UserManager {
    private static instance: UserManager;
    private currentUser: UserData | null = null;
    private isLoggedIn: boolean = false;
    private selectedGameMode: string | null = null;

    private constructor() {
        this.loadUserFromStorage();
    }

    public static getInstance(): UserManager {
        if (!UserManager.instance) {
            UserManager.instance = new UserManager();
        }
        return UserManager.instance;
    }

    /**
     * Login with username and password
     */
    public async login(username: string, password: string): Promise<boolean> {
        // TODO: Replace with actual API call
        // For now, simulate login
        await this.delay(500);

        this.currentUser = {
            id: `user_${Date.now()}`,
            username: username,
            nickname: username,
            level: 1,
            exp: 0
        };

        this.isLoggedIn = true;
        this.saveUserToStorage();

        return true;
    }

    /**
     * Guest login (no account required)
     */
    public async loginAsGuest(): Promise<boolean> {
        await this.delay(300);

        const guestId = `guest_${Date.now()}`;
        this.currentUser = {
            id: guestId,
            username: guestId,
            nickname: `游客${Math.floor(Math.random() * 10000)}`,
            level: 1,
            exp: 0
        };

        this.isLoggedIn = true;
        // Don't save guest to storage

        return true;
    }

    /**
     * Logout
     */
    public logout(): void {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.selectedGameMode = null;
        this.clearUserFromStorage();
    }

    /**
     * Get current user data
     */
    public getCurrentUser(): UserData | null {
        return this.currentUser;
    }

    /**
     * Get username
     */
    public getUsername(): string {
        return this.currentUser?.username || 'Guest';
    }

    /**
     * Check if user is logged in
     */
    public isUserLoggedIn(): boolean {
        return this.isLoggedIn;
    }

    /**
     * Set selected game mode
     */
    public setSelectedGameMode(gameModeId: string): void {
        this.selectedGameMode = gameModeId;
        console.log(`[UserManager] Selected game mode: ${gameModeId}`);
    }

    /**
     * Get selected game mode
     */
    public getSelectedGameMode(): string | null {
        return this.selectedGameMode;
    }

    /**
     * Clear selected game mode
     */
    public clearSelectedGameMode(): void {
        this.selectedGameMode = null;
    }

    /**
     * Update user data
     */
    public updateUser(data: Partial<UserData>): void {
        if (!this.currentUser) return;

        this.currentUser = {
            ...this.currentUser,
            ...data
        };

        this.saveUserToStorage();
    }

    /**
     * Save user to local storage
     */
    private saveUserToStorage(): void {
        if (!this.currentUser) return;

        try {
            localStorage.setItem('poker_arena_user', JSON.stringify(this.currentUser));
            localStorage.setItem('poker_arena_logged_in', 'true');
        } catch (error) {
            console.error('Failed to save user to storage:', error);
        }
    }

    /**
     * Load user from local storage
     */
    private loadUserFromStorage(): void {
        try {
            const userData = localStorage.getItem('poker_arena_user');
            const loggedIn = localStorage.getItem('poker_arena_logged_in');

            if (userData && loggedIn === 'true') {
                this.currentUser = JSON.parse(userData);
                this.isLoggedIn = true;
            }
        } catch (error) {
            console.error('Failed to load user from storage:', error);
        }
    }

    /**
     * Clear user from local storage
     */
    private clearUserFromStorage(): void {
        try {
            localStorage.removeItem('poker_arena_user');
            localStorage.removeItem('poker_arena_logged_in');
        } catch (error) {
            console.error('Failed to clear user from storage:', error);
        }
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
