package game

// ==================== Wild Card (赖子) Logic ====================

// WildCardPoint returns the card point value of the wild card for a given level.
// The wild card is the heart-suit card of the current level.
func WildCardPoint(currentLevel int) int {
	return levelToCardPoint(currentLevel)
}

// WildCard returns the full card value of the wild card (Heart suit + level point).
func WildCard(currentLevel int) int {
	return SuitHeart | WildCardPoint(currentLevel)
}

// IsWildCard checks if a card is the wild card for the current level.
func IsWildCard(card int, currentLevel int) bool {
	return card == WildCard(currentLevel)
}

// SplitWilds separates a hand into normal cards and wild cards.
func SplitWilds(cards []int, currentLevel int) (normal []int, wilds []int) {
	for _, c := range cards {
		if IsWildCard(c, currentLevel) {
			wilds = append(wilds, c)
		} else {
			normal = append(normal, c)
		}
	}
	return
}

// IsJoker returns true if the card is a joker (black or red).
func IsJoker(card int) bool {
	return GetSuit(card) == SuitJoker
}
