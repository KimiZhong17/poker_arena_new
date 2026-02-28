import { director, Director } from "cc";
import { logger } from '../Utils/Logger';

const log = logger('Scene');

/**
 * Scene names enumeration
 */
export enum SceneName {
    LOGIN = "Login",
    HALL = "Hall",
    LOBBY = "Lobby",
    GAME = "GameRoom"
}

/**
 * Scene transition data
 */
export interface SceneTransitionData {
    [key: string]: any;
}

/**
 * Scene manager - handles scene transitions
 */
export class SceneManager {
    private static instance: SceneManager;
    private currentScene: SceneName | null = null;
    private transitionData: SceneTransitionData = {};
    private isLoadingScene: boolean = false;
    private pendingSceneName: SceneName | null = null;

    private constructor() {}

    public static getInstance(): SceneManager {
        if (!SceneManager.instance) {
            SceneManager.instance = new SceneManager();
        }
        return SceneManager.instance;
    }

    /**
     * Load a scene with optional data
     */
    public loadScene(sceneName: SceneName, data?: SceneTransitionData): void {
        // 防止重复加载同一场景
        if (this.isLoadingScene && this.pendingSceneName === sceneName) {
            log.warn(`Scene ${sceneName} is already being loaded, skipping duplicate request.`);
            return;
        }

        // 如果正在加载其他场景，发出警告
        if (this.isLoadingScene) {
            log.warn(`Scene ${this.pendingSceneName} is being loaded, but ${sceneName} was requested. Overriding.`);
        }

        this.transitionData = data || {};
        this.pendingSceneName = sceneName;
        this.isLoadingScene = true;

        director.loadScene(sceneName, (error) => {
            this.isLoadingScene = false;
            this.pendingSceneName = null;

            if (error) {
                log.error(`Failed to load scene ${sceneName}:`, error);
            } else {
                this.currentScene = sceneName;
                log.debug(`Scene ${sceneName} loaded successfully`);
            }
        });
    }

    /**
     * Get transition data passed from previous scene
     */
    public getTransitionData<T = any>(): T {
        return this.transitionData as T;
    }

    /**
     * Clear transition data
     */
    public clearTransitionData(): void {
        this.transitionData = {};
    }

    /**
     * Get current scene name
     */
    public getCurrentScene(): SceneName | null {
        return this.currentScene;
    }

    /**
     * Navigation shortcuts
     */
    public goToLogin(): void {
        this.loadScene(SceneName.LOGIN);
    }

    public goToHall(): void {
        this.loadScene(SceneName.HALL);
    }

    public goToLobby(data: { gameMode: string; minPlayers?: number; maxPlayers?: number }): void {
        this.loadScene(SceneName.LOBBY, data);
    }

    public goToGame(data: { roomId: string; gameMode: string; isOnlineMode?: boolean }): void {
        this.loadScene(SceneName.GAME, data);
    }

    public goBack(): void {
        // Simple back navigation
        switch (this.currentScene) {
            case SceneName.GAME:
                this.goToLobby({ gameMode: '' });
                break;
            case SceneName.LOBBY:
                this.goToHall();
                break;
            case SceneName.HALL:
                this.goToLogin();
                break;
            default:
                break;
        }
    }
}
