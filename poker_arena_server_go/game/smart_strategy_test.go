package game

import "testing"

// Helper to make a card from suit and point
func card(suit, point int) int {
	return suit | point
}

// ==================== Combinations ====================

func TestCombinations_C52(t *testing.T) {
	arr := []int{1, 2, 3, 4, 5}
	got := Combinations(arr, 2)
	if len(got) != 10 {
		t.Errorf("C(5,2) = %d, want 10", len(got))
	}
}

func TestCombinations_C53(t *testing.T) {
	arr := []int{1, 2, 3, 4, 5}
	got := Combinations(arr, 3)
	if len(got) != 10 {
		t.Errorf("C(5,3) = %d, want 10", len(got))
	}
}

func TestCombinations_Full(t *testing.T) {
	arr := []int{1, 2, 3}
	got := Combinations(arr, 3)
	if len(got) != 1 {
		t.Errorf("C(3,3) = %d, want 1", len(got))
	}
}

// ==================== SelectFirstDealerCard ====================

func TestSmartStrategy_SelectFirstDealerCard_PicksHighest(t *testing.T) {
	s := &SmartStrategy{}
	hand := []int{
		card(SuitDiamond, PointK),
		card(SuitSpade, PointA),
		card(SuitHeart, Point5),
	}
	got := s.SelectFirstDealerCard(hand)
	want := card(SuitSpade, PointA)
	if got != want {
		t.Errorf("got 0x%x, want 0x%x (Ace of Spades)", got, want)
	}
}

func TestSmartStrategy_SelectFirstDealerCard_SuitTiebreak(t *testing.T) {
	s := &SmartStrategy{}
	hand := []int{
		card(SuitHeart, PointA),
		card(SuitSpade, PointA),
		card(SuitDiamond, PointA),
	}
	got := s.SelectFirstDealerCard(hand)
	want := card(SuitSpade, PointA) // Spade has highest suit value
	if got != want {
		t.Errorf("got 0x%x, want 0x%x (Ace of Spades)", got, want)
	}
}

func TestSmartStrategy_SelectFirstDealerCard_Empty(t *testing.T) {
	s := &SmartStrategy{}
	got := s.SelectFirstDealerCard([]int{})
	if got != 0 {
		t.Errorf("got %d, want 0 for empty hand", got)
	}
}

// ==================== PlayCards ====================

func TestSmartStrategy_PlayCards_CompletesFlush(t *testing.T) {
	s := &SmartStrategy{}
	// Community: 3 hearts + 1 diamond
	community := []int{
		card(SuitHeart, Point3),
		card(SuitHeart, Point7),
		card(SuitHeart, PointJ),
		card(SuitDiamond, Point4),
	}
	// Hand: one heart (completes flush) + other suits
	hand := []int{
		card(SuitHeart, PointA),   // this should be picked for flush
		card(SuitSpade, PointK),
		card(SuitClub, PointQ),
	}
	got := s.PlayCards(hand, 1, community)
	if len(got) != 1 {
		t.Fatalf("expected 1 card, got %d", len(got))
	}
	// Should pick the heart to complete a flush
	if GetSuit(got[0]) != SuitHeart {
		t.Errorf("expected heart card for flush, got suit 0x%x", GetSuit(got[0]))
	}
}

func TestSmartStrategy_PlayCards_CompletesFullHouse(t *testing.T) {
	s := &SmartStrategy{}
	// Community: pair of Kings + two others
	community := []int{
		card(SuitHeart, PointK),
		card(SuitSpade, PointK),
		card(SuitDiamond, Point5),
		card(SuitClub, Point8),
	}
	// Hand: one King (makes trips) + a 5 (makes full house with community 5) + junk
	hand := []int{
		card(SuitClub, PointK),    // trips Kings
		card(SuitHeart, Point5),   // pairs with community 5 -> full house
		card(SuitDiamond, Point3),
	}
	got := s.PlayCards(hand, 2, community)
	if len(got) != 2 {
		t.Fatalf("expected 2 cards, got %d", len(got))
	}
	// Merge and evaluate to verify full house
	merged := append(got, community...)
	result := Evaluate(merged)
	if result.Type != FullHouse {
		t.Errorf("expected FullHouse, got %v", GetChineseName(result.Type))
	}
}

func TestSmartStrategy_PlayCards_HandNotEnough(t *testing.T) {
	s := &SmartStrategy{}
	community := []int{
		card(SuitHeart, Point3),
		card(SuitDiamond, Point7),
		card(SuitClub, PointJ),
		card(SuitSpade, Point4),
	}
	hand := []int{card(SuitHeart, PointA)}
	got := s.PlayCards(hand, 1, community)
	if len(got) != 1 || got[0] != hand[0] {
		t.Errorf("expected the only card in hand, got %v", got)
	}
}

func TestSmartStrategy_PlayCards_NoCommunity(t *testing.T) {
	s := &SmartStrategy{}
	hand := []int{
		card(SuitSpade, PointA),
		card(SuitHeart, PointK),
		card(SuitDiamond, Point3),
	}
	// Should not panic with empty community
	got := s.PlayCards(hand, 1, []int{})
	if len(got) != 1 {
		t.Fatalf("expected 1 card, got %d", len(got))
	}
}

// ==================== DealerCall ====================

func TestSmartStrategy_DealerCall_PrefersHigherScore(t *testing.T) {
	s := &SmartStrategy{}
	// Community: 3 hearts
	community := []int{
		card(SuitHeart, Point3),
		card(SuitHeart, Point7),
		card(SuitHeart, PointJ),
		card(SuitHeart, PointQ),
	}
	// Hand: one heart (call=1 completes flush=9pts) + non-hearts
	hand := []int{
		card(SuitHeart, PointA),
		card(SuitSpade, Point4),
		card(SuitClub, Point6),
		card(SuitDiamond, Point9),
		card(SuitSpade, Point2),
	}
	got := s.DealerCall(hand, community)
	// Call=1 with heart A gives a flush (9 pts), likely the best option
	// Verify it picks a reasonable call number (should be 1 for flush)
	if got < 1 || got > 3 {
		t.Errorf("invalid call number: %d", got)
	}
	// Verify the actual score by simulating
	_, result1 := findBestPlay(hand, 1, community)
	score1 := GetHandScore(result1.Type)
	_, result := findBestPlay(hand, got, community)
	scoreGot := GetHandScore(result.Type)
	if scoreGot < score1 {
		t.Errorf("DealerCall chose call=%d (score %d) but call=1 gives score %d", got, scoreGot, score1)
	}
}

func TestSmartStrategy_DealerCall_PrefersSmallerCallOnTie(t *testing.T) {
	s := &SmartStrategy{}
	// Community: A K Q J (all different suits) - already a straight
	community := []int{
		card(SuitHeart, PointA),
		card(SuitSpade, PointK),
		card(SuitDiamond, PointQ),
		card(SuitClub, PointJ),
	}
	// Hand: 10 of different suits + junk - call=1 with any 10 completes straight
	hand := []int{
		card(SuitHeart, Point10),
		card(SuitSpade, Point10),
		card(SuitDiamond, Point3),
		card(SuitClub, Point4),
		card(SuitHeart, Point5),
	}
	got := s.DealerCall(hand, community)
	// Call=1 already gives a straight (8 pts). Call=2 or 3 might also give straight.
	// On tie, should prefer smaller call.
	if got != 1 {
		// Verify it's actually a tie scenario
		_, r1 := findBestPlay(hand, 1, community)
		_, rGot := findBestPlay(hand, got, community)
		s1 := GetHandScore(r1.Type)
		sGot := GetHandScore(rGot.Type)
		if sGot <= s1 {
			t.Errorf("expected call=1 on tie, got call=%d (score %d vs %d)", got, sGot, s1)
		}
	}
}

func TestSmartStrategy_DealerCall_SmallHand(t *testing.T) {
	s := &SmartStrategy{}
	community := []int{
		card(SuitHeart, Point3),
		card(SuitDiamond, Point7),
		card(SuitClub, PointJ),
		card(SuitSpade, Point4),
	}
	hand := []int{card(SuitHeart, PointA)} // only 1 card
	got := s.DealerCall(hand, community)
	if got != 1 {
		t.Errorf("with 1 card in hand, should call 1, got %d", got)
	}
}

func TestSmartStrategy_DealerCall_TwoCards(t *testing.T) {
	s := &SmartStrategy{}
	community := []int{
		card(SuitHeart, Point3),
		card(SuitDiamond, Point7),
		card(SuitClub, PointJ),
		card(SuitSpade, Point4),
	}
	hand := []int{
		card(SuitHeart, PointA),
		card(SuitSpade, PointK),
	}
	got := s.DealerCall(hand, community)
	if got < 1 || got > 2 {
		t.Errorf("with 2 cards in hand, should call 1 or 2, got %d", got)
	}
}

// ==================== findBestPlay ====================

func TestFindBestPlay_PicksBestCombination(t *testing.T) {
	// Community: 4 hearts -> call=1 with a heart gives flush
	community := []int{
		card(SuitHeart, Point3),
		card(SuitHeart, Point7),
		card(SuitHeart, PointJ),
		card(SuitHeart, Point4),
	}
	hand := []int{
		card(SuitHeart, PointA),
		card(SuitSpade, PointA),
		card(SuitClub, Point2),
	}
	chosen, result := findBestPlay(hand, 1, community)
	if len(chosen) != 1 {
		t.Fatalf("expected 1 card chosen, got %d", len(chosen))
	}
	// Heart A completes a 5-heart flush
	if result.Type != Flush {
		t.Errorf("expected Flush, got %v", GetChineseName(result.Type))
	}
	if GetSuit(chosen[0]) != SuitHeart {
		t.Errorf("expected heart card chosen, got suit 0x%x", GetSuit(chosen[0]))
	}
}
