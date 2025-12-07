/**
 * Random utility functions
 */
export class RandomUtils {

    /**
     * Generate random integer between min and max (inclusive)
     * @param min Minimum value (inclusive)
     * @param max Maximum value (inclusive)
     */
    public static randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate random float between min and max
     * @param min Minimum value
     * @param max Maximum value
     */
    public static randomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    /**
     * Generate random boolean with optional probability
     * @param probability Probability of true (0-1), default 0.5
     */
    public static randomBool(probability: number = 0.5): boolean {
        return Math.random() < probability;
    }

    /**
     * Shuffle an array in place using Fisher-Yates algorithm
     * @param array Array to shuffle
     */
    public static shuffle<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Pick a random element from an array
     * @param array Array to pick from
     */
    public static pickRandom<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[this.randomInt(0, array.length - 1)];
    }

    /**
     * Pick multiple random elements from an array (without replacement)
     * @param array Array to pick from
     * @param count Number of elements to pick
     */
    public static pickMultiple<T>(array: T[], count: number): T[] {
        if (count >= array.length) {
            return [...array];
        }

        const copy = [...array];
        const result: T[] = [];

        for (let i = 0; i < count; i++) {
            const index = this.randomInt(0, copy.length - 1);
            result.push(copy[index]);
            copy.splice(index, 1);
        }

        return result;
    }

    /**
     * Pick multiple random elements from an array (with replacement)
     * @param array Array to pick from
     * @param count Number of elements to pick
     */
    public static pickMultipleWithReplacement<T>(array: T[], count: number): T[] {
        const result: T[] = [];
        for (let i = 0; i < count; i++) {
            const element = this.pickRandom(array);
            if (element !== undefined) {
                result.push(element);
            }
        }
        return result;
    }

    /**
     * Weighted random selection
     * @param items Array of items
     * @param weights Array of weights (same length as items)
     */
    public static weightedRandom<T>(items: T[], weights: number[]): T | undefined {
        if (items.length === 0 || items.length !== weights.length) {
            return undefined;
        }

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }

        return items[items.length - 1];
    }

    /**
     * Generate random UUID v4
     */
    public static uuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Generate random string with specified length and charset
     * @param length Length of string
     * @param charset Character set (default: alphanumeric)
     */
    public static randomString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Random color in hex format
     */
    public static randomColor(): string {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    /**
     * Random color in RGB format
     */
    public static randomRGB(): { r: number, g: number, b: number } {
        return {
            r: this.randomInt(0, 255),
            g: this.randomInt(0, 255),
            b: this.randomInt(0, 255)
        };
    }

    /**
     * Seed-based random number generator (simple LCG)
     * Use this for reproducible random sequences
     */
    public static seededRandom(seed: number): () => number {
        let state = seed;
        return function() {
            // Linear Congruential Generator
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }

    /**
     * Random point in a circle
     * @param radius Circle radius
     */
    public static randomPointInCircle(radius: number): { x: number, y: number } {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        return {
            x: r * Math.cos(angle),
            y: r * Math.sin(angle)
        };
    }

    /**
     * Random point in a rectangle
     * @param width Rectangle width
     * @param height Rectangle height
     */
    public static randomPointInRect(width: number, height: number): { x: number, y: number } {
        return {
            x: this.randomFloat(0, width),
            y: this.randomFloat(0, height)
        };
    }
}
