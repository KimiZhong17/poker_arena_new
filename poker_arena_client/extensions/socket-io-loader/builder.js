/**
 * Socket.IO Loader Extension - Builder Hook
 * 在构建时自动注入 Socket.IO 客户端库到 index.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

exports.configs = {
    'web-mobile': {
        hooks: './hooks.js',
        options: {
            remoteAddress: {
                label: 'Socket.IO CDN',
                default: 'https://cdn.socket.io/4.5.4/socket.io.min.js',
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'Socket.IO CDN URL'
                    }
                }
            }
        }
    },
    'web-desktop': {
        hooks: './hooks.js',
        options: {
            remoteAddress: {
                label: 'Socket.IO CDN',
                default: 'https://cdn.socket.io/4.5.4/socket.io.min.js',
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'Socket.IO CDN URL'
                    }
                }
            }
        }
    }
};

exports.load = function() {
    console.log('[socket-io-loader] Builder plugin loaded');
};

exports.unload = function() {
    console.log('[socket-io-loader] Builder plugin unloaded');
};
