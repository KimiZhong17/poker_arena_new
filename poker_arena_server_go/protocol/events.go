package protocol

// PlayerInfo - 玩家信息
type PlayerInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SeatIndex int    `json:"seatIndex"`
	IsReady   bool   `json:"isReady"`
	IsHost    bool   `json:"isHost"`
}

// RoomCreatedEvent - 房间创建成功
type RoomCreatedEvent struct {
	RoomID     string `json:"roomId"`
	PlayerID   string `json:"playerId"`
	PlayerName string `json:"playerName"`
	MaxPlayers int    `json:"maxPlayers"`
}

// RoomJoinedEvent - 加入房间成功
type RoomJoinedEvent struct {
	RoomID         string       `json:"roomId"`
	PlayerID       string       `json:"playerId"`
	MyPlayerIDInRoom string     `json:"myPlayerIdInRoom"`
	HostID         string       `json:"hostId"`
	Players        []PlayerInfo `json:"players"`
	MaxPlayers     int          `json:"maxPlayers"`
}

// PlayerJoinedEvent - 玩家加入
type PlayerJoinedEvent struct {
	Player PlayerInfo `json:"player"`
}

// PlayerLeftEvent - 玩家离开
type PlayerLeftEvent struct {
	PlayerID string `json:"playerId"`
}

// PlayerReadyEvent - 玩家准备
type PlayerReadyEvent struct {
	PlayerID string `json:"playerId"`
	IsReady  bool   `json:"isReady"`
}

// HostChangedEvent - 房主变更
type HostChangedEvent struct {
	NewHostID string `json:"newHostId"`
}

// GameStartEvent - 游戏开始
type GameStartEvent struct {
	Players []PlayerInfo `json:"players"`
}

// DealCardsEventData - 发牌
type DealCardsEventData struct {
	PlayerID      string         `json:"playerId"`
	HandCards     []int          `json:"handCards"`
	AllHandCounts map[string]int `json:"allHandCounts,omitempty"`
	DeckSize      int            `json:"deckSize"`
}

// CommunityCardsEventData - 公共牌
type CommunityCardsEventData struct {
	Cards     []int  `json:"cards"`
	GameState string `json:"gameState"`
}

// RequestFirstDealerSelectionEvent - 请求选牌
type RequestFirstDealerSelectionEvent struct {
	GameState string `json:"gameState"`
}

// PlayerSelectedCardEvent - 玩家已选牌
type PlayerSelectedCardEvent struct {
	PlayerID string `json:"playerId"`
}

// FirstDealerRevealEvent - 首个庄家揭晓
type FirstDealerRevealEvent struct {
	Selections []DealerSelection `json:"selections"`
	DealerID   string            `json:"dealerId"`
	GameState  string            `json:"gameState"`
}

// DealerSelection - 庄家选牌
type DealerSelection struct {
	PlayerID string `json:"playerId"`
	Card     int    `json:"card"`
}

// DealerSelectedEvent - 庄家选定
type DealerSelectedEvent struct {
	DealerID    string `json:"dealerId"`
	RoundNumber int    `json:"roundNumber"`
	GameState   string `json:"gameState,omitempty"`
}

// DealerCalledEvent - 庄家叫牌
type DealerCalledEvent struct {
	DealerID    string `json:"dealerId"`
	CardsToPlay int    `json:"cardsToPlay"`
	GameState   string `json:"gameState"`
}

// PlayerPlayedEvent - 玩家出牌
type PlayerPlayedEvent struct {
	PlayerID  string `json:"playerId"`
	CardCount int    `json:"cardCount"`
}

// ShowdownResult - 摊牌结果
type ShowdownResult struct {
	PlayerID     string `json:"playerId"`
	Cards        []int  `json:"cards"`
	HandType     int    `json:"handType"`
	HandTypeName string `json:"handTypeName"`
	Score        int    `json:"score"`
	IsWinner     bool   `json:"isWinner"`
}

// ShowdownEventData - 摊牌事件
type ShowdownEventData struct {
	Results   []ShowdownResult `json:"results"`
	GameState string           `json:"gameState"`
}

// RoundEndEvent - 回合结束
type RoundEndEvent struct {
	WinnerID  string         `json:"winnerId"`
	LoserID   string         `json:"loserId"`
	Scores    map[string]int `json:"scores"`
	GameState string         `json:"gameState"`
}

// GameOverEvent - 游戏结束
type GameOverEvent struct {
	WinnerID    string         `json:"winnerId"`
	Scores      map[string]int `json:"scores"`
	TotalRounds int            `json:"totalRounds"`
	GameState   string         `json:"gameState"`
}

// PlayerAutoChangedEvent - 托管状态变化
type PlayerAutoChangedEvent struct {
	PlayerID string `json:"playerId"`
	IsAuto   bool   `json:"isAuto"`
	Reason   string `json:"reason,omitempty"`
}

// ReconnectSuccessEvent - 重连成功
type ReconnectSuccessEvent struct {
	RoomID           string            `json:"roomId"`
	PlayerID         string            `json:"playerId"`
	MyPlayerIDInRoom string            `json:"myPlayerIdInRoom"`
	HostID           string            `json:"hostId"`
	Players          []PlayerInfo      `json:"players"`
	MaxPlayers       int               `json:"maxPlayers"`
	GameState        string            `json:"gameState"`
	RoundNumber      int               `json:"roundNumber"`
	DealerID         string            `json:"dealerId,omitempty"`
	CardsToPlay      int               `json:"cardsToPlay,omitempty"`
	DeckSize         int               `json:"deckSize"`
	HandCards        []int             `json:"handCards"`
	CommunityCards   []int             `json:"communityCards"`
	Scores           map[string]int    `json:"scores"`
	PlayerGameStates []PlayerGameState `json:"playerGameStates"`
}

// PlayerGameState - 玩家游戏状态（重连用）
type PlayerGameState struct {
	PlayerID        string `json:"playerId"`
	HandCardCount   int    `json:"handCardCount"`
	HasPlayed       bool   `json:"hasPlayed"`
	PlayedCardCount int    `json:"playedCardCount"`
	IsAuto          bool   `json:"isAuto"`
}

// ErrorEvent - 错误
type ErrorEvent struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error codes
const (
	ErrRoomNotFound  = "ROOM_NOT_FOUND"
	ErrRoomFull      = "ROOM_FULL"
	ErrInvalidPlay   = "INVALID_PLAY"
	ErrNotYourTurn   = "NOT_YOUR_TURN"
	ErrGameNotStarted = "GAME_NOT_STARTED"
	ErrAlreadyPlayed = "ALREADY_PLAYED"
	ErrInvalidCards  = "INVALID_CARDS"
	ErrNotDealer     = "NOT_DEALER"
	ErrInternal      = "INTERNAL_ERROR"
)
