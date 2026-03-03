/**
 * TheDecree game state enumeration
 * 必须与服务端保持一致
 *
 * 对应服务端文件: poker_arena_server/src/game/the_decree/TheDecreeMode.ts
 */
export enum TheDecreeGameState {
    SETUP = "setup",
    FIRST_DEALER_SELECTION = "first_dealer",
    DEALER_CALL = "dealer_call",
    PLAYER_SELECTION = "player_selection",
    SHOWDOWN = "showdown",
    SCORING = "scoring",
    REFILL = "refill",
    GAME_OVER = "game_over"
}
