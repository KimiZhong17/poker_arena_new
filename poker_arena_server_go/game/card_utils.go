package game

import "sort"

type CardRankingMode int

const (
	AceLow  CardRankingMode = iota // A=1, 2=2, ..., K=13
	AceHigh                        // 2=2, ..., K=13, A=14
	TwoHigh                        // 3=3, ..., A=14, 2=15
)

func cardRank(point int, mode CardRankingMode) int {
	// Normalize from Guandan encoding (A=14, 2=15) to standard (A=1, 2=2, 3-13)
	normalized := point
	if point == 14 {
		normalized = 1 // A
	} else if point == 15 {
		normalized = 2 // 2
	}

	switch mode {
	case AceLow:
		return normalized
	case AceHigh:
		if normalized == 1 {
			return 14
		}
		return normalized
	case TwoHigh:
		if normalized == 2 {
			return 15
		}
		if normalized == 1 {
			return 14
		}
		return normalized
	default:
		return normalized
	}
}

// SortCards returns a sorted copy of cards
func SortCards(cards []int, mode CardRankingMode, ascending bool) []int {
	sorted := make([]int, len(cards))
	copy(sorted, cards)
	SortCardsInPlace(sorted, mode, ascending)
	return sorted
}

// SortCardsInPlace sorts cards in place
func SortCardsInPlace(cards []int, mode CardRankingMode, ascending bool) {
	sort.Slice(cards, func(i, j int) bool {
		pointA := cards[i] & 0x0F
		pointB := cards[j] & 0x0F
		rankA := cardRank(pointA, mode)
		rankB := cardRank(pointB, mode)

		if rankA != rankB {
			if ascending {
				return rankA < rankB
			}
			return rankA > rankB
		}

		suitA := (cards[i] & 0xF0) >> 4
		suitB := (cards[j] & 0xF0) >> 4
		return suitA < suitB
	})
}
