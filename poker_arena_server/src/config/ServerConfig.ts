/**
 * 游戏服务器配置
 */
export const ServerConfig = {
    // 服务器端口
    PORT: process.env.PORT || 3000,

    // CORS 允许的源
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:8080',

    // 房间配置
    MAX_ROOMS: 100,
    ROOM_IDLE_TIMEOUT: 30 * 60 * 1000, // 30 分钟无活动自动关闭

    // 游戏配置
    GAME_STATE_UPDATE_INTERVAL: 100, // 游戏状态更新间隔（毫秒）
    HEARTBEAT_INTERVAL: 30000, // 心跳检查间隔（毫秒）
    PLAYER_DISCONNECT_TIMEOUT: 90000, // 玩家断线超时（毫秒）- 90秒（3个心跳周期）

    // 日志
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
