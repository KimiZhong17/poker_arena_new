import { GameModeBase } from "./GameModeBase";
import { GuandanMode } from "./GuandanMode";
import { TheDecreeMode } from "./TheDecreeMode";

/**
 * Game mode factory - creates game mode instances
 */
export class GameModeFactory {
    private static instance: GameModeFactory;
    private registeredModes: Map<string, () => GameModeBase> = new Map();

    private constructor() {
        this.registerDefaultModes();
    }

    public static getInstance(): GameModeFactory {
        if (!GameModeFactory.instance) {
            GameModeFactory.instance = new GameModeFactory();
        }
        return GameModeFactory.instance;
    }

    /**
     * Register default game modes
     */
    private registerDefaultModes(): void {
        // Register The Decree mode
        this.registeredModes.set('the_decree', () => {
            return new TheDecreeMode();
        });

        // Register Guandan mode
        this.registeredModes.set('guandan', () => {
            return new GuandanMode();
        });
    }

    /**
     * Create a game mode instance by ID
     */
    public createGameMode(modeId: string): GameModeBase {
        const creator = this.registeredModes.get(modeId);

        if (!creator) {
            throw new Error(`Game mode '${modeId}' not found`);
        }

        return creator();
    }

    /**
     * Register a custom game mode
     */
    public registerMode(modeId: string, creator: () => GameModeBase): void {
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
