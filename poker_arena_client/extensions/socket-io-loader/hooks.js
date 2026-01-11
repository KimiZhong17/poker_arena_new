/**
 * Socket.IO Loader Extension - Build Hooks
 * 构建钩子,在构建完成后修改 index.html 注入 Socket.IO
 */

'use strict';

const fs = require('fs');
const path = require('path');

exports.onAfterBuild = async function(options, result) {
    // 简化实现，不使用 try-catch，让错误自然抛出以便调试
    const platform = options.platform;
    const buildPath = options.dest;

    console.log('[socket-io-loader] Platform:', platform);
    console.log('[socket-io-loader] Build path:', buildPath);

    // 只处理 web 平台
    if (platform !== 'web-mobile' && platform !== 'web-desktop') {
        console.log('[socket-io-loader] Skip non-web platform');
        return;
    }

    // 查找 index.html
    const indexPath = path.join(buildPath, 'index.html');
    console.log('[socket-io-loader] Index path:', indexPath);

    if (!fs.existsSync(indexPath)) {
        console.warn('[socket-io-loader] index.html not found, skipping injection');
        return;
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    // 检查是否已经注入过
    if (html.includes('socket.io')) {
        console.log('[socket-io-loader] Socket.IO already injected');
        return;
    }

    // 获取配置的 CDN 地址
    const cdnUrl = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
    console.log('[socket-io-loader] CDN URL:', cdnUrl);

    // 构建 script 标签
    const socketScript = `<script src="${cdnUrl}" crossorigin="anonymous"></script>\n`;

    // 在 </head> 之前注入
    if (html.includes('</head>')) {
        html = html.replace('</head>', `${socketScript}</head>`);
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log('[socket-io-loader] Socket.IO injected successfully');
    } else {
        console.warn('[socket-io-loader] No </head> tag found, skipping injection');
    }
};
