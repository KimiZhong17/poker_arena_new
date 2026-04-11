package game

import (
	"encoding/json"
	"time"
)

// GameMode — room.go 调用游戏逻辑的统一接口
type GameMode interface {
	// Lifecycle
	InitGame(players []PlayerInfo)
	StartGame()
	Cleanup()

	// State queries
	GetState() string
	GetDeckSize() int
	GetPlayerHandCards(playerID string) []int
	GetScores() map[string]int

	// Auto-play
	SetPlayerAuto(playerID string, isAuto bool, reason string)
	ExecuteAutoAction(playerID string)
	IsPlayerAuto(playerID string) bool

	// Generic action dispatch — each mode handles its own action types
	HandleAction(actionType string, playerID string, data json.RawMessage) (success bool, errMsg string)

	// Reconnect — returns mode-specific state payload
	GetReconnectPayload(playerID string) interface{}
}

// RoomBridge — 游戏模式回调 room 的通道
type RoomBridge interface {
	Broadcast(msgType string, data interface{})
	SendToPlayer(playerID string, msgType string, data interface{})
	ScheduleTimer(d time.Duration, callback func())
	ScheduleAutoAction(playerID string)
	ClearAutoPlayTimer(playerID string)
}
