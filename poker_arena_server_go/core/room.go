package core

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"poker-arena-server/game"
	"poker-arena-server/protocol"
	"poker-arena-server/util"
)

// RoomState represents the room lifecycle state
type RoomState string

const (
	RoomWaiting  RoomState = "waiting"
	RoomPlaying  RoomState = "playing"
	RoomFinished RoomState = "finished"
)

// GameRoom manages a single game session
type GameRoom struct {
	ID         string
	GameMode   string
	MaxPlayers int
	State      RoomState

	mu             sync.Mutex
	players        map[string]*PlayerSession
	playerOrder    []string // maintain insertion order
	hostID         string
	createdAt      time.Time
	lastActivityAt time.Time

	playersWantRestart map[string]bool
	playerAutoStates   map[string]bool

	// Game instance
	theDecreeGame *game.TheDecreeMode

	// Timers managed by room
	autoPlayTimers map[string]*time.Timer
	endGameTimer   *time.Timer
}

func NewGameRoom(gameMode string, maxPlayers int) *GameRoom {
	return &GameRoom{
		ID:                 generateRoomID(),
		GameMode:           gameMode,
		MaxPlayers:         maxPlayers,
		State:              RoomWaiting,
		players:            make(map[string]*PlayerSession),
		playerOrder:        []string{},
		createdAt:          time.Now(),
		lastActivityAt:     time.Now(),
		playersWantRestart: make(map[string]bool),
		playerAutoStates:   make(map[string]bool),
		autoPlayTimers:     make(map[string]*time.Timer),
	}
}

func generateRoomID() string {
	return fmt.Sprintf("%d", 1000+rand.Intn(9000))
}

// AddPlayer adds a player to the room. Must be called with mu held.
func (r *GameRoom) AddPlayer(player *PlayerSession) bool {
	if len(r.players) >= r.MaxPlayers {
		return false
	}

	player.RoomID = r.ID
	player.SeatIndex = r.findAvailableSeat()

	if len(r.players) == 0 {
		r.hostID = player.ID
		player.IsHost = true
		player.IsReady = true
	}

	r.players[player.ID] = player
	r.playerOrder = append(r.playerOrder, player.ID)
	r.updateActivity()

	util.Info("GameRoom", "[Room %s] Player %s joined (%d/%d), seat: %d",
		r.ID, player.Name, len(r.players), r.MaxPlayers, player.SeatIndex)
	return true
}

func (r *GameRoom) findAvailableSeat() int {
	occupied := make(map[int]bool)
	for _, p := range r.players {
		occupied[p.SeatIndex] = true
	}
	for i := 0; i < r.MaxPlayers; i++ {
		if !occupied[i] {
			return i
		}
	}
	return len(r.players)
}

// RemovePlayer removes a player. Must be called with mu held.
func (r *GameRoom) RemovePlayer(playerID string) (removed *PlayerSession, newHostID string) {
	player, ok := r.players[playerID]
	if !ok {
		return nil, ""
	}

	delete(r.players, playerID)
	// Remove from order
	for i, id := range r.playerOrder {
		if id == playerID {
			r.playerOrder = append(r.playerOrder[:i], r.playerOrder[i+1:]...)
			break
		}
	}
	player.RoomID = ""

	util.Info("GameRoom", "[Room %s] Player %s left (%d/%d)",
		r.ID, player.Name, len(r.players), r.MaxPlayers)

	// Transfer host if needed
	if r.hostID == playerID && len(r.players) > 0 {
		// Pick first remaining player
		newHost := r.players[r.playerOrder[0]]
		newHost.IsHost = true
		newHost.IsReady = true
		r.hostID = newHost.ID
		newHostID = newHost.ID
		util.Info("GameRoom", "[Room %s] Host transferred to %s", r.ID, newHost.Name)
	}

	r.updateActivity()
	return player, newHostID
}

func (r *GameRoom) GetPlayer(playerID string) *PlayerSession {
	return r.players[playerID]
}

func (r *GameRoom) GetAllPlayers() []*PlayerSession {
	result := make([]*PlayerSession, 0, len(r.playerOrder))
	for _, id := range r.playerOrder {
		if p, ok := r.players[id]; ok {
			result = append(result, p)
		}
	}
	return result
}

func (r *GameRoom) GetPlayerCount() int  { return len(r.players) }
func (r *GameRoom) IsEmpty() bool        { return len(r.players) == 0 }
func (r *GameRoom) IsFull() bool         { return len(r.players) >= r.MaxPlayers }
func (r *GameRoom) GetHostID() string    { return r.hostID }

func (r *GameRoom) SetPlayerReady(playerID string, isReady bool) bool {
	p, ok := r.players[playerID]
	if !ok {
		return false
	}
	p.IsReady = isReady
	r.updateActivity()
	return true
}

func (r *GameRoom) IsAllPlayersReady() bool {
	if len(r.players) < 2 {
		return false
	}
	for _, p := range r.players {
		if p.IsHost {
			continue
		}
		if !p.IsReady {
			return false
		}
	}
	return true
}

// Broadcast sends a message to all players in the room (optionally excluding one)
func (r *GameRoom) Broadcast(msgType string, data interface{}, excludeID ...string) {
	exclude := ""
	if len(excludeID) > 0 {
		exclude = excludeID[0]
	}
	for _, p := range r.players {
		if p.ID == exclude {
			continue
		}
		p.Send(msgType, data)
	}
}

// SendToPlayer sends a message to a specific player
func (r *GameRoom) SendToPlayer(playerID, msgType string, data interface{}) {
	if p, ok := r.players[playerID]; ok {
		p.Send(msgType, data)
	}
}

func (r *GameRoom) GetPlayersInfo() []protocol.PlayerInfo {
	infos := make([]protocol.PlayerInfo, 0, len(r.playerOrder))
	for _, id := range r.playerOrder {
		if p, ok := r.players[id]; ok {
			infos = append(infos, p.GetInfo())
		}
	}
	return infos
}

func (r *GameRoom) updateActivity() {
	r.lastActivityAt = time.Now()
}

func (r *GameRoom) IsIdle(timeout time.Duration) bool {
	return time.Since(r.lastActivityAt) > timeout
}

// ==================== Game Lifecycle ====================

// StartGame starts the game. Must be called with mu held.
func (r *GameRoom) StartGame() bool {
	if r.State != RoomWaiting {
		return false
	}
	if !r.IsAllPlayersReady() {
		return false
	}

	r.State = RoomPlaying
	util.Info("GameRoom", "[Room %s] Game started with %d players", r.ID, len(r.players))

	if r.GameMode == "the_decree" {
		r.initTheDecreeGame()
	}
	return true
}

func (r *GameRoom) EndGame() {
	r.State = RoomFinished
	util.Info("GameRoom", "[Room %s] Game ended", r.ID)

	r.endGameTimer = nil
	r.State = RoomWaiting

	if r.theDecreeGame != nil {
		r.theDecreeGame.Cleanup()
		r.theDecreeGame = nil
	}

	r.clearAllAutoPlayTimers()
}

func (r *GameRoom) RestartGame() bool {
	util.Info("GameRoom", "[Room %s] Cleaning up game state for restart...", r.ID)

	if r.endGameTimer != nil {
		r.endGameTimer.Stop()
		r.endGameTimer = nil
	}

	if r.theDecreeGame != nil {
		r.theDecreeGame.Cleanup()
		r.theDecreeGame = nil
	}

	r.clearAllAutoPlayTimers()
	r.State = RoomWaiting
	r.playersWantRestart = make(map[string]bool)

	util.Info("GameRoom", "[Room %s] Game state cleaned up, ready for new game", r.ID)
	return true
}

func (r *GameRoom) PlayerWantsRestart(playerID string) bool {
	r.playersWantRestart[playerID] = true
	return len(r.playersWantRestart) >= len(r.players)
}

// ==================== TheDecree Game Integration ====================

func (r *GameRoom) initTheDecreeGame() {
	callbacks := &game.GameCallbacks{
		OnGameStarted: func(communityCards []int, gameState string) {
			util.Info("GameRoom", "[Room %s] Broadcasting COMMUNITY_CARDS", r.ID)
			r.Broadcast(protocol.CommunityCardsEvent, protocol.CommunityCardsEventData{
				Cards:     communityCards,
				GameState: gameState,
			})
		},

		OnPlayerDealt: func(playerID string, cards []int) {
			deckSize := 0
			if r.theDecreeGame != nil {
				deckSize = r.theDecreeGame.GetDeckSize()
			}
			r.SendToPlayer(playerID, protocol.DealCardsEvent, protocol.DealCardsEventData{
				PlayerID:  playerID,
				HandCards: cards,
				DeckSize:  deckSize,
			})
		},

		OnRequestFirstDealerSelection: func(gameState string) {
			r.Broadcast(protocol.RequestFirstDealerSelection, protocol.RequestFirstDealerSelectionEvent{
				GameState: gameState,
			})
		},

		OnPlayerSelectedCard: func(playerID string) {
			r.Broadcast(protocol.PlayerSelectedCard, protocol.PlayerSelectedCardEvent{
				PlayerID: playerID,
			})
		},

		OnFirstDealerReveal: func(dealerID string, selections map[string]int, gameState string) {
			sels := make([]protocol.DealerSelection, 0, len(selections))
			for pid, card := range selections {
				sels = append(sels, protocol.DealerSelection{PlayerID: pid, Card: card})
			}
			r.Broadcast(protocol.FirstDealerReveal, protocol.FirstDealerRevealEvent{
				DealerID:   dealerID,
				Selections: sels,
				GameState:  gameState,
			})
		},

		OnNewRound: func(roundNumber int, dealerID string, gameState string) {
			r.Broadcast(protocol.DealerSelected, protocol.DealerSelectedEvent{
				DealerID:    dealerID,
				RoundNumber: roundNumber,
				GameState:   gameState,
			})
		},

		OnDealerCall: func(dealerID string, cardsToPlay int, gameState string) {
			r.Broadcast(protocol.DealerCalled, protocol.DealerCalledEvent{
				DealerID:    dealerID,
				CardsToPlay: cardsToPlay,
				GameState:   gameState,
			})
		},

		OnPlayerPlayed: func(playerID string, cardCount int) {
			r.Broadcast(protocol.PlayerPlayed, protocol.PlayerPlayedEvent{
				PlayerID:  playerID,
				CardCount: cardCount,
			})
		},

		OnShowdown: func(results map[string]*game.HandResult, gameState string) {
			showdownResults := make([]protocol.ShowdownResult, 0, len(results))
			for playerID, result := range results {
				p := r.theDecreeGame.GetPlayer(playerID)
				var cards []int
				if p != nil {
					cards = p.PlayedCards
				}
				isWinner := false
				if round := r.theDecreeGame.GetCurrentRound(); round != nil {
					isWinner = playerID == round.RoundWinnerID
				}
				showdownResults = append(showdownResults, protocol.ShowdownResult{
					PlayerID:     playerID,
					Cards:        cards,
					HandType:     int(result.Type),
					HandTypeName: game.GetChineseName(result.Type),
					Score:        game.GetHandScore(result.Type),
					IsWinner:     isWinner,
				})
			}
			r.Broadcast(protocol.Showdown, protocol.ShowdownEventData{
				Results:   showdownResults,
				GameState: gameState,
			})
		},

		OnRoundEnd: func(winnerID, loserID string, scores map[string]int, gameState string) {
			r.Broadcast(protocol.RoundEnd, protocol.RoundEndEvent{
				WinnerID:  winnerID,
				LoserID:   loserID,
				Scores:    scores,
				GameState: gameState,
			})
		},

		OnHandsRefilled: func(deckSize int) {
			if r.theDecreeGame == nil {
				return
			}
			allPlayers := r.theDecreeGame.GetAllPlayers()
			handCounts := make(map[string]int)
			for _, p := range allPlayers {
				handCounts[p.ID] = len(p.HandCards)
			}
			for _, p := range allPlayers {
				r.SendToPlayer(p.ID, protocol.DealCardsEvent, protocol.DealCardsEventData{
					PlayerID:      p.ID,
					HandCards:     p.HandCards,
					AllHandCounts: handCounts,
					DeckSize:      deckSize,
				})
			}
		},

		OnGameOver: func(winnerID string, scores map[string]int, totalRounds int, gameState string) {
			r.Broadcast(protocol.GameOver, protocol.GameOverEvent{
				WinnerID:    winnerID,
				Scores:      scores,
				TotalRounds: totalRounds,
				GameState:   gameState,
			})
			// End game after delay
			r.endGameTimer = time.AfterFunc(5*time.Second, func() {
				r.mu.Lock()
				defer r.mu.Unlock()
				r.EndGame()
			})
		},

		OnPlayerAutoChanged: func(playerID string, isAuto bool, reason string) {
			r.Broadcast(protocol.PlayerAutoChanged, protocol.PlayerAutoChangedEvent{
				PlayerID: playerID,
				IsAuto:   isAuto,
				Reason:   reason,
			})
		},

		// Timer scheduling delegated to room
		ScheduleAutoAction: func(playerID string) {
			r.scheduleAutoAction(playerID)
		},

		ClearAutoPlayTimer: func(playerID string) {
			r.clearAutoPlayTimer(playerID)
		},

		ScheduleShowdownDelay: func(callback func()) {
			time.AfterFunc(2*time.Second, func() {
				r.mu.Lock()
				defer r.mu.Unlock()
				if r.theDecreeGame != nil {
					callback()
				}
			})
		},

		ScheduleDealDelay: func(callback func()) {
			time.AfterFunc(500*time.Millisecond, func() {
				r.mu.Lock()
				defer r.mu.Unlock()
				if r.theDecreeGame != nil {
					callback()
				}
			})
		},
	}

	r.theDecreeGame = game.NewTheDecreeMode(callbacks)

	// Convert PlayerSession info to game.PlayerInfo
	playerInfos := make([]game.PlayerInfo, 0, len(r.playerOrder))
	for _, id := range r.playerOrder {
		if p, ok := r.players[id]; ok {
			playerInfos = append(playerInfos, game.PlayerInfo{
				ID:        p.ID,
				Name:      p.Name,
				SeatIndex: p.SeatIndex,
				IsReady:   p.IsReady,
				IsHost:    p.IsHost,
			})
		}
	}

	r.theDecreeGame.InitGame(playerInfos)

	// Apply saved auto states
	for playerID, isAuto := range r.playerAutoStates {
		if isAuto {
			r.theDecreeGame.SetPlayerAuto(playerID, true, "manual")
		}
	}

	// Start game
	r.theDecreeGame.StartGame()

	// Broadcast game start
	r.Broadcast(protocol.GameStart, protocol.GameStartEvent{
		Players: r.GetPlayersInfo(),
	})
}

// ==================== Game Action Handlers ====================

func (r *GameRoom) HandleSelectFirstDealerCard(playerID string, card int) bool {
	if r.theDecreeGame == nil {
		return false
	}
	success := r.theDecreeGame.SelectFirstDealerCard(playerID, card)
	if !success {
		r.SendToPlayer(playerID, protocol.Error, protocol.ErrorEvent{
			Code: "INVALID_ACTION", Message: "Invalid card selection",
		})
	}
	return success
}

func (r *GameRoom) HandleDealerCall(playerID string, cardsToPlay int) bool {
	if r.theDecreeGame == nil {
		return false
	}
	success := r.theDecreeGame.DealerCallAction(playerID, cardsToPlay)
	if !success {
		r.SendToPlayer(playerID, protocol.Error, protocol.ErrorEvent{
			Code: "INVALID_ACTION", Message: "Invalid dealer call",
		})
	}
	return success
}

func (r *GameRoom) HandlePlayCards(playerID string, cards []int) bool {
	if r.theDecreeGame == nil {
		return false
	}
	success := r.theDecreeGame.PlayCardsAction(cards, playerID)
	if !success {
		r.SendToPlayer(playerID, protocol.Error, protocol.ErrorEvent{
			Code: protocol.ErrInvalidPlay, Message: "Invalid card play",
		})
	}
	return success
}

func (r *GameRoom) HandleSetAuto(playerID string, isAuto bool) bool {
	_, ok := r.players[playerID]
	if !ok {
		return false
	}

	if r.theDecreeGame != nil {
		r.theDecreeGame.SetPlayerAuto(playerID, isAuto, "manual")
	} else {
		r.playerAutoStates[playerID] = isAuto
	}
	return true
}

// GetReconnectState builds the full game state for reconnection
func (r *GameRoom) GetReconnectState(playerID string) *protocol.ReconnectSuccessEvent {
	if r.theDecreeGame == nil {
		return nil
	}

	round := r.theDecreeGame.GetCurrentRound()
	allPlayers := r.theDecreeGame.GetAllPlayers()
	scores := r.theDecreeGame.GetScores()

	playerGameStates := make([]protocol.PlayerGameState, 0, len(allPlayers))
	for _, p := range allPlayers {
		playerGameStates = append(playerGameStates, protocol.PlayerGameState{
			PlayerID:        p.ID,
			HandCardCount:   len(p.HandCards),
			HasPlayed:       p.HasPlayed,
			PlayedCardCount: len(p.PlayedCards),
			IsAuto:          p.IsAuto,
		})
	}

	roundNumber := 0
	dealerID := ""
	cardsToPlay := 0
	if round != nil {
		roundNumber = round.RoundNumber
		dealerID = round.DealerID
		cardsToPlay = round.CardsToPlay
	}

	handCards := r.theDecreeGame.GetPlayerHandCards(playerID)
	if handCards == nil {
		handCards = []int{}
	}

	communityCards := r.theDecreeGame.GetCommunityCards()
	if communityCards == nil {
		communityCards = []int{}
	}

	return &protocol.ReconnectSuccessEvent{
		RoomID:           r.ID,
		PlayerID:         playerID,
		MyPlayerIDInRoom: playerID,
		HostID:           r.hostID,
		Players:          r.GetPlayersInfo(),
		MaxPlayers:       r.MaxPlayers,
		GameState:        r.theDecreeGame.GetState(),
		RoundNumber:      roundNumber,
		DealerID:         dealerID,
		CardsToPlay:      cardsToPlay,
		DeckSize:         r.theDecreeGame.GetDeckSize(),
		HandCards:        handCards,
		CommunityCards:   communityCards,
		Scores:           scores,
		PlayerGameStates: playerGameStates,
	}
}

// ==================== Timer Management ====================

// RetriggerAutoPlayIfNeeded re-schedules autoplay timer after reconnection
// if the player is still in auto mode and it's their turn.
func (r *GameRoom) RetriggerAutoPlayIfNeeded(playerID string) {
	if r.theDecreeGame == nil {
		return
	}
	p := r.theDecreeGame.GetPlayer(playerID)
	if p == nil || !p.IsAuto {
		return
	}
	// Player is in auto mode, re-schedule the timer
	r.scheduleAutoAction(playerID)
	util.Info("GameRoom", "[Room %s] Re-triggered autoplay for reconnected player %s", r.ID, playerID)
}

func (r *GameRoom) scheduleAutoAction(playerID string) {
	r.clearAutoPlayTimer(playerID)
	timer := time.AfterFunc(2*time.Second, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		delete(r.autoPlayTimers, playerID)
		if r.theDecreeGame != nil {
			r.theDecreeGame.ExecuteAutoAction(playerID)
		}
	})
	r.autoPlayTimers[playerID] = timer
}

func (r *GameRoom) clearAutoPlayTimer(playerID string) {
	if timer, ok := r.autoPlayTimers[playerID]; ok {
		timer.Stop()
		delete(r.autoPlayTimers, playerID)
	}
}

func (r *GameRoom) clearAllAutoPlayTimers() {
	for id, timer := range r.autoPlayTimers {
		timer.Stop()
		delete(r.autoPlayTimers, id)
	}
}
