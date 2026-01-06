/**
 * Socket.IO Loader Extension - Build Hooks
 * 构建钩子,在构建完成后修改 index.html 注入 Socket.IO
 */

'use strict';

const fs = require('fs');
const path = require('path');

exports.onAfterBuild = async function(options, result) {
    const platform = options.platform;
    const buildPath = options.dest;

    console.log('[socket-io-loader] Starting to inject Socket.IO...');
    console.log('[socket-io-loader] Platform:', platform);
    console.log('[socket-io-loader] Build path:', buildPath);

    // 只处理 web 平台
    if (platform !== 'web-mobile' && platform !== 'web-desktop') {
        console.log('[socket-io-loader] Skip non-web platform');
        return;
    }

    // 查找 index.html
    const indexPath = path.join(buildPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
        console.error('[socket-io-loader] index.html not found at:', indexPath);
        return;
    }

    try {
        let html = fs.readFileSync(indexPath, 'utf8');

        // 检查是否已经注入过
        if (html.includes('socket.io')) {
            console.log('[socket-io-loader] Socket.IO already injected, skipping...');
            return;
        }

        // 获取配置的 CDN 地址
        const cdnUrl = options.packages?.['socket-io-loader']?.remoteAddress ||
                       'https://cdn.socket.io/4.5.4/socket.io.min.js';

        // 构建 script 标签
        const socketScript = `    <script src="${cdnUrl}" crossorigin="anonymous"></script>\n`;

        // 在 </head> 之前注入
        if (html.includes('</head>')) {
            html = html.replace('</head>', `${socketScript}</head>`);
        } else {
            // 如果没有 </head>,在第一个 <script> 之前注入
            html = html.replace('<script', `${socketScript}<script`);
        }

        // 写回文件
        fs.writeFileSync(indexPath, html, 'utf8');

        console.log('[socket-io-loader] Socket.IO injected successfully!');
        console.log('[socket-io-loader] CDN URL:', cdnUrl);

    } catch (error) {
        console.error('[socket-io-loader] Failed to inject Socket.IO:', error);
    }
};
