import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { GameServer } from './core/GameServer';
import { ServerConfig } from './config/ServerConfig';
import { Logger } from './utils/Logger';

/**
 * Poker Arena 游戏服务器入口
 */

// 创建 Express 应用
const app = express();
app.use(cors({
    origin: '*',  // 开发环境允许所有来源
    credentials: true
}));
app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 服务器状态端点
app.get('/stats', (req, res) => {
    const stats = gameServer.getStats();
    res.json(stats);
});

// 创建 HTTP 服务器
const httpServer = createServer(app);

// 创建游戏服务器
const gameServer = new GameServer(httpServer);

// 获取本机局域网 IP 地址
function getLocalIPAddress(): string {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // 跳过非 IPv4 和内部地址
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// 启动服务器
const PORT = Number(ServerConfig.PORT);
httpServer.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();

    Logger.info('Server', '='.repeat(50));
    Logger.info('Server', '🎮 Poker Arena Server');
    Logger.info('Server', '='.repeat(50));
    Logger.info('Server', `✅ Local: http://localhost:${PORT}`);
    Logger.info('Server', `✅ Network: http://${localIP}:${PORT}`);
    Logger.info('Server', `✅ WebSocket: ws://${localIP}:${PORT}`);
    Logger.info('Server', `✅ CORS Origin: ${ServerConfig.CORS_ORIGIN}`);
    Logger.info('Server', '='.repeat(50));
    Logger.info('Server', `📱 局域网玩家请使用: http://${localIP}:${PORT}`);
    Logger.info('Server', '='.repeat(50));
    Logger.info('Server', 'Server is ready to accept connections!');
    Logger.info('Server', '');
});

// 优雅关闭
process.on('SIGINT', () => {
    Logger.info('Server', '\nShutting down gracefully...');
    gameServer.shutdown();
    httpServer.close(() => {
        Logger.info('Server', 'HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    Logger.info('Server', '\nSIGTERM received, shutting down...');
    gameServer.shutdown();
    httpServer.close(() => {
        Logger.info('Server', 'HTTP server closed');
        process.exit(0);
    });
});
