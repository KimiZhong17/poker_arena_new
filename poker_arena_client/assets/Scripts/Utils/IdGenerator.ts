/**
 * IdGenerator - ID生成工具
 *
 * 提供各种ID生成方法，确保唯一性
 */
export class IdGenerator {
    /**
     * 生成游客UUID
     * 格式: guest_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
     *
     * 基于UUID v4标准，保证全局唯一性
     */
    public static generateGuestId(): string {
        const uuid = this.generateUUIDv4();
        return `guest_${uuid}`;
    }

    /**
     * 生成标准UUID v4
     * 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
     *
     * 使用crypto API（如果可用）或回退到Math.random()
     */
    public static generateUUIDv4(): string {
        // 优先使用crypto API（更安全的随机数）
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // 回退到传统方法
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 生成短ID（用于显示）
     * 从完整UUID中提取前4位（更简洁）
     */
    public static generateShortId(fullId: string): string {
        // 如果是guest_开头，去掉前缀
        const uuid = fullId.startsWith('guest_') ? fullId.substring(6) : fullId;
        // 返回前4位（缩短以便多标签页测试时更易读）
        return uuid.substring(0, 4);
    }

    /**
     * 生成游客显示名称
     * 格式: 游客_abc1
     */
    public static generateGuestDisplayName(guestId: string): string {
        const shortId = this.generateShortId(guestId);
        return `游客_${shortId}`;
    }
}
