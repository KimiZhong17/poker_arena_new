package game

import "sort"

// ==================== Card Ranking for Cipher Trace ====================

// ctCardRank returns the rank of a card point in Cipher Trace ordering.
// Order: 3,4,5,6,7,8,9,10,J,Q,K,A,2 (2 is highest normal card).
// Level card keeps its natural rank (no special rank boost).
func ctCardRank(point int) int {
	if point == Point2 {
		return 15 // highest normal
	}
	if point == PointA {
		return 14
	}
	return point // 3-13
}

// ctJokerRank returns rank for jokers (above all normal cards).
func ctJokerRank(card int) int {
	point := GetPoint(card)
	if point == RedJoker {
		return 100
	}
	if point == BlackJoker {
		return 99
	}
	return 0
}

// ==================== Frequency Analysis ====================

// cardFrequency counts occurrences of each point value in a set of cards.
// Jokers are counted separately.
func cardFrequency(cards []int) (freq map[int]int, jokerCount int) {
	freq = make(map[int]int)
	for _, c := range cards {
		if IsJoker(c) {
			jokerCount++
		} else {
			freq[GetPoint(c)]++
		}
	}
	return
}

// ==================== Hand Parsing ====================

// ParseCTHand identifies the hand type of a set of played cards.
// currentLevel is needed for wild card identification.
// Returns nil if the cards don't form a valid hand.
func ParseCTHand(cards []int, currentLevel int) *CTPlayedHand {
	if len(cards) == 0 {
		return nil
	}

	normal, wilds := SplitWilds(cards, currentLevel)
	wildCount := len(wilds)

	// Check joker bomb first (all jokers, must include red joker)
	if h := tryJokerBomb(cards); h != nil {
		return h
	}

	// Check normal bomb (4+ same point, no wilds needed for basic check)
	if h := tryBomb(normal, wilds, wildCount, cards); h != nil {
		return h
	}

	// Single
	if len(cards) == 1 {
		c := cards[0]
		rank := ctCardRank(GetPoint(c))
		if IsJoker(c) {
			rank = ctJokerRank(c)
		}
		return &CTPlayedHand{Type: CTSingle, Cards: cards, MainRank: rank, Length: 1}
	}

	// Pair
	if h := tryPair(normal, wildCount, cards); h != nil {
		return h
	}

	// Triple (with or without pair)
	if h := tryTriple(normal, wilds, wildCount, cards, currentLevel); h != nil {
		return h
	}

	// Straight (5+ consecutive singles)
	if h := tryStraight(normal, wildCount, cards, currentLevel); h != nil {
		return h
	}

	// Consecutive pairs (3+ consecutive pairs)
	if h := tryConsecPair(normal, wildCount, cards, currentLevel); h != nil {
		return h
	}

	// Steel plate (2+ consecutive triples, no attachments)
	if h := trySteelPlate(normal, wildCount, cards, currentLevel); h != nil {
		return h
	}

	// Plane (2+ consecutive triples + same number of pairs)
	if h := tryPlane(normal, wildCount, cards, currentLevel); h != nil {
		return h
	}

	return nil // invalid hand
}

// ==================== Joker Bomb ====================

func tryJokerBomb(cards []int) *CTPlayedHand {
	if len(cards) < 2 {
		return nil
	}
	hasRedJoker := false
	for _, c := range cards {
		if !IsJoker(c) {
			return nil
		}
		if GetPoint(c) == RedJoker {
			hasRedJoker = true
		}
	}
	if !hasRedJoker {
		return nil
	}
	return &CTPlayedHand{
		Type: CTJokerBomb, Cards: cards,
		MainRank: 100, BombSize: len(cards),
	}
}

// ==================== Normal Bomb ====================

func tryBomb(normal []int, wilds []int, wildCount int, allCards []int) *CTPlayedHand {
	totalCards := len(normal) + wildCount
	if totalCards < 4 {
		return nil
	}

	// All normal cards must be the same point
	freq, _ := cardFrequency(normal)

	// Must have exactly one point value (plus wilds)
	if len(freq) != 1 {
		return nil
	}

	var point int
	var count int
	for p, c := range freq {
		point = p
		count = c
	}

	// With wilds, total must be >= 4 and all contribute to the same point
	total := count + wildCount
	if total < 4 || total != totalCards {
		return nil
	}

	return &CTPlayedHand{
		Type: CTBomb, Cards: allCards,
		MainRank: ctCardRank(point), BombSize: total,
	}
}

// ==================== Pair ====================

func tryPair(normal []int, wildCount int, allCards []int) *CTPlayedHand {
	if len(allCards) != 2 {
		return nil
	}

	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil // jokers can't form pairs
	}

	// Two same-point cards, or one card + one wild
	if len(freq) == 1 {
		for p := range freq {
			return &CTPlayedHand{Type: CTPair, Cards: allCards, MainRank: ctCardRank(p), Length: 1}
		}
	}
	if len(freq) == 1 && wildCount == 1 {
		for p := range freq {
			return &CTPlayedHand{Type: CTPair, Cards: allCards, MainRank: ctCardRank(p), Length: 1}
		}
	}
	if len(freq) == 0 && wildCount == 2 {
		// Two wilds = pair of wild card point
		return nil // ambiguous, not allowed as pair
	}

	return nil
}

// ==================== Triple ====================

func tryTriple(normal []int, wilds []int, wildCount int, allCards []int, currentLevel int) *CTPlayedHand {
	totalNonJoker := len(normal) + wildCount
	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil
	}

	// Pure triple (3 cards)
	if len(allCards) == 3 && totalNonJoker == 3 {
		if len(freq) == 1 {
			for p, c := range freq {
				if c+wildCount == 3 {
					return &CTPlayedHand{Type: CTTriple, Cards: allCards, MainRank: ctCardRank(p), Length: 1}
				}
			}
		}
	}

	// Triple with pair (5 cards)
	if len(allCards) == 5 {
		// Find the triple part and pair part
		// Try each point as the triple
		for p, c := range freq {
			wildsNeeded := 3 - c
			if wildsNeeded < 0 || wildsNeeded > wildCount {
				continue
			}
			remainingWilds := wildCount - wildsNeeded
			// Remaining normal cards + remaining wilds should form a pair
			remainingNormal := totalNonJoker - 3
			if remainingNormal+remainingWilds == 2 {
				// Check the remaining cards form a valid pair
				return &CTPlayedHand{Type: CTTripleWithPair, Cards: allCards, MainRank: ctCardRank(p), Length: 1}
			}
		}
	}

	return nil
}

// ==================== Straight ====================

// isSequencePoint returns true if the point can participate in sequences.
// Level cards, 2s, and jokers cannot be in straights.
func isSequencePoint(point int, currentLevel int) bool {
	if point == Point2 {
		return false
	}
	if point == levelToCardPoint(currentLevel) && currentLevel != 2 {
		return false // level card excluded (unless level is 2, already handled above)
	}
	return point >= Point3 && point <= PointA
}

func tryStraight(normal []int, wildCount int, allCards []int, currentLevel int) *CTPlayedHand {
	if len(allCards) < 5 {
		return nil
	}

	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil // jokers can't be in straights
	}

	// Collect valid sequence points
	points := make([]int, 0)
	for p, c := range freq {
		if !isSequencePoint(p, currentLevel) {
			return nil // non-sequence card present
		}
		if c > 1 {
			return nil // duplicates not allowed in straight
		}
		points = append(points, p)
	}

	sort.Slice(points, func(i, j int) bool {
		return ctCardRank(points[i]) < ctCardRank(points[j])
	})

	// Check if points + wilds form a consecutive sequence
	if len(points) == 0 {
		return nil
	}

	targetLen := len(allCards)
	startRank := ctCardRank(points[0])

	// Try to fill gaps with wilds
	wildsLeft := wildCount
	pointIdx := 0
	for i := 0; i < targetLen; i++ {
		expectedRank := startRank + i
		// Skip level card rank in sequence
		levelPoint := levelToCardPoint(currentLevel)
		if currentLevel != 2 && expectedRank == ctCardRank(levelPoint) {
			// This rank is the level card, skip it
			targetLen++ // need one more to compensate
			continue
		}
		if expectedRank > 15 { // beyond 2
			return nil
		}

		if pointIdx < len(points) && ctCardRank(points[pointIdx]) == expectedRank {
			pointIdx++
		} else {
			wildsLeft--
			if wildsLeft < 0 {
				return nil
			}
		}
	}

	if pointIdx != len(points) || wildsLeft != 0 {
		return nil
	}

	highRank := startRank + len(allCards) - 1
	return &CTPlayedHand{
		Type: CTStraight, Cards: allCards,
		MainRank: highRank, Length: len(allCards),
	}
}

// ==================== Consecutive Pairs ====================

func tryConsecPair(normal []int, wildCount int, allCards []int, currentLevel int) *CTPlayedHand {
	if len(allCards) < 6 || len(allCards)%2 != 0 {
		return nil
	}

	pairCount := len(allCards) / 2
	if pairCount < 3 {
		return nil
	}

	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil
	}

	// Collect points that have pairs or can be completed with wilds
	points := make([]int, 0)
	wildsUsed := 0
	for p, c := range freq {
		if !isSequencePoint(p, currentLevel) {
			return nil
		}
		if c > 2 {
			return nil // more than a pair
		}
		if c == 1 {
			wildsUsed++ // need one wild to complete pair
		}
		points = append(points, p)
	}

	if wildsUsed > wildCount {
		return nil
	}

	sort.Slice(points, func(i, j int) bool {
		return ctCardRank(points[i]) < ctCardRank(points[j])
	})

	// Check consecutive
	if len(points) != pairCount {
		// Some pairs are entirely from wilds — simplified: reject for now
		return nil
	}

	for i := 1; i < len(points); i++ {
		if ctCardRank(points[i])-ctCardRank(points[i-1]) != 1 {
			return nil
		}
	}

	return &CTPlayedHand{
		Type: CTConsecPair, Cards: allCards,
		MainRank: ctCardRank(points[len(points)-1]), Length: pairCount,
	}
}

// ==================== Steel Plate ====================

func trySteelPlate(normal []int, wildCount int, allCards []int, currentLevel int) *CTPlayedHand {
	if len(allCards) < 6 || len(allCards)%3 != 0 {
		return nil
	}

	tripleCount := len(allCards) / 3
	if tripleCount < 2 {
		return nil
	}

	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil
	}

	points := make([]int, 0)
	wildsUsed := 0
	for p, c := range freq {
		if !isSequencePoint(p, currentLevel) {
			return nil
		}
		if c > 3 {
			return nil
		}
		needed := 3 - c
		wildsUsed += needed
		points = append(points, p)
	}

	if wildsUsed > wildCount {
		return nil
	}

	sort.Slice(points, func(i, j int) bool {
		return ctCardRank(points[i]) < ctCardRank(points[j])
	})

	if len(points) != tripleCount {
		return nil
	}

	for i := 1; i < len(points); i++ {
		if ctCardRank(points[i])-ctCardRank(points[i-1]) != 1 {
			return nil
		}
	}

	return &CTPlayedHand{
		Type: CTSteelPlate, Cards: allCards,
		MainRank: ctCardRank(points[len(points)-1]), Length: tripleCount,
	}
}

// ==================== Plane ====================

func tryPlane(normal []int, wildCount int, allCards []int, currentLevel int) *CTPlayedHand {
	// Plane = N consecutive triples + N pairs, total = 5*N cards
	if len(allCards) < 10 || len(allCards)%5 != 0 {
		return nil
	}

	tripleCount := len(allCards) / 5
	if tripleCount < 2 {
		return nil
	}

	freq, jokers := cardFrequency(normal)
	if jokers > 0 {
		return nil
	}

	// Identify triple candidates (count >= 3 or completable with wilds)
	type candidate struct {
		point int
		count int
	}
	candidates := make([]candidate, 0)
	otherCards := 0
	for p, c := range freq {
		if c >= 3 && isSequencePoint(p, currentLevel) {
			candidates = append(candidates, candidate{p, c})
		} else {
			otherCards += c
		}
	}

	// Sort candidates by rank
	sort.Slice(candidates, func(i, j int) bool {
		return ctCardRank(candidates[i].point) < ctCardRank(candidates[j].point)
	})

	// Find consecutive run of tripleCount
	if len(candidates) < tripleCount {
		return nil
	}

	for start := 0; start <= len(candidates)-tripleCount; start++ {
		consecutive := true
		for i := 1; i < tripleCount; i++ {
			if ctCardRank(candidates[start+i].point)-ctCardRank(candidates[start+i-1].point) != 1 {
				consecutive = false
				break
			}
		}
		if !consecutive {
			continue
		}

		// Check remaining cards form tripleCount pairs
		usedInTriples := 0
		for i := start; i < start+tripleCount; i++ {
			usedInTriples += 3
		}
		remainingCards := len(allCards) - usedInTriples
		if remainingCards == tripleCount*2 {
			highRank := ctCardRank(candidates[start+tripleCount-1].point)
			return &CTPlayedHand{
				Type: CTPlane, Cards: allCards,
				MainRank: highRank, Length: tripleCount,
			}
		}
	}

	return nil
}

// ==================== Comparison ====================

// CanBeatCT checks if candidate hand can beat the current hand on the table.
func CanBeatCT(current, candidate *CTPlayedHand) bool {
	if current == nil {
		return true // free lead, anything goes
	}

	// Bombs beat non-bombs
	if candidate.IsBomb() && !current.IsBomb() {
		return true
	}
	if !candidate.IsBomb() && current.IsBomb() {
		return false
	}

	// Both bombs: compare by hierarchy
	if candidate.IsBomb() && current.IsBomb() {
		return compareBombs(current, candidate)
	}

	// Same type required
	if candidate.Type != current.Type {
		return false
	}

	// Same length required for sequence types
	if candidate.Length != current.Length {
		return false
	}

	// Higher rank wins
	return candidate.MainRank > current.MainRank
}

// compareBombs: joker bomb > same-size normal bomb by rank > larger normal bomb > smaller normal bomb.
// Rule: joker bomb (x cards with red joker) > 2x same-value > (2x-1) same-value > ... > 4 same-value.
func compareBombs(current, candidate *CTPlayedHand) bool {
	// Joker bomb vs joker bomb: more cards wins, then by rank (red > black)
	if candidate.Type == CTJokerBomb && current.Type == CTJokerBomb {
		if candidate.BombSize != current.BombSize {
			return candidate.BombSize > current.BombSize
		}
		return candidate.MainRank > current.MainRank
	}

	// Joker bomb beats normal bomb if joker count > 2 * normal bomb count
	// Actually per rules: joker bomb (x cards with red joker) > 2x same-value bomb
	if candidate.Type == CTJokerBomb && current.Type == CTBomb {
		return candidate.BombSize > current.BombSize // simplified: more cards wins
	}
	if candidate.Type == CTBomb && current.Type == CTJokerBomb {
		return false // normal bomb can't beat joker bomb of same or larger size
	}

	// Both normal bombs: more cards wins, same count → higher rank wins
	if candidate.BombSize != current.BombSize {
		return candidate.BombSize > current.BombSize
	}
	return candidate.MainRank > current.MainRank
}
