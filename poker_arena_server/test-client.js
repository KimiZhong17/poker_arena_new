/**
 * 简单的 WebSocket 客户端测试脚本
 * 用于测试服务器的房间创建和加入功能
 *
 * 运行方式：
 * node test-client.js
 */

const io = require('socket.io-client');

// 连接到服务器
console.log('🔌 Connecting to server...');
const socket = io('http://localhost:3000');

// 监听连接成功
socket.on('connect', () => {
    console.log('✅ Connected! Socket ID:', socket.id);
    console.log('');

    // 创建房间
    console.log('📝 Creating room...');
    socket.emit('create_room', {
        playerName: 'Test Player 1',
        gameMode: 'the_decree',
        maxPlayers: 4
    });
});

// 监听房间创建成功
socket.on('room_created', (data) => {
    console.log('🎮 Room created successfully!');
    console.log('   Room ID:', data.roomId);
    console.log('   Player ID:', data.playerId);
    console.log('   Player Name:', data.playerName);
    console.log('');
    console.log('✨ Test completed! You can share this Room ID with others.');
    console.log('');

    // 保持连接 10 秒，然后断开
    setTimeout(() => {
        console.log('👋 Disconnecting...');
        socket.disconnect();
        process.exit(0);
    }, 10000);
});

// 监听错误
socket.on('error', (error) => {
    console.error('❌ Error:', error);
});

// 监听断开连接
socket.on('disconnect', () => {
    console.log('🔌 Disconnected from server');
});

// 其他事件监听（用于调试）
socket.on('player_joined', (data) => {
    console.log('👥 Another player joined:', data.player.name);
});

socket.on('player_ready', (data) => {
    console.log('✋ Player ready:', data.playerId, '- Ready:', data.isReady);
});

socket.on('game_start', (data) => {
    console.log('🎲 Game started with', data.players.length, 'players!');
});
