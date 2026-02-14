package game

// AutoPlayStrategy defines AI decision logic
type AutoPlayStrategy interface {
	SelectFirstDealerCard(handCards []int) int
	DealerCall(handCards []int, communityCards []int) int // returns 1, 2, or 3
	PlayCards(handCards []int, cardsToPlay int) []int
}

// ConservativeStrategy plays smallest cards, avoids risk
type ConservativeStrategy struct{}

func (s *ConservativeStrategy) SelectFirstDealerCard(handCards []int) int {
	if len(handCards) == 0 {
		return 0
	}
	min := handCards[0]
	for _, c := range handCards[1:] {
		if c < min {
			min = c
		}
	}
	return min
}

func (s *ConservativeStrategy) DealerCall(handCards []int, communityCards []int) int {
	return 1
}

func (s *ConservativeStrategy) PlayCards(handCards []int, cardsToPlay int) []int {
	if len(handCards) < cardsToPlay {
		return handCards
	}
	sorted := SortCards(handCards, AceHigh, true)
	return sorted[:cardsToPlay]
}

// AggressiveStrategy plays biggest cards
type AggressiveStrategy struct{}

func (s *AggressiveStrategy) SelectFirstDealerCard(handCards []int) int {
	if len(handCards) == 0 {
		return 0
	}
	max := handCards[0]
	for _, c := range handCards[1:] {
		if c > max {
			max = c
		}
	}
	return max
}

func (s *AggressiveStrategy) DealerCall(handCards []int, communityCards []int) int {
	return 3
}

func (s *AggressiveStrategy) PlayCards(handCards []int, cardsToPlay int) []int {
	if len(handCards) < cardsToPlay {
		return handCards
	}
	sorted := SortCards(handCards, AceHigh, false) // descending
	return sorted[:cardsToPlay]
}

// RandomStrategy uses random selection
type RandomStrategy struct{}

func (s *RandomStrategy) SelectFirstDealerCard(handCards []int) int {
	if len(handCards) == 0 {
		return 0
	}
	return handCards[randIntn(len(handCards))]
}

func (s *RandomStrategy) DealerCall(handCards []int, communityCards []int) int {
	options := []int{1, 2, 3}
	return options[randIntn(3)]
}

func (s *RandomStrategy) PlayCards(handCards []int, cardsToPlay int) []int {
	if len(handCards) < cardsToPlay {
		return handCards
	}
	// Shuffle and take first N
	shuffled := make([]int, len(handCards))
	copy(shuffled, handCards)
	for i := len(shuffled) - 1; i > 0; i-- {
		j := randIntn(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}
	return shuffled[:cardsToPlay]
}
