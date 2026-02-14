package game

// TexasHandType - hand types sorted by strength
type TexasHandType int

const (
	HighCard      TexasHandType = 0
	OnePair       TexasHandType = 1
	TwoPair       TexasHandType = 2
	ThreeOfAKind  TexasHandType = 3
	Straight      TexasHandType = 4
	Flush         TexasHandType = 5
	FullHouse     TexasHandType = 6
	FourOfAKind   TexasHandType = 7
	StraightFlush TexasHandType = 8
	RoyalFlush    TexasHandType = 9
)

// GetChineseName returns Chinese name for hand type
func GetChineseName(ht TexasHandType) string {
	names := map[TexasHandType]string{
		HighCard:      "高牌",
		OnePair:       "一对",
		TwoPair:       "两对",
		ThreeOfAKind:  "三条",
		Straight:      "顺子",
		Flush:         "同花",
		FullHouse:     "葫芦",
		FourOfAKind:   "四条",
		StraightFlush: "同花顺",
		RoyalFlush:    "皇家同花顺",
	}
	if n, ok := names[ht]; ok {
		return n
	}
	return "未知"
}

// GetHandScore returns TheDecree scoring for hand type
func GetHandScore(ht TexasHandType) int {
	scores := map[TexasHandType]int{
		HighCard:      2,
		OnePair:       3,
		TwoPair:       5,
		ThreeOfAKind:  7,
		Straight:      8,
		Flush:         9,
		FullHouse:     12,
		FourOfAKind:   14,
		StraightFlush: 18,
		RoyalFlush:    25,
	}
	if s, ok := scores[ht]; ok {
		return s
	}
	return 0
}
