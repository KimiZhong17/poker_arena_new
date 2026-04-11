package game

import "time"

// CipherTracePlayer extends Player with Cipher Trace-specific fields.
type CipherTracePlayer struct {
	*Player
	Team           int       // 0=unknown, 1=dealer team, 2=opponent team
	HasSignalCard  bool      // whether hand contains the signal card
	SignalRevealed bool      // whether team identity has been publicly revealed
	FinishOrder    int       // 0=not finished, 1=first out, 2=second, etc.
	IsAuto         bool
	AutoStartTime  time.Time
	LastActionTime time.Time
}

func NewCipherTracePlayer(info PlayerInfo) *CipherTracePlayer {
	return &CipherTracePlayer{
		Player:         NewPlayer(info),
		LastActionTime: time.Now(),
	}
}

func (p *CipherTracePlayer) ResetRound() {
	p.Team = 0
	p.HasSignalCard = false
	p.SignalRevealed = false
	p.FinishOrder = 0
}
