package game

import "math/rand"

// BuildDeckWithJokers creates a standard 54-card deck (52 cards + 2 jokers).
func BuildDeckWithJokers() []int {
	deck := make([]int, 0, 54)
	suits := []int{SuitSpade, SuitHeart, SuitClub, SuitDiamond}
	points := []int{Point3, Point4, Point5, Point6, Point7, Point8, Point9, Point10,
		PointJ, PointQ, PointK, PointA, Point2}

	for _, suit := range suits {
		for _, point := range points {
			deck = append(deck, suit|point)
		}
	}
	deck = append(deck, SuitJoker|BlackJoker)
	deck = append(deck, SuitJoker|RedJoker)
	return deck
}

// BuildMultiDeck creates n copies of a standard 54-card deck.
func BuildMultiDeck(n int) []int {
	single := BuildDeckWithJokers()
	deck := make([]int, 0, len(single)*n)
	for i := 0; i < n; i++ {
		deck = append(deck, single...)
	}
	return deck
}

// ShuffleDeck shuffles a deck in place.
func ShuffleDeck(deck []int) {
	rand.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
}

// DeckCountForPlayers returns the number of 54-card decks needed for a given player count.
// 5-6 players: 3 decks (162 cards), 7-8 players: 4 decks (216 cards).
func DeckCountForPlayers(playerCount int) int {
	if playerCount <= 6 {
		return 3
	}
	return 4
}
