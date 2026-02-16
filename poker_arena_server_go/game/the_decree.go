package game

import (
	"math/rand"
	"poker-arena-server/util"
	"time"
)

// TheDecreeGameState enumeration
const (
	StateSetup                = "setup"
	StateFirstDealerSelection = "first_dealer"
	StateDealerCall           = "dealer_call"
	StatePlayerSelection      = "player_selection"
	StateShowdown             = "showdown"
	StateScoring              = "scoring"
	StateRefill               = "refill"
	StateGameOver             = "game_over"
)

// RoundState holds current round info
type RoundState struct {
	RoundNumber  int
	DealerID     string
	CardsToPlay  int
	PlayerPlays  map[string][]int
	RoundWinnerID string
	RoundLoserID  string
	HandResults  map[string]*HandResult
}

// GameCallbacks for game -> room communication
type GameCallbacks struct {
	OnGameStarted                func(communityCards []int, state string)
	OnPlayerDealt                func(playerID string, cards []int)
	OnRequestFirstDealerSelection func(state string)
	OnPlayerSelectedCard         func(playerID string)
	OnFirstDealerReveal          func(dealerID string, selections map[string]int, state string)
	OnNewRound                   func(roundNumber int, dealerID string, state string)
	OnDealerCall                 func(dealerID string, cardsToPlay int, state string)
	OnPlayerPlayed               func(playerID string, cardCount int)
	OnShowdown                   func(results map[string]*HandResult, state string)
	OnRoundEnd                   func(winnerID, loserID string, scores map[string]int, state string)
	OnHandsRefilled              func(deckSize int)
	OnGameOver                   func(winnerID string, scores map[string]int, totalRounds int, state string)
	OnPlayerAutoChanged          func(playerID string, isAuto bool, reason string)
	// Timer scheduling delegated to room layer
	ScheduleAutoAction           func(playerID string)
	ClearAutoPlayTimer           func(playerID string)
	ScheduleShowdownDelay        func(callback func())
	ScheduleDealDelay            func(callback func())
}

// TheDecreeMode implements the full game state machine
type TheDecreeMode struct {
	state                  string
	playerManager          *PlayerManager
	communityCards         []int
	deck                   []int
	currentRound           *RoundState
	callbacks              *GameCallbacks
	firstDealerSelections  map[string]int
	autoPlayStrategy       AutoPlayStrategy
	isActive               bool
}

func NewTheDecreeMode(callbacks *GameCallbacks) *TheDecreeMode {
	return &TheDecreeMode{
		state:                 StateSetup,
		playerManager:         NewPlayerManager(),
		communityCards:        []int{},
		deck:                  []int{},
		firstDealerSelections: make(map[string]int),
		autoPlayStrategy:      &ConservativeStrategy{},
		callbacks:             callbacks,
	}
}

// InitGame initializes the game with player info
func (g *TheDecreeMode) InitGame(playerInfos []PlayerInfo) {
	if len(playerInfos) < 2 || len(playerInfos) > 4 {
		util.Error("TheDecree", "Invalid player count: %d (need 2-4)", len(playerInfos))
		return
	}
	g.playerManager.CreatePlayers(playerInfos)
	g.state = StateSetup
	g.initializeDeck()
}

// StartGame begins the game (called externally, schedules delayed dealing)
func (g *TheDecreeMode) StartGame() {
	util.Info("TheDecree", "Starting game")
	g.isActive = true

	// Delay dealing to give client time to register event listeners
	if g.callbacks != nil && g.callbacks.ScheduleDealDelay != nil {
		g.callbacks.ScheduleDealDelay(func() {
			g.DealCards()
		})
	} else {
		g.DealCards()
	}
}

// DealCards deals community and hand cards
func (g *TheDecreeMode) DealCards() {
	// Deal 4 community cards
	g.communityCards = []int{g.drawCard(), g.drawCard(), g.drawCard(), g.drawCard()}
	SortCardsInPlace(g.communityCards, AceHigh, true)

	// Deal 5 cards to each player
	for _, p := range g.playerManager.GetAllPlayers() {
		cards := []int{g.drawCard(), g.drawCard(), g.drawCard(), g.drawCard(), g.drawCard()}
		SortCardsInPlace(cards, AceHigh, true)
		p.SetHandCards(cards)

		if g.callbacks != nil && g.callbacks.OnPlayerDealt != nil {
			g.callbacks.OnPlayerDealt(p.ID, cards)
		}
	}

	util.Info("TheDecree", "Cards dealt to players and community")
	g.state = StateFirstDealerSelection

	if g.callbacks != nil && g.callbacks.OnGameStarted != nil {
		g.callbacks.OnGameStarted(g.communityCards, g.state)
	}

	g.requestFirstDealerSelection()
}

func (g *TheDecreeMode) requestFirstDealerSelection() {
	util.Info("TheDecree", "Requesting first dealer selection from all players")
	g.firstDealerSelections = make(map[string]int)

	if g.callbacks != nil && g.callbacks.OnRequestFirstDealerSelection != nil {
		g.callbacks.OnRequestFirstDealerSelection(g.state)
	}

	// Check auto-play players
	g.checkAndTriggerAutoPlay()
}

// SelectFirstDealerCard handles a player's card selection for first dealer
func (g *TheDecreeMode) SelectFirstDealerCard(playerID string, card int) bool {
	if g.state != StateFirstDealerSelection {
		util.Warn("TheDecree", "Cannot select card in state: %s", g.state)
		return false
	}

	p := g.playerManager.GetPlayer(playerID)
	if p == nil {
		util.Warn("TheDecree", "Player %s not found", playerID)
		return false
	}

	if !p.HasCards([]int{card}) {
		util.Warn("TheDecree", "Player %s does not have card 0x%x", playerID, card)
		return false
	}

	if _, exists := g.firstDealerSelections[playerID]; exists {
		util.Warn("TheDecree", "Player %s already selected a card", playerID)
		return false
	}

	g.updatePlayerActionTime(playerID)
	g.firstDealerSelections[playerID] = card
	util.Info("TheDecree", "Player %s selected card for dealer selection (%d/%d)",
		playerID, len(g.firstDealerSelections), g.playerManager.GetPlayerCount())

	if g.callbacks != nil && g.callbacks.OnPlayerSelectedCard != nil {
		g.callbacks.OnPlayerSelectedCard(playerID)
	}

	if len(g.firstDealerSelections) == g.playerManager.GetPlayerCount() {
		util.Info("TheDecree", "All players selected, revealing first dealer...")
		g.revealFirstDealer()
	}

	return true
}

func (g *TheDecreeMode) revealFirstDealer() {
	dealerID := g.selectFirstDealer(g.firstDealerSelections)
	util.Info("TheDecree", "First dealer selected: %s", dealerID)

	g.state = StateDealerCall

	if g.callbacks != nil && g.callbacks.OnFirstDealerReveal != nil {
		g.callbacks.OnFirstDealerReveal(dealerID, g.firstDealerSelections, g.state)
	}

	g.StartNewRound(dealerID)
}

func (g *TheDecreeMode) selectFirstDealer(selections map[string]int) string {
	bestID := ""
	bestCard := -1
	for playerID, card := range selections {
		if bestCard == -1 || g.compareCards(card, bestCard) > 0 {
			bestCard = card
			bestID = playerID
		}
	}
	return bestID
}

func (g *TheDecreeMode) compareCards(card1, card2 int) int {
	rank1 := TexasRank(GetPoint(card1))
	rank2 := TexasRank(GetPoint(card2))
	if rank1 != rank2 {
		return rank1 - rank2
	}
	return SuitValue(GetSuit(card1)) - SuitValue(GetSuit(card2))
}

// StartNewRound begins a new round with the specified dealer
func (g *TheDecreeMode) StartNewRound(dealerID string) {
	roundNum := 1
	if g.currentRound != nil {
		roundNum = g.currentRound.RoundNumber + 1
	}

	g.currentRound = &RoundState{
		RoundNumber: roundNum,
		DealerID:    dealerID,
		CardsToPlay: 0,
		PlayerPlays: make(map[string][]int),
	}

	// Reset player round states
	for _, p := range g.playerManager.GetAllPlayers() {
		p.ResetRound()
	}

	g.state = StateDealerCall

	if g.callbacks != nil && g.callbacks.OnNewRound != nil {
		g.callbacks.OnNewRound(g.currentRound.RoundNumber, dealerID, g.state)
	}

	util.Info("TheDecree", "Round %d started, dealer: %s", g.currentRound.RoundNumber, dealerID)

	g.checkAndTriggerAutoPlay()
}

// DealerCallAction handles the dealer declaring how many cards to play
func (g *TheDecreeMode) DealerCallAction(dealerID string, cardsToPlay int) bool {
	if g.currentRound == nil || g.state != StateDealerCall {
		return false
	}
	if g.currentRound.DealerID != dealerID {
		return false
	}
	if cardsToPlay < 1 || cardsToPlay > 3 {
		return false
	}

	g.updatePlayerActionTime(dealerID)
	g.currentRound.CardsToPlay = cardsToPlay
	g.state = StatePlayerSelection

	if g.callbacks != nil && g.callbacks.OnDealerCall != nil {
		g.callbacks.OnDealerCall(dealerID, cardsToPlay, g.state)
	}

	util.Info("TheDecree", "Dealer %s calls %d card(s)", dealerID, cardsToPlay)

	g.checkAndTriggerAutoPlay()
	return true
}

// IsValidPlay checks if a play is valid
func (g *TheDecreeMode) IsValidPlay(cards []int, playerID string) bool {
	if g.currentRound == nil || g.state != StatePlayerSelection {
		return false
	}
	p := g.playerManager.GetPlayer(playerID)
	if p == nil || p.HasPlayed {
		return false
	}
	if len(cards) != g.currentRound.CardsToPlay {
		return false
	}
	return p.HasCards(cards)
}

// PlayCardsAction handles a player playing cards
func (g *TheDecreeMode) PlayCardsAction(cards []int, playerID string) bool {
	if !g.IsValidPlay(cards, playerID) {
		return false
	}

	g.updatePlayerActionTime(playerID)
	p := g.playerManager.GetPlayer(playerID)
	p.PlayCardsAction(cards)
	g.currentRound.PlayerPlays[playerID] = cards

	if g.callbacks != nil && g.callbacks.OnPlayerPlayed != nil {
		g.callbacks.OnPlayerPlayed(playerID, len(cards))
	}

	util.Info("TheDecree", "Player %s played %d card(s)", playerID, len(cards))

	if g.allPlayersPlayed() {
		g.state = StateShowdown
		g.processShowdown()
	}

	return true
}

func (g *TheDecreeMode) allPlayersPlayed() bool {
	if g.currentRound == nil {
		return false
	}
	return len(g.currentRound.PlayerPlays) == g.playerManager.GetPlayerCount()
}

func (g *TheDecreeMode) processShowdown() {
	if g.currentRound == nil {
		return
	}

	results := make(map[string]*HandResult)
	for playerID, playedCards := range g.currentRound.PlayerPlays {
		allCards := make([]int, 0, len(playedCards)+len(g.communityCards))
		allCards = append(allCards, playedCards...)
		allCards = append(allCards, g.communityCards...)
		result := Evaluate(allCards)
		results[playerID] = &result
	}

	g.currentRound.HandResults = results

	// Find winner and loser
	winnerID, loserID := "", ""
	var bestHand, worstHand *HandResult

	for playerID, result := range results {
		if bestHand == nil || CompareHands(*result, *bestHand) > 0 {
			bestHand = result
			winnerID = playerID
		}
		if worstHand == nil || CompareHands(*result, *worstHand) < 0 {
			worstHand = result
			loserID = playerID
		}
	}

	g.currentRound.RoundWinnerID = winnerID
	g.currentRound.RoundLoserID = loserID

	if g.callbacks != nil && g.callbacks.OnShowdown != nil {
		g.callbacks.OnShowdown(results, g.state)
	}

	g.calculateScores(results)
	g.state = StateScoring

	util.Info("TheDecree", "Round %d - Winner: %s, Loser: %s", g.currentRound.RoundNumber, winnerID, loserID)

	// Schedule refill after delay
	if g.callbacks != nil && g.callbacks.ScheduleShowdownDelay != nil {
		g.callbacks.ScheduleShowdownDelay(func() {
			g.ProceedToRefill()
		})
	} else {
		g.ProceedToRefill()
	}
}

func (g *TheDecreeMode) calculateScores(results map[string]*HandResult) {
	if g.currentRound == nil {
		return
	}

	// Award base scores
	for playerID, result := range results {
		p := g.playerManager.GetPlayer(playerID)
		if p != nil {
			p.Score += GetHandScore(result.Type)
		}
	}

	// Winner bonus +1
	if g.currentRound.RoundWinnerID != "" {
		winner := g.playerManager.GetPlayer(g.currentRound.RoundWinnerID)
		if winner != nil {
			winner.Score += 1
		}
	}

	if g.callbacks != nil && g.callbacks.OnRoundEnd != nil {
		g.callbacks.OnRoundEnd(
			g.currentRound.RoundWinnerID,
			g.currentRound.RoundLoserID,
			g.GetScores(),
			g.state,
		)
	}
}

// ProceedToRefill moves to refill phase
func (g *TheDecreeMode) ProceedToRefill() {
	g.state = StateRefill
	g.refillHands()
}

func (g *TheDecreeMode) refillHands() {
	if g.currentRound == nil {
		return
	}

	playerOrder := g.playerManager.GetPlayerOrder()
	dealerIndex := -1
	for i, id := range playerOrder {
		if id == g.currentRound.DealerID {
			dealerIndex = i
			break
		}
	}
	if dealerIndex == -1 {
		dealerIndex = 0
	}

	// Remove played cards from all players' hands
	for i := 0; i < len(playerOrder); i++ {
		idx := (dealerIndex + i) % len(playerOrder)
		p := g.playerManager.GetPlayer(playerOrder[idx])
		if p != nil {
			p.RemoveCards(p.PlayedCards)
		}
	}

	// Refill cards fairly (round-robin from dealer)
	continueRefilling := true
	for continueRefilling && len(g.deck) > 0 {
		continueRefilling = false
		for i := 0; i < len(playerOrder); i++ {
			idx := (dealerIndex + i) % len(playerOrder)
			p := g.playerManager.GetPlayer(playerOrder[idx])
			if p != nil && len(p.HandCards) < 5 && len(g.deck) > 0 {
				p.AddCards([]int{g.drawCard()})
				continueRefilling = true
			}
		}
	}

	// Sort each player's hand after refilling
	for _, id := range playerOrder {
		p := g.playerManager.GetPlayer(id)
		if p != nil && len(p.HandCards) > 0 {
			SortCardsInPlace(p.HandCards, AceHigh, true)
		}
	}

	if g.callbacks != nil && g.callbacks.OnHandsRefilled != nil {
		g.callbacks.OnHandsRefilled(len(g.deck))
	}

	util.Info("TheDecree", "Hands refilled. Deck: %d cards remaining", len(g.deck))

	if g.IsGameOver() {
		g.handleGameOver()
	} else if g.currentRound.RoundLoserID != "" {
		g.StartNewRound(g.currentRound.RoundLoserID)
	}
}

// IsGameOver checks if all players have empty hands
func (g *TheDecreeMode) IsGameOver() bool {
	for _, p := range g.playerManager.GetAllPlayers() {
		if len(p.HandCards) > 0 {
			return false
		}
	}
	return true
}

func (g *TheDecreeMode) handleGameOver() {
	util.Info("TheDecree", "Game Over")
	g.state = StateGameOver

	winnerID := ""
	maxScore := -1
	for _, p := range g.playerManager.GetAllPlayers() {
		if p.Score > maxScore {
			maxScore = p.Score
			winnerID = p.ID
		}
	}

	util.Info("TheDecree", "Winner: %s with %d points", winnerID, maxScore)

	if g.callbacks != nil && g.callbacks.OnGameOver != nil {
		roundNum := 0
		if g.currentRound != nil {
			roundNum = g.currentRound.RoundNumber
		}
		g.callbacks.OnGameOver(winnerID, g.GetScores(), roundNum, g.state)
	}
}

// ==================== Deck Management ====================

func (g *TheDecreeMode) initializeDeck() {
	g.deck = g.deck[:0]
	suits := []int{SuitSpade, SuitHeart, SuitClub, SuitDiamond}
	points := []int{PointA, Point2, Point3, Point4, Point5, Point6, Point7,
		Point8, Point9, Point10, PointJ, PointQ, PointK}

	for _, suit := range suits {
		for _, point := range points {
			g.deck = append(g.deck, suit|point)
		}
	}
	g.shuffleDeck()
}

func (g *TheDecreeMode) shuffleDeck() {
	rand.Shuffle(len(g.deck), func(i, j int) {
		g.deck[i], g.deck[j] = g.deck[j], g.deck[i]
	})
}

func (g *TheDecreeMode) drawCard() int {
	if len(g.deck) == 0 {
		util.Error("TheDecree", "Deck is empty!")
		return 0
	}
	card := g.deck[len(g.deck)-1]
	g.deck = g.deck[:len(g.deck)-1]
	return card
}

// ==================== Auto-play ====================

// SetPlayerAuto sets a player's auto-play state
func (g *TheDecreeMode) SetPlayerAuto(playerID string, isAuto bool, reason string) {
	p := g.playerManager.GetPlayer(playerID)
	if p == nil {
		return
	}

	p.IsAuto = isAuto
	if isAuto {
		p.AutoStartTime = time.Now()
		util.Info("TheDecree", "Player %s is now in auto mode (%s)", p.Name, reason)

		if g.isPlayerTurn(playerID) {
			if g.callbacks != nil && g.callbacks.ScheduleAutoAction != nil {
				g.callbacks.ScheduleAutoAction(playerID)
			}
		}
	} else {
		if g.callbacks != nil && g.callbacks.ClearAutoPlayTimer != nil {
			g.callbacks.ClearAutoPlayTimer(playerID)
		}
		util.Info("TheDecree", "Player %s cancelled auto mode", p.Name)
	}

	if g.callbacks != nil && g.callbacks.OnPlayerAutoChanged != nil {
		g.callbacks.OnPlayerAutoChanged(playerID, isAuto, reason)
	}
}

func (g *TheDecreeMode) isPlayerTurn(playerID string) bool {
	p := g.playerManager.GetPlayer(playerID)
	if p == nil {
		return false
	}

	switch g.state {
	case StateFirstDealerSelection:
		_, selected := g.firstDealerSelections[playerID]
		return !selected
	case StateDealerCall:
		return g.currentRound != nil && g.currentRound.DealerID == playerID
	case StatePlayerSelection:
		return !p.HasPlayed
	default:
		return false
	}
}

// ExecuteAutoAction performs the auto-play action for a player
func (g *TheDecreeMode) ExecuteAutoAction(playerID string) {
	p := g.playerManager.GetPlayer(playerID)
	if p == nil || !p.IsAuto {
		return
	}

	util.Debug("TheDecree", "Executing auto action for player %s in state %s", p.Name, g.state)

	switch g.state {
	case StateFirstDealerSelection:
		if _, selected := g.firstDealerSelections[playerID]; !selected {
			card := g.autoPlayStrategy.SelectFirstDealerCard(p.HandCards)
			g.SelectFirstDealerCard(playerID, card)
		}
	case StateDealerCall:
		if g.currentRound != nil && g.currentRound.DealerID == playerID {
			cardsToPlay := g.autoPlayStrategy.DealerCall(p.HandCards, g.communityCards)
			g.DealerCallAction(playerID, cardsToPlay)
		}
	case StatePlayerSelection:
		if !p.HasPlayed && g.currentRound != nil && g.currentRound.CardsToPlay > 0 {
			cards := g.autoPlayStrategy.PlayCards(p.HandCards, g.currentRound.CardsToPlay)
			g.PlayCardsAction(cards, playerID)
		}
	}
}

func (g *TheDecreeMode) checkAndTriggerAutoPlay() {
	for _, p := range g.playerManager.GetAllPlayers() {
		if p.IsAuto && g.isPlayerTurn(p.ID) {
			if g.callbacks != nil && g.callbacks.ScheduleAutoAction != nil {
				g.callbacks.ScheduleAutoAction(p.ID)
			}
		}
	}
}

func (g *TheDecreeMode) updatePlayerActionTime(playerID string) {
	p := g.playerManager.GetPlayer(playerID)
	if p != nil {
		p.LastActionTime = time.Now()
	}
}

// ==================== Getters ====================

func (g *TheDecreeMode) GetState() string          { return g.state }
func (g *TheDecreeMode) GetDeckSize() int           { return len(g.deck) }
func (g *TheDecreeMode) GetCurrentRound() *RoundState { return g.currentRound }

func (g *TheDecreeMode) GetCommunityCards() []int {
	out := make([]int, len(g.communityCards))
	copy(out, g.communityCards)
	return out
}

func (g *TheDecreeMode) GetPlayer(playerID string) *TheDecreePlayer {
	return g.playerManager.GetPlayer(playerID)
}

func (g *TheDecreeMode) GetAllPlayers() []*TheDecreePlayer {
	return g.playerManager.GetAllPlayers()
}

func (g *TheDecreeMode) GetPlayerHandCards(playerID string) []int {
	p := g.playerManager.GetPlayer(playerID)
	if p == nil {
		return nil
	}
	out := make([]int, len(p.HandCards))
	copy(out, p.HandCards)
	return out
}

func (g *TheDecreeMode) GetScores() map[string]int {
	scores := make(map[string]int)
	for _, p := range g.playerManager.GetAllPlayers() {
		scores[p.ID] = p.Score
	}
	return scores
}

// Cleanup releases resources
func (g *TheDecreeMode) Cleanup() {
	util.Info("TheDecree", "Cleaning up")
	g.isActive = false
	g.playerManager.Clear()
	g.communityCards = nil
	g.deck = nil
	g.currentRound = nil
	g.firstDealerSelections = make(map[string]int)
}
