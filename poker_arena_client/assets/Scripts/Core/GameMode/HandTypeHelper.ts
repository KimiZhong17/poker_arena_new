import { TexasHandType } from "./TexasHoldEmEvaluator";

/**
 * Helper class for hand type display names
 * 牌型显示名称辅助类
 */
export class HandTypeHelper {
    /**
     * Get Chinese name for hand type
     * 获取牌型的中文名称
     */
    public static getChineseName(handType: TexasHandType): string {
        const names: { [key in TexasHandType]: string } = {
            [TexasHandType.HIGH_CARD]: "高牌",
            [TexasHandType.ONE_PAIR]: "一对",
            [TexasHandType.TWO_PAIR]: "两对",
            [TexasHandType.THREE_OF_A_KIND]: "三条",
            [TexasHandType.STRAIGHT]: "顺子",
            [TexasHandType.FLUSH]: "同花",
            [TexasHandType.FULL_HOUSE]: "葫芦",
            [TexasHandType.FOUR_OF_A_KIND]: "四条",
            [TexasHandType.STRAIGHT_FLUSH]: "同花顺",
            [TexasHandType.ROYAL_FLUSH]: "皇家同花顺"
        };
        return names[handType] || "未知";
    }

    /**
     * Get English name for hand type
     * 获取牌型的英文名称
     */
    public static getEnglishName(handType: TexasHandType): string {
        const names: { [key in TexasHandType]: string } = {
            [TexasHandType.HIGH_CARD]: "High Card",
            [TexasHandType.ONE_PAIR]: "One Pair",
            [TexasHandType.TWO_PAIR]: "Two Pair",
            [TexasHandType.THREE_OF_A_KIND]: "Three of a Kind",
            [TexasHandType.STRAIGHT]: "Straight",
            [TexasHandType.FLUSH]: "Flush",
            [TexasHandType.FULL_HOUSE]: "Full House",
            [TexasHandType.FOUR_OF_A_KIND]: "Four of a Kind",
            [TexasHandType.STRAIGHT_FLUSH]: "Straight Flush",
            [TexasHandType.ROYAL_FLUSH]: "Royal Flush"
        };
        return names[handType] || "Unknown";
    }

    /**
     * Get score for hand type (TheDecree scoring)
     * 获取牌型对应的分数（TheDecree计分规则）
     */
    public static getScore(handType: TexasHandType): number {
        const scores: { [key in TexasHandType]: number } = {
            [TexasHandType.HIGH_CARD]: 2,
            [TexasHandType.ONE_PAIR]: 3,
            [TexasHandType.TWO_PAIR]: 5,
            [TexasHandType.THREE_OF_A_KIND]: 7,
            [TexasHandType.STRAIGHT]: 8,
            [TexasHandType.FLUSH]: 9,
            [TexasHandType.FULL_HOUSE]: 12,
            [TexasHandType.FOUR_OF_A_KIND]: 14,
            [TexasHandType.STRAIGHT_FLUSH]: 18,
            [TexasHandType.ROYAL_FLUSH]: 25
        };
        return scores[handType] || 0;
    }

    /**
     * Format hand type display with score
     * 格式化牌型显示（带分数）
     * @example "同花 +9"
     */
    public static formatWithScore(handType: TexasHandType, isWinner: boolean = false): string {
        const name = this.getChineseName(handType);
        const score = this.getScore(handType);
        const winnerBonus = isWinner ? "+1" : "";
        return `${name} +${score}${winnerBonus}`;
    }

    /**
     * Get color for hand type display (for UI styling)
     * 获取牌型显示颜色（用于UI样式）
     */
    public static getDisplayColor(handType: TexasHandType): string {
        // Higher hands = more vibrant colors
        if (handType >= TexasHandType.STRAIGHT_FLUSH) {
            return "#FFD700"; // Gold
        } else if (handType >= TexasHandType.FULL_HOUSE) {
            return "#FF6B6B"; // Red
        } else if (handType >= TexasHandType.THREE_OF_A_KIND) {
            return "#4ECDC4"; // Cyan
        } else {
            return "#FFFFFF"; // White
        }
    }
}
