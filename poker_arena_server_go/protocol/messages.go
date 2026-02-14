package protocol

import "encoding/json"

// Envelope is the unified WebSocket message format
type Envelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Client -> Server message types
const (
	CreateRoom           = "create_room"
	JoinRoom             = "join_room"
	LeaveRoom            = "leave_room"
	Ready                = "ready"
	StartGame            = "start_game"
	RestartGame          = "restart_game"
	Reconnect            = "reconnect"
	DealerCall           = "dealer_call"
	PlayCards            = "play_cards"
	SelectFirstDealerCard = "select_first_dealer_card"
	SetAuto              = "set_auto"
	Ping                 = "ping"
)

// Server -> Client message types
const (
	RoomCreated                  = "room_created"
	RoomJoined                   = "room_joined"
	PlayerJoined                 = "player_joined"
	PlayerLeft                   = "player_left"
	PlayerReady                  = "player_ready"
	HostChanged                  = "host_changed"
	GameStart                    = "game_start"
	GameRestart                  = "game_restart"
	GameStateUpdate              = "game_state_update"
	RequestFirstDealerSelection  = "request_first_dealer_selection"
	PlayerSelectedCard           = "player_selected_card"
	FirstDealerReveal            = "first_dealer_reveal"
	DealerSelected               = "dealer_selected"
	DealerCalled                 = "dealer_called"
	DealCardsEvent               = "deal_cards"
	CommunityCardsEvent          = "community_cards"
	PlayerPlayed                 = "player_played"
	PlayerAutoChanged            = "player_auto_changed"
	Showdown                     = "showdown"
	RoundEnd                     = "round_end"
	GameOver                     = "game_over"
	ReconnectSuccess             = "reconnect_success"
	Error                        = "error"
	Pong                         = "pong"
)
