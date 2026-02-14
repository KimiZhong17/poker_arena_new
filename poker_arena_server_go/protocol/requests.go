package protocol

// CreateRoomRequest - 创建房间请求
type CreateRoomRequest struct {
	PlayerName string `json:"playerName"`
	GuestID    string `json:"guestId,omitempty"`
	GameMode   string `json:"gameMode"`
	MaxPlayers int    `json:"maxPlayers"`
}

// JoinRoomRequest - 加入房间请求
type JoinRoomRequest struct {
	RoomID     string `json:"roomId"`
	PlayerName string `json:"playerName"`
	GuestID    string `json:"guestId,omitempty"`
}

// ReconnectRequest - 重连请求
type ReconnectRequest struct {
	RoomID     string `json:"roomId"`
	PlayerID   string `json:"playerId,omitempty"`
	GuestID    string `json:"guestId,omitempty"`
	PlayerName string `json:"playerName"`
}

// DealerCallRequest - 庄家叫牌请求
type DealerCallRequest struct {
	RoomID     string `json:"roomId"`
	PlayerID   string `json:"playerId"`
	CardsToPlay int   `json:"cardsToPlay"`
}

// PlayCardsRequest - 出牌请求
type PlayCardsRequest struct {
	RoomID   string `json:"roomId"`
	PlayerID string `json:"playerId"`
	Cards    []int  `json:"cards"`
}

// SelectFirstDealerCardRequest - 选择首个庄家牌请求
type SelectFirstDealerCardRequest struct {
	RoomID   string `json:"roomId"`
	PlayerID string `json:"playerId"`
	Card     int    `json:"card"`
}

// SetAutoRequest - 设置托管请求
type SetAutoRequest struct {
	IsAuto bool `json:"isAuto"`
}
