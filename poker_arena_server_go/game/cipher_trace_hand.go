package game

// ==================== Hand Type Constants ====================

// CTHandType represents a Cipher Trace hand type.
type CTHandType int

const (
	CTSingle         CTHandType = 1  // 单张
	CTPair           CTHandType = 2  // 对子
	CTTriple         CTHandType = 3  // 三张（不带）
	CTTripleWithPair CTHandType = 4  // 三带二
	CTStraight       CTHandType = 10 // 顺子（5+连续单张）
	CTConsecPair     CTHandType = 11 // 连对（3+连续对子）
	CTSteelPlate     CTHandType = 12 // 钢板（2+连续三张，不带）
	CTPlane          CTHandType = 13 // 飞机（2+连续三张，各带一对）
	CTBomb           CTHandType = 20 // 普通炸弹（4+同点数）
	CTJokerBomb      CTHandType = 30 // 王炸（含大王的鬼牌组合）
)

// CTPlayedHand represents a validated hand that was played on the table.
type CTPlayedHand struct {
	Type     CTHandType `json:"type"`
	Cards    []int      `json:"cards"`
	PlayerID string     `json:"playerId"`
	MainRank int        `json:"mainRank"` // primary rank for comparison
	Length   int        `json:"length"`   // for straights/consecutive: unit count
	BombSize int        `json:"bombSize"` // for bombs: card count
}

// CTHandTypeName returns the Chinese name for a hand type.
func CTHandTypeName(ht CTHandType) string {
	switch ht {
	case CTSingle:
		return "单张"
	case CTPair:
		return "对子"
	case CTTriple:
		return "三张"
	case CTTripleWithPair:
		return "三带二"
	case CTStraight:
		return "顺子"
	case CTConsecPair:
		return "连对"
	case CTSteelPlate:
		return "钢板"
	case CTPlane:
		return "飞机"
	case CTBomb:
		return "炸弹"
	case CTJokerBomb:
		return "王炸"
	default:
		return "未知"
	}
}

// IsBomb returns true if the hand type is any kind of bomb.
func (h *CTPlayedHand) IsBomb() bool {
	return h.Type == CTBomb || h.Type == CTJokerBomb
}
