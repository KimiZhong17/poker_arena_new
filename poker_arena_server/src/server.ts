import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { GameServer } from './core/GameServer';
import { ServerConfig } from './config/ServerConfig';

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
const PORT = ServerConfig.PORT;
httpServer.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();

    console.log('='.repeat(50));
    console.log('🎮 Poker Arena Server');
    console.log('='.repeat(50));
    console.log(`✅ Local: http://localhost:${PORT}`);
    console.log(`✅ Network: http://${localIP}:${PORT}`);
    console.log(`✅ WebSocket: ws://${localIP}:${PORT}`);
    console.log(`✅ CORS Origin: ${ServerConfig.CORS_ORIGIN}`);
    console.log('='.repeat(50));
    console.log('📱 局域网玩家请使用: http://${localIP}:${PORT}');
    console.log('='.repeat(50));
    console.log('Server is ready to accept connections!');
    console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down gracefully...');
    gameServer.shutdown();
    httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n[Server] SIGTERM received, shutting down...');
    gameServer.shutdown();
    httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});
