package game

import "time"

// PlayerInfo for initialization
type PlayerInfo struct {
	ID        string
	Name      string
	SeatIndex int
	IsReady   bool
	IsHost    bool
}

// Player base struct
type Player struct {
	ID        string
	Name      string
	SeatIndex int
	IsReady   bool
	IsHost    bool
	HandCards []int
	Score     int
}

func NewPlayer(info PlayerInfo) *Player {
	return &Player{
		ID:        info.ID,
		Name:      info.Name,
		SeatIndex: info.SeatIndex,
		IsReady:   info.IsReady,
		IsHost:    info.IsHost,
		HandCards: []int{},
		Score:     0,
	}
}

func (p *Player) SetHandCards(cards []int) {
	p.HandCards = make([]int, len(cards))
	copy(p.HandCards, cards)
}

func (p *Player) AddCards(cards []int) {
	p.HandCards = append(p.HandCards, cards...)
}

func (p *Player) RemoveCards(cards []int) {
	for _, card := range cards {
		for i, hc := range p.HandCards {
			if hc == card {
				p.HandCards = append(p.HandCards[:i], p.HandCards[i+1:]...)
				break
			}
		}
	}
}

func (p *Player) HasCards(cards []int) bool {
	// Build a frequency map of hand cards
	have := make(map[int]int)
	for _, c := range p.HandCards {
		have[c]++
	}
	for _, c := range cards {
		if have[c] <= 0 {
			return false
		}
		have[c]--
	}
	return true
}

func (p *Player) GetInfo() PlayerInfo {
	return PlayerInfo{
		ID:        p.ID,
		Name:      p.Name,
		SeatIndex: p.SeatIndex,
		IsReady:   p.IsReady,
		IsHost:    p.IsHost,
	}
}

// TheDecreePlayer extends Player with game-specific fields
type TheDecreePlayer struct {
	*Player
	PlayedCards    []int
	HasPlayed      bool
	IsAuto         bool
	AutoStartTime  time.Time
	LastActionTime time.Time
}

func NewTheDecreePlayer(info PlayerInfo) *TheDecreePlayer {
	return &TheDecreePlayer{
		Player:         NewPlayer(info),
		PlayedCards:    []int{},
		HasPlayed:      false,
		IsAuto:         false,
		LastActionTime: time.Now(),
	}
}

func (p *TheDecreePlayer) PlayCardsAction(cards []int) {
	p.PlayedCards = make([]int, len(cards))
	copy(p.PlayedCards, cards)
	p.HasPlayed = true
}

func (p *TheDecreePlayer) ResetRound() {
	p.PlayedCards = []int{}
	p.HasPlayed = false
}
