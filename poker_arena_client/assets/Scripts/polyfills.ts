/**
 * Socket.IO 浏览器环境 Polyfill
 *
 * socket.io-client 需要 Node.js 的 global 对象
 * 在浏览器环境中，我们将 window 映射为 global
 */

// @ts-ignore
if (typeof global === 'undefined') {
    (window as any).global = window;
}

// @ts-ignore
if (typeof globalThis === 'undefined') {
    (window as any).globalThis = window;
}

// @ts-ignore
if (typeof process === 'undefined') {
    (window as any).process = { env: {} };
}

console.log('[Polyfill] Browser environment polyfills loaded');
