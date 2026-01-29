/**
 * 简单的日志工具
 * 支持不同日志级别，可通过配置控制输出
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.NONE]: 'NONE'
};

class LoggerClass {
    private level: LogLevel = LogLevel.INFO;

    /**
     * 设置日志级别
     */
    public setLevel(level: LogLevel | string): void {
        if (typeof level === 'string') {
            const upperLevel = level.toUpperCase();
            switch (upperLevel) {
                case 'DEBUG': this.level = LogLevel.DEBUG; break;
                case 'INFO': this.level = LogLevel.INFO; break;
                case 'WARN': this.level = LogLevel.WARN; break;
                case 'ERROR': this.level = LogLevel.ERROR; break;
                case 'NONE': this.level = LogLevel.NONE; break;
                default: this.level = LogLevel.INFO;
            }
        } else {
            this.level = level;
        }
    }

    /**
     * 获取当前日志级别
     */
    public getLevel(): LogLevel {
        return this.level;
    }

    /**
     * DEBUG 级别日志
     */
    public debug(tag: string, message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.DEBUG) {
            console.log(`[${tag}] ${message}`, ...args);
        }
    }

    /**
     * INFO 级别日志
     */
    public info(tag: string, message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.INFO) {
            console.log(`[${tag}] ${message}`, ...args);
        }
    }

    /**
     * WARN 级别日志
     */
    public warn(tag: string, message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[${tag}] ${message}`, ...args);
        }
    }

    /**
     * ERROR 级别日志
     */
    public error(tag: string, message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[${tag}] ${message}`, ...args);
        }
    }
}

// 单例导出
export const Logger = new LoggerClass();
