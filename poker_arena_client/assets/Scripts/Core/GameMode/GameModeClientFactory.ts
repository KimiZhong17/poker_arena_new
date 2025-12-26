import { GameModeClientBase } from "./GameModeClientBase";
import { GuandanMode } from "./GuandanMode";
import { TheDecreeModeClient } from "./TheDecreeModeClient";

/**
 * Client-side game mode factory - creates game mode instances
 */
export class GameModeClientFactory {
    private static instance: GameModeClientFactory;
    private registeredModes: Map<string, () => GameModeClientBase> = new Map();

    private constructor() {
        this.registerDefaultModes();
    }

    public static getInstance(): GameModeClientFactory {
        if (!GameModeClientFactory.instance) {
            GameModeClientFactory.instance = new GameModeClientFactory();
        }
        return GameModeClientFactory.instance;
    }

    /**
     * Register default game modes
     */
    private registerDefaultModes(): void {
        // Register The Decree mode (network/client version)
        this.registeredModes.set('the_decree', () => {
            return new TheDecreeModeClient();
        });

        // Register Guandan mode
        this.registeredModes.set('guandan', () => {
            return new GuandanMode();
        });
    }

    /**
     * Create a game mode instance by ID
     */
    public createGameMode(modeId: string): GameModeClientBase {
        const creator = this.registeredModes.get(modeId);

        if (!creator) {
            throw new Error(`Game mode '${modeId}' not found`);
        }

        return creator();
    }

    /**
     * Register a custom game mode
     */
    public registerMode(modeId: string, creator: () => GameModeClientBase): void {
        this.registeredModes.set(modeId, creator);
    }

    /**
     * Check if a game mode is registered
     */
    public hasMode(modeId: string): boolean {
        return this.registeredModes.has(modeId);
    }

    /**
     * Get all registered mode IDs
     */
    public getRegisteredModeIds(): string[] {
        return Array.from(this.registeredModes.keys());
    }
}
