package game

// SmartStrategy evaluates all possible card combinations to find the optimal play.
// It maximizes the Texas Hold'em hand score by exhaustively searching C(n, k) subsets.
type SmartStrategy struct{}

func (s *SmartStrategy) SelectFirstDealerCard(handCards []int) int {
	if len(handCards) == 0 {
		return 0
	}
	best := handCards[0]
	for _, c := range handCards[1:] {
		if compareByRankAsc(c, best) > 0 {
			best = c
		}
	}
	return best
}

func (s *SmartStrategy) DealerCall(handCards []int, communityCards []int) int {
	bestCallNum := 1
	_, bestResult := findBestPlay(handCards, 1, communityCards)
	bestScore := GetHandScore(bestResult.Type)

	for callNum := 2; callNum <= 3; callNum++ {
		if callNum > len(handCards) {
			break
		}
		_, result := findBestPlay(handCards, callNum, communityCards)
		score := GetHandScore(result.Type)
		if score > bestScore {
			bestScore = score
			bestCallNum = callNum
		}
	}

	return bestCallNum
}

func (s *SmartStrategy) PlayCards(handCards []int, cardsToPlay int, communityCards []int) []int {
	cards, _ := findBestPlay(handCards, cardsToPlay, communityCards)
	return cards
}

// findBestPlay returns the optimal card selection and its evaluated hand result.
func findBestPlay(handCards []int, cardsToPlay int, communityCards []int) ([]int, HandResult) {
	if len(handCards) <= cardsToPlay {
		merged := make([]int, 0, len(handCards)+len(communityCards))
		merged = append(merged, handCards...)
		merged = append(merged, communityCards...)
		return handCards, Evaluate(merged)
	}

	// Fallback if no community cards: play highest-ranked cards
	if len(communityCards) == 0 {
		sorted := SortCards(handCards, AceHigh, false)
		chosen := sorted[:cardsToPlay]
		return chosen, HandResult{Type: HighCard}
	}

	combos := Combinations(handCards, cardsToPlay)
	var bestCards []int
	var bestResult *HandResult

	for _, combo := range combos {
		merged := make([]int, 0, len(combo)+len(communityCards))
		merged = append(merged, combo...)
		merged = append(merged, communityCards...)
		result := Evaluate(merged)
		if bestResult == nil || CompareHands(result, *bestResult) > 0 {
			bestResult = &result
			bestCards = combo
		}
	}

	return bestCards, *bestResult
}
