package game

import "sort"

// HandResult holds the evaluation result of a 5-card hand
type HandResult struct {
	Type       TexasHandType
	Cards      []int
	RankValues []int
}

// Evaluate finds the best 5-card hand from 5-7 cards
func Evaluate(cards []int) HandResult {
	if len(cards) < 5 {
		return HandResult{Type: HighCard, Cards: cards}
	}
	if len(cards) == 5 {
		return evaluateFive(cards)
	}
	return findBestHand(cards)
}

// CompareHands returns positive if h1 > h2, negative if h1 < h2, 0 if equal
func CompareHands(h1, h2 HandResult) int {
	if h1.Type != h2.Type {
		return int(h1.Type) - int(h2.Type)
	}
	for i := 0; i < len(h1.RankValues) && i < len(h2.RankValues); i++ {
		if h1.RankValues[i] != h2.RankValues[i] {
			return h1.RankValues[i] - h2.RankValues[i]
		}
	}
	return compareSuits(h1.Cards, h2.Cards)
}

func compareSuits(cards1, cards2 []int) int {
	s1 := sortByRankAndSuit(cards1)
	s2 := sortByRankAndSuit(cards2)
	for i := len(s1) - 1; i >= 0; i-- {
		sv1 := SuitValue(GetSuit(s1[i]))
		sv2 := SuitValue(GetSuit(s2[i]))
		if sv1 != sv2 {
			return sv1 - sv2
		}
	}
	return 0
}

func sortByRankAndSuit(cards []int) []int {
	sorted := make([]int, len(cards))
	copy(sorted, cards)
	sort.Slice(sorted, func(i, j int) bool {
		ri := TexasRank(GetPoint(sorted[i]))
		rj := TexasRank(GetPoint(sorted[j]))
		if ri != rj {
			return ri < rj
		}
		return SuitValue(GetSuit(sorted[i])) < SuitValue(GetSuit(sorted[j]))
	})
	return sorted
}

func findBestHand(cards []int) HandResult {
	combos := combinations(cards, 5)
	var best *HandResult
	for _, combo := range combos {
		h := evaluateFive(combo)
		if best == nil || CompareHands(h, *best) > 0 {
			best = &h
		}
	}
	return *best
}

func combinations(arr []int, k int) [][]int {
	if k == 1 {
		result := make([][]int, len(arr))
		for i, v := range arr {
			result[i] = []int{v}
		}
		return result
	}
	if k == len(arr) {
		cp := make([]int, len(arr))
		copy(cp, arr)
		return [][]int{cp}
	}
	var result [][]int
	for i := 0; i <= len(arr)-k; i++ {
		rest := arr[i+1:]
		combos := combinations(rest, k-1)
		for _, combo := range combos {
			entry := make([]int, 0, k)
			entry = append(entry, arr[i])
			entry = append(entry, combo...)
			result = append(result, entry)
		}
	}
	return result
}

func evaluateFive(cards []int) HandResult {
	// Sort descending by rank
	sorted := make([]int, 5)
	copy(sorted, cards)
	sort.Slice(sorted, func(i, j int) bool {
		return TexasRank(GetPoint(sorted[i])) > TexasRank(GetPoint(sorted[j]))
	})

	if r := checkRoyalFlush(sorted); r != nil {
		return *r
	}
	if r := checkStraightFlush(sorted); r != nil {
		return *r
	}
	if r := checkFourOfAKind(sorted); r != nil {
		return *r
	}
	if r := checkFullHouse(sorted); r != nil {
		return *r
	}
	if r := checkFlush(sorted); r != nil {
		return *r
	}
	if r := checkStraight(sorted); r != nil {
		return *r
	}
	if r := checkThreeOfAKind(sorted); r != nil {
		return *r
	}
	if r := checkTwoPair(sorted); r != nil {
		return *r
	}
	if r := checkOnePair(sorted); r != nil {
		return *r
	}
	return checkHighCard(sorted)
}

// getRankCounts returns map of rank -> list of cards with that rank
func getRankCounts(cards []int) map[int][]int {
	counts := make(map[int][]int)
	for _, c := range cards {
		r := TexasRank(GetPoint(c))
		counts[r] = append(counts[r], c)
	}
	return counts
}

func isFlush(cards []int) bool {
	suit := GetSuit(cards[0])
	for _, c := range cards[1:] {
		if GetSuit(c) != suit {
			return false
		}
	}
	return true
}

func isStraight(cards []int) (bool, int) {
	ranks := make([]int, len(cards))
	for i, c := range cards {
		ranks[i] = TexasRank(GetPoint(c))
	}
	sort.Sort(sort.Reverse(sort.IntSlice(ranks)))

	// Regular straight
	straight := true
	for i := 1; i < len(ranks); i++ {
		if ranks[i] != ranks[i-1]-1 {
			straight = false
			break
		}
	}
	if straight {
		return true, ranks[0]
	}

	// Wheel: A-2-3-4-5
	if ranks[0] == 14 && ranks[1] == 5 && ranks[2] == 4 && ranks[3] == 3 && ranks[4] == 2 {
		return true, 5
	}
	return false, 0
}

func checkRoyalFlush(cards []int) *HandResult {
	sf := checkStraightFlush(cards)
	if sf != nil && TexasRank(GetPoint(cards[0])) == 14 {
		return &HandResult{Type: RoyalFlush, Cards: cards, RankValues: []int{14}}
	}
	return nil
}

func checkStraightFlush(cards []int) *HandResult {
	if !isFlush(cards) {
		return nil
	}
	ok, high := isStraight(cards)
	if !ok {
		return nil
	}
	return &HandResult{Type: StraightFlush, Cards: cards, RankValues: []int{high}}
}

func checkFourOfAKind(cards []int) *HandResult {
	counts := getRankCounts(cards)
	for rank, rc := range counts {
		if len(rc) == 4 {
			// Find kicker
			for _, c := range cards {
				if TexasRank(GetPoint(c)) != rank {
					return &HandResult{
						Type:       FourOfAKind,
						Cards:      cards,
						RankValues: []int{rank, TexasRank(GetPoint(c))},
					}
				}
			}
		}
	}
	return nil
}

func checkFullHouse(cards []int) *HandResult {
	counts := getRankCounts(cards)
	threeRank, pairRank := -1, -1
	for rank, rc := range counts {
		if len(rc) == 3 {
			threeRank = rank
		}
		if len(rc) == 2 {
			pairRank = rank
		}
	}
	if threeRank != -1 && pairRank != -1 {
		return &HandResult{Type: FullHouse, Cards: cards, RankValues: []int{threeRank, pairRank}}
	}
	return nil
}

func checkFlush(cards []int) *HandResult {
	if !isFlush(cards) {
		return nil
	}
	ranks := make([]int, len(cards))
	for i, c := range cards {
		ranks[i] = TexasRank(GetPoint(c))
	}
	sort.Sort(sort.Reverse(sort.IntSlice(ranks)))
	return &HandResult{Type: Flush, Cards: cards, RankValues: ranks}
}

func checkStraight(cards []int) *HandResult {
	ok, high := isStraight(cards)
	if !ok {
		return nil
	}
	return &HandResult{Type: Straight, Cards: cards, RankValues: []int{high}}
}

func checkThreeOfAKind(cards []int) *HandResult {
	counts := getRankCounts(cards)
	for rank, rc := range counts {
		if len(rc) == 3 {
			var kickers []int
			for _, c := range cards {
				if TexasRank(GetPoint(c)) != rank {
					kickers = append(kickers, TexasRank(GetPoint(c)))
				}
			}
			sort.Sort(sort.Reverse(sort.IntSlice(kickers)))
			rv := append([]int{rank}, kickers...)
			return &HandResult{Type: ThreeOfAKind, Cards: cards, RankValues: rv}
		}
	}
	return nil
}

func checkTwoPair(cards []int) *HandResult {
	counts := getRankCounts(cards)
	var pairs []int
	for rank, rc := range counts {
		if len(rc) == 2 {
			pairs = append(pairs, rank)
		}
	}
	if len(pairs) == 2 {
		sort.Sort(sort.Reverse(sort.IntSlice(pairs)))
		for _, c := range cards {
			r := TexasRank(GetPoint(c))
			if r != pairs[0] && r != pairs[1] {
				return &HandResult{
					Type:       TwoPair,
					Cards:      cards,
					RankValues: []int{pairs[0], pairs[1], r},
				}
			}
		}
	}
	return nil
}

func checkOnePair(cards []int) *HandResult {
	counts := getRankCounts(cards)
	for rank, rc := range counts {
		if len(rc) == 2 {
			var kickers []int
			for _, c := range cards {
				if TexasRank(GetPoint(c)) != rank {
					kickers = append(kickers, TexasRank(GetPoint(c)))
				}
			}
			sort.Sort(sort.Reverse(sort.IntSlice(kickers)))
			rv := append([]int{rank}, kickers...)
			return &HandResult{Type: OnePair, Cards: cards, RankValues: rv}
		}
	}
	return nil
}

func checkHighCard(cards []int) HandResult {
	ranks := make([]int, len(cards))
	for i, c := range cards {
		ranks[i] = TexasRank(GetPoint(c))
	}
	sort.Sort(sort.Reverse(sort.IntSlice(ranks)))
	return HandResult{Type: HighCard, Cards: cards, RankValues: ranks}
}
