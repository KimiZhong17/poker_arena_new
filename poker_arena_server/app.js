const ws = require('nodejs-websocket');

ws.createServer((client) => {
    client.on('text', (result) => {
        console.log('收到客户端消息：' + result);
        client.sendText('服务器已收到消息：' + result);
    });
    client.on('error', (err) => {
        console.log('客户端连接错误：' + err.message);
    });
    client.on('close', () => {
        console.log('客户端连接已关闭');
    });
}).listen(8001);

console.log('WebSocket服务器已启动，监听端口8001');