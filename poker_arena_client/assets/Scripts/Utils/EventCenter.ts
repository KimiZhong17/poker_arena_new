import { EventTarget } from 'cc';

/**
 * 定义通用的回调类型，解决参数类型不匹配问题
 */
type EventCallback = (...args: any[]) => void;

export class EventCenter {
    private static _target: EventTarget = new EventTarget();

    // 将所有的 Function 替换为 EventCallback
    public static on(type: string, callback: EventCallback, target?: any): void {
        this._target.on(type, callback, target);
    }

    public static off(type: string, callback: EventCallback, target?: any): void {
        this._target.off(type, callback, target);
    }

    public static emit(type: string, ...args: any[]): void {
        // 使用剩余参数写法，能更好地支持多参数传递
        this._target.emit(type, ...args);
    }

    public static once(type: string, callback: EventCallback, target?: any): void {
        this._target.once(type, callback, target);
    }
}

export const GameEvents = {
    // UI 导航事件
    UI_REFRESH_ROOM: 'UI_REFRESH_ROOM',
    UI_NAVIGATE_TO_GAME: 'UI_NAVIGATE_TO_GAME',
    UI_GAME_RESTART: 'UI_GAME_RESTART',

    // 游戏玩法事件
    GAME_DEAL_CARDS: 'GAME_DEAL_CARDS',
    GAME_COMMUNITY_CARDS: 'GAME_COMMUNITY_CARDS',
    GAME_DEALER_SELECTED: 'GAME_DEALER_SELECTED',
    GAME_DEALER_CALLED: 'GAME_DEALER_CALLED',
    GAME_PLAYER_PLAYED: 'GAME_PLAYER_PLAYED',
    GAME_SHOWDOWN: 'GAME_SHOWDOWN',
    GAME_ROUND_END: 'GAME_ROUND_END',
    GAME_OVER: 'GAME_OVER',
    GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',

    // 重连事件
    GAME_RECONNECTED: 'GAME_RECONNECTED',

    // 托管事件
    PLAYER_AUTO_CHANGED: 'PLAYER_AUTO_CHANGED'
};