package game

// ==================== Cipher Trace Auto-Play Strategy ====================

// CTAutoStrategy provides simple auto-play decisions for Cipher Trace.
type CTAutoStrategy struct{}

// PickSignalSuit chooses the suit with the most level cards in hand.
func (s *CTAutoStrategy) PickSignalSuit(hand []int, currentLevel int) int {
	levelPoint := levelToCardPoint(currentLevel)
	suitCount := make(map[int]int)

	for _, card := range hand {
		if GetPoint(card) == levelPoint && !IsJoker(card) {
			suitCount[GetSuit(card)]++
		}
	}

	bestSuit := -1
	bestCount := 0
	for suit, count := range suitCount {
		if count > bestCount {
			bestCount = count
			bestSuit = suit
		}
	}
	return bestSuit
}

// PickPlay chooses cards to play. Returns nil to pass.
// Simple strategy: play the smallest valid single/pair/etc. that beats the table.
func (s *CTAutoStrategy) PickPlay(hand []int, toBeat *CTPlayedHand, currentLevel int) []int {
	if toBeat == nil {
		// Free lead: play smallest single
		if len(hand) > 0 {
			return []int{hand[0]}
		}
		return nil
	}

	// Try to find the smallest hand of the same type that beats toBeat
	switch toBeat.Type {
	case CTSingle:
		return s.findBeatingSingle(hand, toBeat, currentLevel)
	case CTPair:
		return s.findBeatingPair(hand, toBeat, currentLevel)
	default:
		// For complex types, just pass
		return nil
	}
}

func (s *CTAutoStrategy) findBeatingSingle(hand []int, toBeat *CTPlayedHand, currentLevel int) []int {
	for _, card := range hand {
		candidate := ParseCTHand([]int{card}, currentLevel)
		if candidate != nil && CanBeatCT(toBeat, candidate) {
			return []int{card}
		}
	}
	return nil
}

func (s *CTAutoStrategy) findBeatingPair(hand []int, toBeat *CTPlayedHand, currentLevel int) []int {
	// Group cards by point
	groups := make(map[int][]int)
	for _, card := range hand {
		if !IsJoker(card) {
			p := GetPoint(card)
			groups[p] = append(groups[p], card)
		}
	}

	for _, cards := range groups {
		if len(cards) >= 2 {
			pair := cards[:2]
			candidate := ParseCTHand(pair, currentLevel)
			if candidate != nil && CanBeatCT(toBeat, candidate) {
				return pair
			}
		}
	}
	return nil
}

// PickTributeCard picks the highest non-wild non-joker card to give as tribute.
func (s *CTAutoStrategy) PickTributeCard(hand []int, currentLevel int) int {
	bestCard := -1
	bestRank := -1

	for _, card := range hand {
		if IsJoker(card) || IsWildCard(card, currentLevel) {
			continue
		}
		rank := ctCardRank(GetPoint(card))
		if rank > bestRank {
			bestRank = rank
			bestCard = card
		}
	}
	return bestCard
}

// PickReturnCard picks the smallest valid card to return (point < 10, not level, not joker).
func (s *CTAutoStrategy) PickReturnCard(hand []int, currentLevel int, signalCard int) int {
	levelPoint := levelToCardPoint(currentLevel)

	for _, card := range hand {
		if IsJoker(card) {
			continue
		}
		point := GetPoint(card)
		if ctCardRank(point) >= 10 {
			continue
		}
		if point == levelPoint {
			continue
		}
		// Don't return the only signal card
		if card == signalCard {
			count := 0
			for _, c := range hand {
				if c == signalCard {
					count++
				}
			}
			if count <= 1 {
				continue
			}
		}
		return card
	}
	return -1
}
