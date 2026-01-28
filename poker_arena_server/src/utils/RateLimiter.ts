/**
 * 简单的内存速率限制器
 * 用于限制 Socket.IO 事件的频率
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export interface RateLimitConfig {
    /** 时间窗口（毫秒） */
    windowMs: number;
    /** 时间窗口内允许的最大请求数 */
    maxRequests: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
    }

    /**
     * 检查是否允许请求
     * @param key 限制的键（如 socketId 或 socketId:eventType）
     * @returns true 如果允许，false 如果被限制
     */
    public isAllowed(key: string): boolean {
        const now = Date.now();
        const entry = this.limits.get(key);

        if (!entry || now >= entry.resetTime) {
            // 新的时间窗口
            this.limits.set(key, {
                count: 1,
                resetTime: now + this.config.windowMs
            });
            return true;
        }

        if (entry.count >= this.config.maxRequests) {
            return false;
        }

        entry.count++;
        return true;
    }

    /**
     * 获取剩余请求数
     */
    public getRemainingRequests(key: string): number {
        const now = Date.now();
        const entry = this.limits.get(key);

        if (!entry || now >= entry.resetTime) {
            return this.config.maxRequests;
        }

        return Math.max(0, this.config.maxRequests - entry.count);
    }

    /**
     * 清理过期的条目
     */
    public cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.limits) {
            if (now >= entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }

    /**
     * 重置特定键的限制
     */
    public reset(key: string): void {
        this.limits.delete(key);
    }

    /**
     * 清空所有限制
     */
    public clear(): void {
        this.limits.clear();
    }
}

/**
 * 预定义的速率限制配置
 */
export const RateLimitPresets = {
    /** 游戏操作：每秒最多10次 */
    GAME_ACTION: { windowMs: 1000, maxRequests: 10 },
    /** 房间操作：每秒最多5次 */
    ROOM_ACTION: { windowMs: 1000, maxRequests: 5 },
    /** 连接操作：每分钟最多10次 */
    CONNECTION: { windowMs: 60000, maxRequests: 10 },
    /** 心跳：每秒最多2次 */
    HEARTBEAT: { windowMs: 1000, maxRequests: 2 }
};
