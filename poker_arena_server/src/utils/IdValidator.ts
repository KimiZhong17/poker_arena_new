/**
 * IdValidator - ID验证工具
 *
 * 用于验证客户端传来的游客ID和用户名的合法性
 */
export class IdValidator {
    // UUID v4 正则表达式
    private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // 游客ID格式: guest_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx 或 guest_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx_N（带会话后缀）
    private static readonly GUEST_ID_REGEX = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(_\d+)?$/i;

    /**
     * 验证游客ID格式是否正确
     * @param guestId 游客ID
     * @returns 是否有效
     */
    public static isValidGuestId(guestId: string): boolean {
        if (!guestId || typeof guestId !== 'string') {
            return false;
        }

        return this.GUEST_ID_REGEX.test(guestId);
    }

    /**
     * 验证UUID格式是否正确
     * @param uuid UUID字符串
     * @returns 是否有效
     */
    public static isValidUUID(uuid: string): boolean {
        if (!uuid || typeof uuid !== 'string') {
            return false;
        }

        return this.UUID_REGEX.test(uuid);
    }

    /**
     * 验证玩家名称是否合法
     * @param name 玩家名称
     * @returns 是否有效
     */
    public static isValidPlayerName(name: string): boolean {
        if (!name || typeof name !== 'string') {
            return false;
        }

        // 检查长度 (1-50 字符)
        if (name.length < 1 || name.length > 50) {
            return false;
        }

        // 检查是否包含非法字符（只允许字母、数字、中文、下划线、连字符、空格、井号）
        const validNameRegex = /^[\w\u4e00-\u9fa5\s\-_#]+$/;
        return validNameRegex.test(name);
    }

    /**
     * 提取游客ID中的UUID部分
     * @param guestId 游客ID
     * @returns UUID部分，如果格式不正确返回null
     */
    public static extractUUIDFromGuestId(guestId: string): string | null {
        if (!this.isValidGuestId(guestId)) {
            return null;
        }

        return guestId.substring(6); // 去掉 "guest_" 前缀
    }

    /**
     * 净化玩家名称（移除危险字符）
     * @param name 原始名称
     * @returns 净化后的名称
     */
    public static sanitizePlayerName(name: string): string {
        if (!name || typeof name !== 'string') {
            return 'Guest';
        }

        // 移除首尾空格
        name = name.trim();

        // 如果为空，返回默认名称
        if (name.length === 0) {
            return 'Guest';
        }

        // 限制长度
        if (name.length > 50) {
            name = name.substring(0, 50);
        }

        return name;
    }
}
