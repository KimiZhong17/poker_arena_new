/**
 * Logger - 客户端日志工具
 *
 * 用法：
 *   import { logger } from '../Utils/Logger';
 *   const log = logger('Net');
 *   log.debug('connecting...');
 *   log.info('connected');
 *   log.warn('slow response');
 *   log.error('connection failed');
 *
 * 过滤：
 *   Logger.setLevel(LogLevel.WARN);          // 只显示 WARN 及以上
 *   Logger.setFilter(['Net', 'TheDecree']);   // 只显示指定模块
 *   Logger.clearFilter();                     // 清除模块过滤
 */

export enum LogLevel {
    DEBUG = 0,
    INFO  = 1,
    WARN  = 2,
    ERROR = 3,
    OFF   = 4,
}

export class Logger {
    private static _level: LogLevel = LogLevel.DEBUG;
    private static _filter: Set<string> | null = null;

    static setLevel(level: LogLevel): void {
        Logger._level = level;
    }

    static setFilter(modules: string[]): void {
        Logger._filter = new Set(modules);
    }

    static clearFilter(): void {
        Logger._filter = null;
    }

    private static _shouldLog(level: LogLevel, module: string): boolean {
        if (level < Logger._level) return false;
        if (Logger._filter && !Logger._filter.has(module)) return false;
        return true;
    }

    static debug(module: string, ...args: any[]): void {
        if (!Logger._shouldLog(LogLevel.DEBUG, module)) return;
        console.log(`[D][${module}]`, ...args);
    }

    static info(module: string, ...args: any[]): void {
        if (!Logger._shouldLog(LogLevel.INFO, module)) return;
        console.log(`[I][${module}]`, ...args);
    }

    static warn(module: string, ...args: any[]): void {
        if (!Logger._shouldLog(LogLevel.WARN, module)) return;
        console.warn(`[W][${module}]`, ...args);
    }

    static error(module: string, ...args: any[]): void {
        if (!Logger._shouldLog(LogLevel.ERROR, module)) return;
        console.error(`[E][${module}]`, ...args);
    }
}

/**
 * 创建绑定到指定模块的 logger 实例
 * 用法：const log = logger('Net');
 */
export function logger(module: string) {
    return {
        debug: (...args: any[]) => Logger.debug(module, ...args),
        info:  (...args: any[]) => Logger.info(module, ...args),
        warn:  (...args: any[]) => Logger.warn(module, ...args),
        error: (...args: any[]) => Logger.error(module, ...args),
    };
}
