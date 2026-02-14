/**
 * 网络配置
 *
 * 使用方法：
 * 1. 本机测试：使用默认的 localhost
 * 2. 局域网游戏：修改 SERVER_IP 为服务器的局域网 IP（如 192.168.1.100）
 * 3. 服务器启动时会显示局域网 IP 地址
 */

export class NetworkConfig {
    // 服务器 IP 地址
    // 本机测试：'localhost'
    // 局域网游戏：修改为服务器的局域网 IP，例如 '192.168.1.100'
    private static SERVER_IP: string = 'localhost';
    // private static SERVER_IP: string = '10.0.38.17';
    // private static SERVER_IP: string = '192.168.1.5';

    // 服务器端口
    private static SERVER_PORT: number = 3000;

    /**
     * 获取服务器 URL（保留兼容，但不再用于连接）
     */
    public static getServerUrl(): string {
        return `ws://${this.SERVER_IP}:${this.SERVER_PORT}/ws`;
    }

    /**
     * 设置服务器 IP（用于运行时动态配置）
     */
    public static setServerIP(ip: string): void {
        this.SERVER_IP = ip;
        console.log(`[NetworkConfig] Server IP set to: ${ip}`);
    }

    /**
     * 获取当前服务器 IP
     */
    public static getServerIP(): string {
        return this.SERVER_IP;
    }

    /**
     * 获取服务器端口
     */
    public static getServerPort(): number {
        return this.SERVER_PORT;
    }
}
