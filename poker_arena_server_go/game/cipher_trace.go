package game

import (
	"encoding/json"
	"math/rand"
	"poker-arena-server/util"
)

// ==================== State Constants ====================

const (
	CTStateSetup      = "ct_setup"
	CTStateDealing    = "ct_dealing"
	CTStateLuckyCheck = "ct_lucky_check"
	CTStateSignalPick = "ct_signal_pick"
	CTStateKittyDraw  = "ct_kitty_draw"
	CTStateTribute    = "ct_tribute"
	CTStatePlaying    = "ct_playing"
	CTStateRoundEnd   = "ct_round_end"
	CTStateLevelUp    = "ct_level_up"
	CTStateGameOver   = "ct_game_over"
)

// ==================== Level System ====================

// levelToCardPoint converts a game level (2-14) to the card point encoding.
// Level 2 → Point2 (15), Level 3 → Point3 (3), ..., Level 14 (A) → PointA (14).
func levelToCardPoint(level int) int {
	if level == 2 {
		return Point2 // 15
	}
	return level // 3-14 map directly
}

// cardPointToLevel converts a card point encoding back to game level.
func cardPointToLevel(point int) int {
	if point == Point2 {
		return 2
	}
	return point // 3-14 map directly
}

// nextLevel returns the next level after current. Progression: 2→3→4→...→13→14(A).
func nextLevel(current int) int {
	if current == 2 {
		return 3
	}
	if current >= 14 {
		return 14 // A is max
	}
	return current + 1
}

// isMaxLevel returns true if the level is A (14).
func isMaxLevel(level int) bool {
	return level >= 14
}

// levelName returns a display name for the level.
func levelName(level int) string {
	names := map[int]string{
		2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
		8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
	}
	if n, ok := names[level]; ok {
		return n
	}
	return "?"
}

// ==================== Core Struct ====================

// CipherTraceMode implements the Cipher Trace game state machine.
type CipherTraceMode struct {
	state       string
	bridge      RoomBridge
	players     map[string]*CipherTracePlayer
	playerOrder []string // seat order, index 0 = bottom seat

	deck  []int
	kitty []int

	currentLevel int    // 2-14
	dealerID     string // current dealer
	signalCard   int    // the signal card value (suit|point), 0 if not yet picked
	signalSuit   int    // the suit chosen by dealer

	turnPlayerID string      // whose turn to play
	lastPlay     *CTPlayedHand // current cards on table to beat (nil = free lead)
	passCount    int         // consecutive passes

	finishOrder []string // player IDs in order of finishing
	finishNext  int      // next finish rank to assign (1-based)

	roundNumber int
	prevWinTeam int  // 0=none, 1=dealer team, 2=opponent team (for tribute)
	isSweep     bool // previous round was a sweep

	isActive bool
	isFirstRound bool

	tribute *tributeState // current tribute phase state (nil if not in tribute)
}

// NewCipherTraceMode creates a new Cipher Trace game instance.
func NewCipherTraceMode(bridge RoomBridge) *CipherTraceMode {
	return &CipherTraceMode{
		state:        CTStateSetup,
		bridge:       bridge,
		players:      make(map[string]*CipherTracePlayer),
		playerOrder:  []string{},
		currentLevel: 2,
		isFirstRound: true,
	}
}

// ==================== Player Helpers ====================

func (g *CipherTraceMode) getPlayer(id string) *CipherTracePlayer {
	return g.players[id]
}

func (g *CipherTraceMode) getPlayerCount() int {
	return len(g.playerOrder)
}

func (g *CipherTraceMode) getAllPlayersOrdered() []*CipherTracePlayer {
	result := make([]*CipherTracePlayer, 0, len(g.playerOrder))
	for _, id := range g.playerOrder {
		if p, ok := g.players[id]; ok {
			result = append(result, p)
		}
	}
	return result
}

// playerHasFinished returns true if the player has already emptied their hand.
func (g *CipherTraceMode) playerHasFinished(playerID string) bool {
	p := g.getPlayer(playerID)
	return p != nil && p.FinishOrder > 0
}

// countActivePlayers returns the number of players still holding cards.
func (g *CipherTraceMode) countActivePlayers() int {
	count := 0
	for _, p := range g.players {
		if p.FinishOrder == 0 && len(p.HandCards) > 0 {
			count++
		}
	}
	return count
}

// ==================== GameMode Interface ====================

func (g *CipherTraceMode) InitGame(playerInfos []PlayerInfo) {
	if len(playerInfos) < 5 || len(playerInfos) > 8 {
		util.Error("CipherTrace", "Invalid player count: %d (need 5-8)", len(playerInfos))
		return
	}
	g.players = make(map[string]*CipherTracePlayer, len(playerInfos))
	g.playerOrder = make([]string, 0, len(playerInfos))
	for _, info := range playerInfos {
		p := NewCipherTracePlayer(info)
		g.players[info.ID] = p
		g.playerOrder = append(g.playerOrder, info.ID)
	}
	g.state = CTStateSetup
	util.Info("CipherTrace", "Game initialized with %d players", len(playerInfos))
}

func (g *CipherTraceMode) StartGame() {
	g.isActive = true
	util.Info("CipherTrace", "Starting game")
	g.startRound()
}

func (g *CipherTraceMode) Cleanup() {
	util.Info("CipherTrace", "Cleaning up")
	g.isActive = false
	g.players = make(map[string]*CipherTracePlayer)
	g.playerOrder = nil
	g.deck = nil
	g.kitty = nil
	g.finishOrder = nil
	g.lastPlay = nil
}

func (g *CipherTraceMode) GetState() string { return g.state }
func (g *CipherTraceMode) GetDeckSize() int  { return len(g.deck) }

func (g *CipherTraceMode) GetPlayerHandCards(playerID string) []int {
	p := g.getPlayer(playerID)
	if p == nil {
		return nil
	}
	out := make([]int, len(p.HandCards))
	copy(out, p.HandCards)
	return out
}

func (g *CipherTraceMode) GetScores() map[string]int {
	scores := make(map[string]int)
	for _, p := range g.players {
		scores[p.ID] = p.Score
	}
	return scores
}

func (g *CipherTraceMode) SetPlayerAuto(playerID string, isAuto bool, reason string) {
	p := g.getPlayer(playerID)
	if p == nil {
		return
	}
	p.IsAuto = isAuto
	if g.bridge != nil {
		if isAuto && g.isPlayerTurn(playerID) {
			g.bridge.ScheduleAutoAction(playerID)
		} else if !isAuto {
			g.bridge.ClearAutoPlayTimer(playerID)
		}
	}
}

func (g *CipherTraceMode) ExecuteAutoAction(playerID string) {
	p := g.getPlayer(playerID)
	if p == nil || !p.IsAuto {
		return
	}

	auto := &CTAutoStrategy{}
	util.Debug("CipherTrace", "Executing auto action for %s in state %s", playerID, g.state)

	switch g.state {
	case CTStateSignalPick:
		if playerID == g.dealerID {
			suit := auto.PickSignalSuit(p.HandCards, g.currentLevel)
			if suit >= 0 {
				g.handlePickSignal(playerID, suit)
			}
		}
	case CTStatePlaying:
		if playerID == g.turnPlayerID {
			cards := auto.PickPlay(p.HandCards, g.lastPlay, g.currentLevel)
			if cards != nil {
				g.handlePlay(playerID, cards)
			} else if g.lastPlay != nil {
				g.handlePass(playerID)
			}
		}
	case CTStateTribute:
		if g.tribute != nil {
			switch g.tribute.phase {
			case "tribute_give":
				if _, done := g.tribute.tributeCards[playerID]; !done {
					card := auto.PickTributeCard(p.HandCards, g.currentLevel)
					if card >= 0 {
						g.handleTributeGive(playerID, card)
					}
				}
			case "tribute_return":
				if _, done := g.tribute.returnCards[playerID]; !done {
					card := auto.PickReturnCard(p.HandCards, g.currentLevel, g.signalCard)
					if card >= 0 {
						g.handleTributeReturn(playerID, card)
					}
				}
			}
		}
	}
}

func (g *CipherTraceMode) IsPlayerAuto(playerID string) bool {
	p := g.getPlayer(playerID)
	return p != nil && p.IsAuto
}

func (g *CipherTraceMode) HandleAction(actionType string, playerID string, data json.RawMessage) (bool, string) {
	switch actionType {
	case "ct_pick_signal":
		var req struct {
			Suit int `json:"suit"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			return false, "Invalid request data"
		}
		return g.handlePickSignal(playerID, req.Suit)

	case "ct_play":
		var req struct {
			Cards []int `json:"cards"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			return false, "Invalid request data"
		}
		return g.handlePlay(playerID, req.Cards)

	case "ct_pass":
		return g.handlePass(playerID)

	case "ct_tribute_give":
		var req struct {
			Card int `json:"card"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			return false, "Invalid request data"
		}
		return g.handleTributeGive(playerID, req.Card)

	case "ct_tribute_return":
		var req struct {
			Card int `json:"card"`
		}
		if err := json.Unmarshal(data, &req); err != nil {
			return false, "Invalid request data"
		}
		return g.handleTributeReturn(playerID, req.Card)

	default:
		return false, "Unknown action type"
	}
}

func (g *CipherTraceMode) GetReconnectPayload(playerID string) interface{} {
	handCards := g.GetPlayerHandCards(playerID)
	if handCards == nil {
		handCards = []int{}
	}

	handCounts := make(map[string]int)
	teams := make(map[string]int)
	for _, p := range g.players {
		handCounts[p.ID] = len(p.HandCards)
		if p.SignalRevealed {
			teams[p.ID] = p.Team
		}
	}

	return &CipherTraceReconnectState{
		GameState:    g.state,
		CurrentLevel: g.currentLevel,
		DealerID:     g.dealerID,
		TurnPlayerID: g.turnPlayerID,
		SignalCard:   g.signalCard,
		HandCards:    handCards,
		HandCounts:   handCounts,
		Teams:        teams,
		FinishOrder:  g.finishOrder,
		RoundNumber:  g.roundNumber,
		Scores:       g.GetScores(),
	}
}

// CipherTraceReconnectState holds reconnect data for Cipher Trace.
type CipherTraceReconnectState struct {
	GameState    string         `json:"gameState"`
	CurrentLevel int            `json:"currentLevel"`
	DealerID     string         `json:"dealerId"`
	TurnPlayerID string         `json:"turnPlayerId"`
	SignalCard   int            `json:"signalCard"`
	HandCards    []int          `json:"handCards"`
	HandCounts   map[string]int `json:"handCounts"`
	Teams        map[string]int `json:"teams"`
	FinishOrder  []string       `json:"finishOrder"`
	RoundNumber  int            `json:"roundNumber"`
	Scores       map[string]int `json:"scores"`
}

// ==================== Round Lifecycle ====================

func (g *CipherTraceMode) startRound() {
	g.roundNumber++
	g.finishOrder = []string{}
	g.finishNext = 1
	g.lastPlay = nil
	g.passCount = 0
	g.signalCard = 0
	g.signalSuit = 0

	// Reset player round state
	for _, p := range g.players {
		p.ResetRound()
	}

	// Pick dealer for first round
	if g.isFirstRound {
		g.dealerID = g.playerOrder[rand.Intn(len(g.playerOrder))]
		g.isFirstRound = false
	}

	util.Info("CipherTrace", "Round %d starting, dealer: %s, level: %s",
		g.roundNumber, g.dealerID, levelName(g.currentLevel))

	g.dealCards()
}

// ==================== Dealing ====================

func (g *CipherTraceMode) dealCards() {
	g.state = CTStateDealing
	n := g.getPlayerCount()

	// Build deck: 3 decks for 5-6 players, 4 decks for 7-8
	deckCount := DeckCountForPlayers(n)
	g.deck = BuildMultiDeck(deckCount)
	ShuffleDeck(g.deck)

	totalCards := len(g.deck)
	cardsPerPlayer := totalCards / n
	kittySize := totalCards % n

	// Ensure kitty >= N (so dealer can draw 4 and still show remainder to all)
	if kittySize < n {
		cardsPerPlayer--
		kittySize += n
	}

	// Deal cards to each player
	idx := 0
	for _, pid := range g.playerOrder {
		p := g.getPlayer(pid)
		cards := make([]int, cardsPerPlayer)
		copy(cards, g.deck[idx:idx+cardsPerPlayer])
		p.SetHandCards(cards)
		SortCardsInPlace(p.HandCards, TwoHigh, true)
		idx += cardsPerPlayer
	}

	// Remaining cards become kitty
	g.kitty = make([]int, kittySize)
	copy(g.kitty, g.deck[idx:idx+kittySize])
	g.deck = nil // deck is fully distributed

	util.Info("CipherTrace", "Dealt %d cards/player, kitty: %d cards", cardsPerPlayer, kittySize)

	// Notify each player of their hand
	for _, pid := range g.playerOrder {
		p := g.getPlayer(pid)
		if g.bridge != nil {
			g.bridge.SendToPlayer(pid, "ct_dealt", map[string]interface{}{
				"handCards":    p.HandCards,
				"kittySize":   kittySize,
				"currentLevel": g.currentLevel,
				"dealerId":    g.dealerID,
				"roundNumber": g.roundNumber,
			})
		}
	}

	g.checkLuckyMoment()
}

// ==================== Lucky Moment ====================

// checkLuckyMoment: if dealer has no cards of current level, auto-promote.
func (g *CipherTraceMode) checkLuckyMoment() {
	g.state = CTStateLuckyCheck
	dealer := g.getPlayer(g.dealerID)
	if dealer == nil {
		return
	}

	levelPoint := levelToCardPoint(g.currentLevel)
	promoted := false

	for !isMaxLevel(g.currentLevel) {
		hasLevelCard := false
		for _, card := range dealer.HandCards {
			if GetPoint(card) == levelPoint {
				hasLevelCard = true
				break
			}
		}
		if hasLevelCard {
			break
		}
		// Auto-promote
		oldLevel := g.currentLevel
		g.currentLevel = nextLevel(g.currentLevel)
		levelPoint = levelToCardPoint(g.currentLevel)
		promoted = true
		util.Info("CipherTrace", "Lucky moment: dealer has no level %s cards, promoted to %s",
			levelName(oldLevel), levelName(g.currentLevel))
	}

	if promoted && g.bridge != nil {
		g.bridge.Broadcast("ct_lucky_moment", map[string]interface{}{
			"dealerId":     g.dealerID,
			"currentLevel": g.currentLevel,
		})
	}

	// Move to signal pick phase
	g.requestSignalPick()
}

// ==================== Signal Pick (暗号选择) ====================

func (g *CipherTraceMode) requestSignalPick() {
	g.state = CTStateSignalPick
	dealer := g.getPlayer(g.dealerID)
	if dealer == nil {
		return
	}

	// Find which suits the dealer has for the current level
	levelPoint := levelToCardPoint(g.currentLevel)
	availableSuits := make(map[int]bool)
	for _, card := range dealer.HandCards {
		if GetPoint(card) == levelPoint {
			availableSuits[GetSuit(card)] = true
		}
	}

	suits := make([]int, 0, len(availableSuits))
	for s := range availableSuits {
		suits = append(suits, s)
	}

	if g.bridge != nil {
		g.bridge.SendToPlayer(g.dealerID, "ct_request_signal_pick", map[string]interface{}{
			"availableSuits": suits,
			"currentLevel":  g.currentLevel,
		})
	}

	util.Info("CipherTrace", "Waiting for dealer %s to pick signal suit (%d options)", g.dealerID, len(suits))
}

// handlePickSignal processes the dealer's signal suit choice.
func (g *CipherTraceMode) handlePickSignal(playerID string, suit int) (bool, string) {
	if g.state != CTStateSignalPick {
		return false, "Not in signal pick phase"
	}
	if playerID != g.dealerID {
		return false, "Only dealer can pick signal"
	}

	// Validate dealer actually has this suit at current level
	dealer := g.getPlayer(g.dealerID)
	levelPoint := levelToCardPoint(g.currentLevel)
	targetCard := suit | levelPoint

	found := false
	for _, card := range dealer.HandCards {
		if card == targetCard {
			found = true
			break
		}
	}
	if !found {
		return false, "Dealer does not have this card"
	}

	g.signalSuit = suit
	g.signalCard = targetCard

	// Mark signal card holders
	n := g.getPlayerCount()
	isEvenGame := n%2 == 0

	if isEvenGame {
		// Even player count: all holders are immediately teammates
		for _, p := range g.players {
			if p.ID == g.dealerID {
				p.Team = 1
				continue
			}
			for _, card := range p.HandCards {
				if card == g.signalCard {
					p.HasSignalCard = true
					p.Team = 1 // immediately assigned
					break
				}
			}
		}
	} else {
		// Odd player count: just mark who has it, team confirmed on play
		for _, p := range g.players {
			if p.ID == g.dealerID {
				p.Team = 1
				continue
			}
			for _, card := range p.HandCards {
				if card == g.signalCard {
					p.HasSignalCard = true
					break
				}
			}
		}
	}

	util.Info("CipherTrace", "Signal picked: suit=0x%x, card=0x%x", suit, g.signalCard)

	if g.bridge != nil {
		g.bridge.Broadcast("ct_signal_picked", map[string]interface{}{
			"dealerId":     g.dealerID,
			"signalCard":  g.signalCard,
			"currentLevel": g.currentLevel,
		})
	}

	g.handleKittyDraw()
	return true, ""
}

// ==================== Kitty Draw (庄家摸底牌) ====================

func (g *CipherTraceMode) handleKittyDraw() {
	g.state = CTStateKittyDraw
	dealer := g.getPlayer(g.dealerID)
	if dealer == nil {
		return
	}

	// Dealer draws 4 random cards from kitty
	drawCount := 4
	if len(g.kitty) < drawCount {
		drawCount = len(g.kitty)
	}

	// Shuffle kitty to randomize which 4 are drawn
	ShuffleDeck(g.kitty)

	drawn := g.kitty[:drawCount]
	remaining := g.kitty[drawCount:]

	dealer.AddCards(drawn)
	SortCardsInPlace(dealer.HandCards, TwoHigh, true)

	// Update signal card status for dealer after drawing
	for _, card := range drawn {
		if card == g.signalCard {
			dealer.HasSignalCard = true
		}
	}

	// Send drawn cards to dealer
	if g.bridge != nil {
		g.bridge.SendToPlayer(g.dealerID, "ct_kitty_drawn", map[string]interface{}{
			"drawnCards": drawn,
			"handCards":  dealer.HandCards,
		})
	}

	// Reveal remaining kitty to all players, then discard
	if len(remaining) > 0 && g.bridge != nil {
		g.bridge.Broadcast("ct_kitty_revealed", map[string]interface{}{
			"cards": remaining,
		})
	}

	g.kitty = nil // kitty is consumed

	util.Info("CipherTrace", "Dealer drew %d from kitty, %d revealed and discarded", drawCount, len(remaining))

	// Tribute phase for non-first rounds
	if g.roundNumber > 1 && g.prevWinTeam > 0 {
		g.startTributePhase()
	} else {
		g.startPlaying()
	}
}

// ==================== Playing Phase ====================

func (g *CipherTraceMode) startPlaying() {
	g.state = CTStatePlaying
	g.lastPlay = nil
	g.passCount = 0

	// Dealer leads first
	g.turnPlayerID = g.dealerID

	if g.bridge != nil {
		g.bridge.Broadcast("ct_turn_start", map[string]interface{}{
			"playerId": g.turnPlayerID,
			"isFreeLead": true,
		})
	}

	util.Info("CipherTrace", "Playing phase started, %s leads", g.turnPlayerID)
}

func (g *CipherTraceMode) isPlayerTurn(playerID string) bool {
	return g.state == CTStatePlaying && g.turnPlayerID == playerID
}

// handlePlay processes a player's card play.
func (g *CipherTraceMode) handlePlay(playerID string, cards []int) (bool, string) {
	if g.state != CTStatePlaying {
		return false, "Not in playing phase"
	}
	if playerID != g.turnPlayerID {
		return false, "Not your turn"
	}
	if len(cards) == 0 {
		return false, "Must play at least one card"
	}

	p := g.getPlayer(playerID)
	if p == nil {
		return false, "Player not found"
	}

	// Verify player has these cards
	if !p.HasCards(cards) {
		return false, "You don't have these cards"
	}

	// Validate hand type
	played := ParseCTHand(cards, g.currentLevel)
	if played == nil {
		return false, "Invalid hand type"
	}

	// Check if it beats the current table
	if !CanBeatCT(g.lastPlay, played) {
		return false, "Cannot beat current play"
	}

	// Remove cards from hand
	p.RemoveCards(cards)

	// Check if signal card was played → reveal identity
	identityRevealed := false
	for _, card := range cards {
		if card == g.signalCard && !p.SignalRevealed && p.HasSignalCard {
			g.revealIdentity(playerID)
			identityRevealed = true
		}
	}

	// Update table state
	played.PlayerID = playerID
	g.lastPlay = played
	g.passCount = 0

	if g.bridge != nil {
		g.bridge.Broadcast("ct_cards_played", map[string]interface{}{
			"playerId":         playerID,
			"cards":            cards,
			"handType":         int(played.Type),
			"handTypeName":     CTHandTypeName(played.Type),
			"remainingCards":   len(p.HandCards),
			"identityRevealed": identityRevealed,
		})
	}

	util.Info("CipherTrace", "Player %s played %d cards, %d remaining", playerID, len(cards), len(p.HandCards))

	// Check if player finished
	if len(p.HandCards) == 0 {
		g.playerFinished(playerID)
	}

	// Check if round is over
	if g.countActivePlayers() <= 1 {
		g.finishRemainingPlayers()
		g.endRound()
		return true, ""
	}

	g.advanceTurn()
	return true, ""
}

// handlePass processes a player passing their turn.
func (g *CipherTraceMode) handlePass(playerID string) (bool, string) {
	if g.state != CTStatePlaying {
		return false, "Not in playing phase"
	}
	if playerID != g.turnPlayerID {
		return false, "Not your turn"
	}
	if g.lastPlay == nil {
		return false, "Cannot pass on free lead"
	}

	g.passCount++

	if g.bridge != nil {
		g.bridge.Broadcast("ct_player_passed", map[string]interface{}{
			"playerId": playerID,
		})
	}

	util.Info("CipherTrace", "Player %s passed (passCount=%d)", playerID, g.passCount)

	// If all active players except the last player who played have passed → trick won
	activePlayers := g.countActivePlayers()
	if g.passCount >= activePlayers-1 {
		// Last player who played wins the trick
		g.trickWon(g.lastPlay.PlayerID)
		return true, ""
	}

	g.advanceTurn()
	return true, ""
}

// ==================== Turn Management ====================

// advanceTurn moves to the next active player in seat order.
func (g *CipherTraceMode) advanceTurn() {
	currentIdx := -1
	for i, id := range g.playerOrder {
		if id == g.turnPlayerID {
			currentIdx = i
			break
		}
	}

	n := len(g.playerOrder)
	for i := 1; i < n; i++ {
		nextIdx := (currentIdx + i) % n
		nextID := g.playerOrder[nextIdx]
		if !g.playerHasFinished(nextID) {
			g.turnPlayerID = nextID
			break
		}
	}

	isFreeLead := g.lastPlay == nil

	if g.bridge != nil {
		g.bridge.Broadcast("ct_turn_start", map[string]interface{}{
			"playerId":   g.turnPlayerID,
			"isFreeLead": isFreeLead,
		})
	}
}

// trickWon is called when a player wins a trick (all others passed).
func (g *CipherTraceMode) trickWon(winnerID string) {
	if g.bridge != nil {
		g.bridge.Broadcast("ct_trick_won", map[string]interface{}{
			"playerId": winnerID,
		})
	}

	// Winner leads next trick
	g.lastPlay = nil
	g.passCount = 0

	// If winner has finished, find next active player
	if g.playerHasFinished(winnerID) {
		g.turnPlayerID = winnerID
		g.advanceTurn()
	} else {
		g.turnPlayerID = winnerID
	}

	if g.bridge != nil {
		g.bridge.Broadcast("ct_turn_start", map[string]interface{}{
			"playerId":   g.turnPlayerID,
			"isFreeLead": true,
		})
	}

	util.Info("CipherTrace", "Trick won by %s, new lead", winnerID)
}

// ==================== Finish & Scoring ====================

func (g *CipherTraceMode) playerFinished(playerID string) {
	p := g.getPlayer(playerID)
	if p == nil {
		return
	}

	p.FinishOrder = g.finishNext
	g.finishOrder = append(g.finishOrder, playerID)
	g.finishNext++

	if g.bridge != nil {
		g.bridge.Broadcast("ct_player_finished", map[string]interface{}{
			"playerId":    playerID,
			"finishOrder": p.FinishOrder,
		})
	}

	util.Info("CipherTrace", "Player %s finished in position %d", playerID, p.FinishOrder)
}

// finishRemainingPlayers assigns finish order to any players still holding cards.
func (g *CipherTraceMode) finishRemainingPlayers() {
	for _, id := range g.playerOrder {
		p := g.getPlayer(id)
		if p != nil && p.FinishOrder == 0 {
			p.FinishOrder = g.finishNext
			g.finishOrder = append(g.finishOrder, id)
			g.finishNext++
		}
	}
}

func (g *CipherTraceMode) endRound() {
	g.state = CTStateRoundEnd
	n := g.getPlayerCount()

	// Assign scores: 1st = N, 2nd = N-1, ..., 2nd-to-last = 2, last = 0
	for _, p := range g.players {
		if p.FinishOrder <= 0 || p.FinishOrder > n {
			continue
		}
		if p.FinishOrder == n {
			p.Score += 0 // last place
		} else {
			p.Score += n - p.FinishOrder + 1
		}
	}

	// Determine teams for unresolved players (odd games)
	g.resolveTeams()

	// Calculate team average scores
	team1Score, team1Count := 0, 0
	team2Score, team2Count := 0, 0
	for _, p := range g.players {
		switch p.Team {
		case 1:
			team1Score += n - p.FinishOrder + 1
			if p.FinishOrder == n {
				team1Score -= (n - p.FinishOrder + 1) // undo, last = 0
			}
			team1Count++
		case 2:
			team2Score += n - p.FinishOrder + 1
			if p.FinishOrder == n {
				team2Score -= (n - p.FinishOrder + 1)
			}
			team2Count++
		}
	}

	var team1Avg, team2Avg float64
	if team1Count > 0 {
		team1Avg = float64(team1Score) / float64(team1Count)
	}
	if team2Count > 0 {
		team2Avg = float64(team2Score) / float64(team2Count)
	}

	// Determine winner
	winTeam := 0
	if team1Avg > team2Avg {
		winTeam = 1
	} else if team2Avg > team1Avg {
		winTeam = 2
	}

	// Check for sweep: winning team occupies all top M positions
	g.isSweep = false
	if winTeam > 0 {
		winCount := 0
		if winTeam == 1 {
			winCount = team1Count
		} else {
			winCount = team2Count
		}
		swept := true
		for i := 0; i < winCount && i < len(g.finishOrder); i++ {
			p := g.getPlayer(g.finishOrder[i])
			if p == nil || p.Team != winTeam {
				swept = false
				break
			}
		}
		g.isSweep = swept
	}

	// Level progression
	levelUp := 0
	if winTeam > 0 {
		levelUp = 1
		if g.isSweep {
			levelUp = 2
		}
	}

	g.prevWinTeam = winTeam

	util.Info("CipherTrace", "Round %d ended. Team1 avg=%.1f, Team2 avg=%.1f, winner=team%d, sweep=%v, levelUp=%d",
		g.roundNumber, team1Avg, team2Avg, winTeam, g.isSweep, levelUp)

	if g.bridge != nil {
		g.bridge.Broadcast("ct_round_result", map[string]interface{}{
			"finishOrder": g.finishOrder,
			"scores":      g.GetScores(),
			"team1Avg":    team1Avg,
			"team2Avg":    team2Avg,
			"winTeam":     winTeam,
			"isSweep":     g.isSweep,
			"levelUp":     levelUp,
		})
	}

	// Apply level progression to winning team
	if winTeam > 0 {
		for i := 0; i < levelUp && !isMaxLevel(g.currentLevel); i++ {
			g.currentLevel = nextLevel(g.currentLevel)
		}
	}

	// Check game over: if a player at level A and their team won
	gameOver := false
	if isMaxLevel(g.currentLevel) && winTeam > 0 {
		gameOver = true
	}

	if gameOver {
		g.handleGameOver(winTeam)
	} else {
		// Determine next dealer
		g.determineNextDealer(winTeam)

		// Schedule next round after delay
		if g.bridge != nil {
			g.bridge.ScheduleTimer(3000000000, func() { // 3 seconds
				g.startRound()
			})
		}
	}
}

// resolveTeams assigns team 2 (opponent) to any player without a team.
func (g *CipherTraceMode) resolveTeams() {
	for _, p := range g.players {
		if p.Team == 0 {
			p.Team = 2
		}
	}
}

// revealIdentity marks a player's team as publicly known.
func (g *CipherTraceMode) revealIdentity(playerID string) {
	p := g.getPlayer(playerID)
	if p == nil {
		return
	}

	n := g.getPlayerCount()
	isOddGame := n%2 != 0

	if isOddGame {
		// Odd game: confirm as teammate based on reveal order
		maxTeammates := 1 // 5-player: 1 teammate
		if n == 7 {
			maxTeammates = 2 // 7-player: 2 teammates
		}

		// Count already confirmed teammates (excluding dealer)
		confirmed := 0
		for _, other := range g.players {
			if other.ID != g.dealerID && other.Team == 1 && other.SignalRevealed {
				confirmed++
			}
		}

		if confirmed < maxTeammates {
			p.Team = 1
		} else {
			p.Team = 2 // too late, becomes opponent
		}
	}
	// Even game: team was already assigned in handlePickSignal

	p.SignalRevealed = true

	if g.bridge != nil {
		g.bridge.Broadcast("ct_identity_revealed", map[string]interface{}{
			"playerId": playerID,
			"team":     p.Team,
		})
	}

	util.Info("CipherTrace", "Player %s identity revealed: team %d", playerID, p.Team)
}

// ==================== Next Dealer ====================

// determineNextDealer picks the next dealer from the winning team,
// closest to current dealer in counter-clockwise (逆时针) direction.
func (g *CipherTraceMode) determineNextDealer(winTeam int) {
	if winTeam == 0 {
		return // no change on draw
	}

	currentIdx := -1
	for i, id := range g.playerOrder {
		if id == g.dealerID {
			currentIdx = i
			break
		}
	}

	n := len(g.playerOrder)
	// Search counter-clockwise (decreasing index)
	for i := 1; i < n; i++ {
		idx := (currentIdx - i + n) % n
		candidate := g.getPlayer(g.playerOrder[idx])
		if candidate != nil && candidate.Team == winTeam {
			g.dealerID = candidate.ID
			util.Info("CipherTrace", "Next dealer: %s (team %d)", g.dealerID, winTeam)
			return
		}
	}

	// Fallback: keep current dealer
	util.Warn("CipherTrace", "Could not find next dealer in winning team, keeping %s", g.dealerID)
}

// ==================== Game Over ====================

func (g *CipherTraceMode) handleGameOver(winTeam int) {
	g.state = CTStateGameOver
	util.Info("CipherTrace", "Game Over! Winning team: %d", winTeam)

	// Find the winner(s) — players on winning team at max level
	winners := []string{}
	for _, p := range g.players {
		if p.Team == winTeam {
			winners = append(winners, p.ID)
		}
	}

	if g.bridge != nil {
		g.bridge.Broadcast("ct_game_over", map[string]interface{}{
			"winTeam":     winTeam,
			"winners":     winners,
			"scores":      g.GetScores(),
			"totalRounds": g.roundNumber,
		})
	}
}

// ==================== Tribute System (进贡/抗贡/返供) ====================

// tributeState tracks the progress of the tribute phase.
type tributeState struct {
	losers       []string          // losing team player IDs (ordered by finish, worst first)
	winners      []string          // winning team player IDs (ordered by finish, best first)
	tributeCards map[string]int    // loserID → card given
	returnCards  map[string]int    // winnerID → card returned
	multiplier   int               // 1 = normal, 2 = after sweep
	antiTribute  bool              // true if tribute is cancelled (抗贡)
	phase        string            // "tribute_give", "tribute_return", "done"
}

func (g *CipherTraceMode) startTributePhase() {
	g.state = CTStateTribute

	winTeam := g.prevWinTeam
	multiplier := 1
	if g.isSweep {
		multiplier = 2
	}

	// Collect losers and winners ordered by finish position
	losers := []string{}
	winners := []string{}
	for _, id := range g.finishOrder {
		p := g.getPlayer(id)
		if p == nil {
			continue
		}
		// Note: teams from previous round are already resolved
		// We use prevWinTeam to determine who tributes
		// Losers = players NOT on winning team, worst finish first
		// But finishOrder is best-first, so losers are at the end
	}

	// Re-collect: losers are non-winning team, sorted worst-first
	for i := len(g.finishOrder) - 1; i >= 0; i-- {
		id := g.finishOrder[i]
		p := g.getPlayer(id)
		if p != nil && p.Team != winTeam {
			losers = append(losers, id)
		}
	}
	// Winners sorted best-first
	for _, id := range g.finishOrder {
		p := g.getPlayer(id)
		if p != nil && p.Team == winTeam {
			winners = append(winners, id)
		}
	}

	g.tribute = &tributeState{
		losers:       losers,
		winners:      winners,
		tributeCards: make(map[string]int),
		returnCards:  make(map[string]int),
		multiplier:   multiplier,
		phase:        "tribute_give",
	}

	// Check 抗贡: if any loser holds ALL red jokers in the game
	if g.checkAntiTribute() {
		g.tribute.antiTribute = true
		g.tribute.phase = "done"

		util.Info("CipherTrace", "Anti-tribute! Tribute cancelled")
		if g.bridge != nil {
			g.bridge.Broadcast("ct_tribute_phase", map[string]interface{}{
				"antiTribute": true,
			})
		}

		g.startPlaying()
		return
	}

	util.Info("CipherTrace", "Tribute phase: %d losers → %d winners, multiplier=%d",
		len(losers), len(winners), multiplier)

	if g.bridge != nil {
		g.bridge.Broadcast("ct_tribute_phase", map[string]interface{}{
			"antiTribute": false,
			"losers":      losers,
			"winners":     winners,
			"multiplier":  multiplier,
		})
	}

	// Request tribute from each loser
	for _, loserID := range losers {
		g.requestTributeGive(loserID)
	}
}

// checkAntiTribute returns true if any loser holds all red jokers.
func (g *CipherTraceMode) checkAntiTribute() bool {
	if g.tribute == nil {
		return false
	}

	// Count total red jokers in the game
	deckCount := DeckCountForPlayers(g.getPlayerCount())
	totalRedJokers := deckCount // one red joker per deck

	for _, loserID := range g.tribute.losers {
		p := g.getPlayer(loserID)
		if p == nil {
			continue
		}
		count := 0
		for _, card := range p.HandCards {
			if IsJoker(card) && GetPoint(card) == RedJoker {
				count++
			}
		}
		if count >= totalRedJokers {
			return true
		}
	}
	return false
}

func (g *CipherTraceMode) requestTributeGive(loserID string) {
	if g.bridge != nil {
		g.bridge.SendToPlayer(loserID, "ct_request_tribute_give", map[string]interface{}{
			"multiplier": g.tribute.multiplier,
		})
	}
}

// handleTributeGive processes a loser giving their highest card.
func (g *CipherTraceMode) handleTributeGive(playerID string, card int) (bool, string) {
	if g.state != CTStateTribute || g.tribute == nil || g.tribute.phase != "tribute_give" {
		return false, "Not in tribute give phase"
	}

	// Verify this player is a loser
	isLoser := false
	for _, id := range g.tribute.losers {
		if id == playerID {
			isLoser = true
			break
		}
	}
	if !isLoser {
		return false, "Not a tribute giver"
	}

	if _, already := g.tribute.tributeCards[playerID]; already {
		return false, "Already gave tribute"
	}

	p := g.getPlayer(playerID)
	if p == nil || !p.HasCards([]int{card}) {
		return false, "You don't have this card"
	}

	// Card must not be a wild card or joker
	if IsWildCard(card, g.currentLevel) || IsJoker(card) {
		return false, "Cannot tribute wild cards or jokers"
	}

	g.tribute.tributeCards[playerID] = card

	util.Info("CipherTrace", "Player %s tributes card 0x%x", playerID, card)

	// Check if all losers have given tribute
	if len(g.tribute.tributeCards) >= len(g.tribute.losers) {
		g.distributeTribute()
	}

	return true, ""
}

// distributeTribute gives tribute cards to winners and requests return cards.
func (g *CipherTraceMode) distributeTribute() {
	// Collect tribute cards sorted by value (highest first)
	type tributeEntry struct {
		loserID string
		card    int
		rank    int
	}
	entries := make([]tributeEntry, 0, len(g.tribute.tributeCards))
	for loserID, card := range g.tribute.tributeCards {
		entries = append(entries, tributeEntry{loserID, card, ctCardRank(GetPoint(card))})
	}
	// Sort highest first
	for i := 0; i < len(entries)-1; i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[j].rank > entries[i].rank {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	// Winners pick in order: 1st place gets 1st and 3rd card, 2nd place gets 2nd and 4th, etc.
	// For simple case (1 card per loser): 1st winner gets highest, 2nd gets next, etc.
	winnerIdx := 0
	for _, entry := range entries {
		if winnerIdx >= len(g.tribute.winners) {
			winnerIdx = 0 // wrap around
		}
		winnerID := g.tribute.winners[winnerIdx]

		// Transfer card
		loser := g.getPlayer(entry.loserID)
		winner := g.getPlayer(winnerID)
		if loser != nil && winner != nil {
			loser.RemoveCards([]int{entry.card})
			winner.AddCards([]int{entry.card})
			SortCardsInPlace(winner.HandCards, TwoHigh, true)
		}

		winnerIdx++
	}

	if g.bridge != nil {
		g.bridge.Broadcast("ct_tribute_given", map[string]interface{}{
			"tributeCards": g.tribute.tributeCards,
		})
	}

	// Now request return cards from winners
	g.tribute.phase = "tribute_return"
	for _, winnerID := range g.tribute.winners {
		g.requestTributeReturn(winnerID)
	}
}

func (g *CipherTraceMode) requestTributeReturn(winnerID string) {
	if g.bridge != nil {
		g.bridge.SendToPlayer(winnerID, "ct_request_tribute_return", map[string]interface{}{
			"count": g.tribute.multiplier, // return same number of cards received
		})
	}
}

// handleTributeReturn processes a winner returning a small card.
func (g *CipherTraceMode) handleTributeReturn(playerID string, card int) (bool, string) {
	if g.state != CTStateTribute || g.tribute == nil || g.tribute.phase != "tribute_return" {
		return false, "Not in tribute return phase"
	}

	isWinner := false
	for _, id := range g.tribute.winners {
		if id == playerID {
			isWinner = true
			break
		}
	}
	if !isWinner {
		return false, "Not a tribute returner"
	}

	if _, already := g.tribute.returnCards[playerID]; already {
		return false, "Already returned tribute"
	}

	p := g.getPlayer(playerID)
	if p == nil || !p.HasCards([]int{card}) {
		return false, "You don't have this card"
	}

	// Return card must have point < 10 (not level card, not joker)
	point := GetPoint(card)
	if IsJoker(card) {
		return false, "Cannot return jokers"
	}
	if ctCardRank(point) >= 10 {
		return false, "Return card must be less than 10"
	}
	levelPoint := levelToCardPoint(g.currentLevel)
	if point == levelPoint {
		return false, "Cannot return level cards"
	}
	// Cannot return the only signal card
	if card == g.signalCard {
		signalCount := 0
		for _, c := range p.HandCards {
			if c == g.signalCard {
				signalCount++
			}
		}
		if signalCount <= 1 {
			return false, "Cannot return your only signal card"
		}
	}

	g.tribute.returnCards[playerID] = card

	util.Info("CipherTrace", "Player %s returns card 0x%x", playerID, card)

	// Check if all winners have returned
	if len(g.tribute.returnCards) >= len(g.tribute.winners) {
		g.completeTribute()
	}

	return true, ""
}

func (g *CipherTraceMode) completeTribute() {
	// Transfer return cards back to losers (round-robin)
	type returnEntry struct {
		winnerID string
		card     int
	}
	entries := make([]returnEntry, 0)
	for winnerID, card := range g.tribute.returnCards {
		entries = append(entries, returnEntry{winnerID, card})
	}

	loserIdx := 0
	for _, entry := range entries {
		if loserIdx >= len(g.tribute.losers) {
			loserIdx = 0
		}
		loserID := g.tribute.losers[loserIdx]

		winner := g.getPlayer(entry.winnerID)
		loser := g.getPlayer(loserID)
		if winner != nil && loser != nil {
			winner.RemoveCards([]int{entry.card})
			loser.AddCards([]int{entry.card})
			SortCardsInPlace(loser.HandCards, TwoHigh, true)
		}

		loserIdx++
	}

	g.tribute.phase = "done"

	if g.bridge != nil {
		g.bridge.Broadcast("ct_tribute_complete", map[string]interface{}{
			"returnCards": g.tribute.returnCards,
		})
	}

	util.Info("CipherTrace", "Tribute phase complete")

	// Notify players of updated hands
	for _, pid := range g.playerOrder {
		p := g.getPlayer(pid)
		if p != nil && g.bridge != nil {
			g.bridge.SendToPlayer(pid, "ct_hand_updated", map[string]interface{}{
				"handCards": p.HandCards,
			})
		}
	}

	g.startPlaying()
}
