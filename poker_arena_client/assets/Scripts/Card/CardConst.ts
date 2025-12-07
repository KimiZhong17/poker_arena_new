// 1. Define card suits with unique hexadecimal values
export enum CardSuit {
    DIAMOND = 0x00,
    CLUB    = 0x10,
    HEART   = 0x20,
    SPADE   = 0x30,
    JOKER   = 0x40
}

// 2. Define card values
export enum CardPoint {
    P_3 = 3,
    P_4 = 4,
    P_5 = 5,
    P_6 = 6,
    P_7 = 7,
    P_8 = 8,
    P_9 = 9,
    P_10 = 10,
    P_J = 11,
    P_Q = 12,
    P_K = 13,
    P_A = 14,
    P_2 = 15,
    BLACK_JOKER = 0x01,
    RED_JOKER = 0x02
}

// Example usage:
// const Heart_A = CardSuit.HEART | CardValue.V_A; // Represents Ace of Hearts
// const Joker_Red = CardSuit.JOKER | CardValue.V_RED_JOKER; // Represents Red Joker

