package core

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"poker-arena-server/config"
	"poker-arena-server/protocol"
	"poker-arena-server/util"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// GameServer manages all rooms and player connections
type GameServer struct {
	mu                  sync.RWMutex
	rooms               map[string]*GameRoom
	sessions            map[string]*PlayerSession // key: connection ID
	disconnectedPlayers map[string]*PlayerSession // key: player ID

	cfg             *config.Config
	heartbeatTicker *time.Ticker
	connCounter     uint64

	gameActionLimiter *util.RateLimiter
	roomActionLimiter *util.RateLimiter
	connectionLimiter *util.RateLimiter
}

func NewGameServer(cfg *config.Config) *GameServer {
	s := &GameServer{
		rooms:               make(map[string]*GameRoom),
		sessions:            make(map[string]*PlayerSession),
		disconnectedPlayers: make(map[string]*PlayerSession),
		cfg:                 cfg,
		gameActionLimiter:   util.NewRateLimiter(util.GameActionLimit),
		roomActionLimiter:   util.NewRateLimiter(util.RoomActionLimit),
		connectionLimiter:   util.NewRateLimiter(util.ConnectionLimit),
	}
	s.startHeartbeat()
	util.Info("GameServer", "Initialized")
	return s
}

// HandleWebSocket upgrades HTTP to WebSocket
func (s *GameServer) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		util.Error("GameServer", "WebSocket upgrade failed: %v", err)
		return
	}

	s.mu.Lock()
	s.connCounter++
	connID := fmt.Sprintf("conn_%d_%d", time.Now().UnixMilli(), s.connCounter)
	s.mu.Unlock()

	session := NewPlayerSession(conn, connID, "", "")
	util.Info("GameServer", "Client connected: %s", connID)

	go session.WritePump()
	go session.ReadPump(s)
}

// HandleMessage dispatches incoming messages
func (s *GameServer) HandleMessage(session *PlayerSession, env *protocol.Envelope) {
	if env.Type != protocol.Ping {
		util.Info("GameServer", "[%s] Received message: type=%s, data=%s", session.ID, env.Type, string(env.Data))
	}

	switch env.Type {
	case protocol.CreateRoom:
		var req protocol.CreateRoomRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal CreateRoom: %v, raw: %s", err, string(env.Data))
			return
		}
		if !s.checkRateLimit(session, "room") {
			return
		}
		s.handleCreateRoom(session, &req)
	case protocol.JoinRoom:
		var req protocol.JoinRoomRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal JoinRoom: %v", err)
			return
		}
		if !s.checkRateLimit(session, "room") {
			return
		}
		s.handleJoinRoom(session, &req)
	case protocol.Reconnect:
		var req protocol.ReconnectRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal Reconnect: %v", err)
			return
		}
		if !s.checkRateLimit(session, "connection") {
			return
		}
		s.handleReconnect(session, &req)
	case protocol.LeaveRoom:
		if !s.checkRateLimit(session, "room") {
			return
		}
		s.handleLeaveRoom(session)
	case protocol.Ready:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleReady(session)
	case protocol.StartGame:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleStartGame(session)
	case protocol.RestartGame:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleRestartGame(session)
	case protocol.DealerCall:
		var req protocol.DealerCallRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal DealerCall: %v", err)
			return
		}
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleDealerCall(session, &req)
	case protocol.SelectFirstDealerCard:
		var req protocol.SelectFirstDealerCardRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal SelectFirstDealerCard: %v", err)
			return
		}
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleSelectFirstDealerCard(session, &req)
	case protocol.PlayCards:
		var req protocol.PlayCardsRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal PlayCards: %v", err)
			return
		}
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handlePlayCards(session, &req)
	case protocol.SetAuto:
		var req protocol.SetAutoRequest
		if err := json.Unmarshal(env.Data, &req); err != nil {
			util.Warn("GameServer", "Failed to unmarshal SetAuto: %v", err)
			return
		}
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleSetAuto(session, &req)
	case protocol.Ping:
		s.handlePing(session)
	}
}

// ==================== Room Management ====================

func (s *GameServer) handleCreateRoom(session *PlayerSession, req *protocol.CreateRoomRequest) {
	name := s.validateAndSanitizeName(session, req.PlayerName)
	if name == "" {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.rooms) >= s.cfg.MaxRooms {
		s.sendError(session, protocol.ErrInternal, "Server is full")
		return
	}

	room := NewGameRoom(req.GameMode, req.MaxPlayers)

	session.Name = name
	session.GuestID = req.GuestID
	s.sessions[session.ID] = session

	room.mu.Lock()
	room.AddPlayer(session)
	room.mu.Unlock()

	s.rooms[room.ID] = room

	session.Send(protocol.RoomCreated, protocol.RoomCreatedEvent{
		RoomID:     room.ID,
		PlayerID:   session.ID,
		PlayerName: session.Name,
		MaxPlayers: room.MaxPlayers,
	})

	util.Info("GameServer", "Room created: %s by %s", room.ID, name)
}

func (s *GameServer) handleJoinRoom(session *PlayerSession, req *protocol.JoinRoomRequest) {
	name := s.validateAndSanitizeName(session, req.PlayerName)
	if name == "" {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[req.RoomID]
	if !ok {
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	// Check reconnection by guestId during game
	if req.GuestID != "" && room.State == RoomPlaying {
		if s.tryReconnectByGuestID(session, req.GuestID, room, name) {
			return
		}
		if s.tryReconnectOnlinePlayer(session, req.GuestID, room, name) {
			return
		}
	}

	if room.IsFull() {
		s.sendError(session, protocol.ErrRoomFull, "Room is full")
		return
	}

	session.Name = name
	session.GuestID = req.GuestID
	s.sessions[session.ID] = session

	room.AddPlayer(session)

	session.Send(protocol.RoomJoined, protocol.RoomJoinedEvent{
		RoomID:           room.ID,
		PlayerID:         session.ID,
		MyPlayerIDInRoom: session.ID,
		HostID:           room.GetHostID(),
		Players:          room.GetPlayersInfo(),
		MaxPlayers:       room.MaxPlayers,
	})

	room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
		Player: session.GetInfo(),
	}, session.ID)

	util.Info("GameServer", "Player %s joined room %s", name, room.ID)
}

func (s *GameServer) tryReconnectByGuestID(session *PlayerSession, guestID string, room *GameRoom, playerName string) bool {
	var disconnected *PlayerSession
	var originalID string

	for pid, p := range s.disconnectedPlayers {
		if p.GuestID == guestID && p.RoomID == room.ID {
			disconnected = p
			originalID = pid
			break
		}
	}

	if disconnected == nil {
		return false
	}

	if room.GetPlayer(originalID) == nil {
		return false
	}

	// Stop the new session's WritePump (it was started in HandleWebSocket)
	session.StopWritePump()

	// Reset the disconnected session with the new connection
	disconnected.ResetForReconnect(session.Conn)

	// Update player ID in room and game to match new session ID
	room.UpdatePlayerSocketID(originalID, session.ID)

	delete(s.disconnectedPlayers, originalID)
	s.sessions[session.ID] = disconnected

	// Start new WritePump for the reconnected session
	go disconnected.WritePump()

	// Build reconnect state (use new ID since we updated it)
	reconnectState := room.GetReconnectState(session.ID)
	if reconnectState != nil {
		disconnected.Send(protocol.ReconnectSuccess, reconnectState)
	}

	room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
		Player: disconnected.GetInfo(),
	}, disconnected.ID)

	// Re-trigger autoplay timer if player was in auto mode and it's their turn
	room.RetriggerAutoPlayIfNeeded(disconnected.ID)

	util.Info("GameServer", "Player %s auto-reconnected to room %s via JOIN_ROOM", playerName, room.ID)
	return true
}

func (s *GameServer) tryReconnectOnlinePlayer(session *PlayerSession, guestID string, room *GameRoom, playerName string) bool {
	var existing *PlayerSession
	var oldSocketID string

	for sid, p := range s.sessions {
		if p.GuestID == guestID && p.RoomID == room.ID {
			existing = p
			oldSocketID = sid
			break
		}
	}

	if existing == nil {
		return false
	}

	if room.GetPlayer(existing.ID) == nil {
		return false
	}

	// Stop old connection's WritePump and close old WebSocket
	if existing.ID != session.ID {
		existing.StopWritePump()
		if existing.Conn != nil {
			existing.Conn.Close()
		}
	}

	// Stop the new session's WritePump (it was started in HandleWebSocket)
	session.StopWritePump()

	// Reset existing session with the new connection
	existing.ResetForReconnect(session.Conn)

	oldPlayerID := existing.ID
	room.UpdatePlayerSocketID(oldPlayerID, session.ID)

	delete(s.sessions, oldSocketID)
	s.sessions[session.ID] = existing

	// Start new WritePump for the reconnected session
	go existing.WritePump()

	reconnectState := room.GetReconnectState(session.ID)
	if reconnectState != nil {
		existing.Send(protocol.ReconnectSuccess, reconnectState)
	}

	// Re-trigger autoplay timer if player was in auto mode and it's their turn
	room.RetriggerAutoPlayIfNeeded(session.ID)

	util.Info("GameServer", "Player %s reconnected (socket replaced) to room %s", playerName, room.ID)
	return true
}

func (s *GameServer) handleReconnect(session *PlayerSession, req *protocol.ReconnectRequest) {
	if !util.IsValidPlayerName(req.PlayerName) {
		s.sendError(session, protocol.ErrInternal, "Invalid player name")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[req.RoomID]
	if !ok {
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if room.State != RoomPlaying {
		s.sendError(session, protocol.ErrInvalidPlay, "Room is not in playing state")
		return
	}

	// Find disconnected player by guestId or playerId
	var disconnected *PlayerSession
	var originalID string

	if req.GuestID != "" {
		for pid, p := range s.disconnectedPlayers {
			if p.GuestID == req.GuestID {
				disconnected = p
				originalID = pid
				break
			}
		}
	}

	if disconnected == nil && req.PlayerID != "" {
		if p, ok := s.disconnectedPlayers[req.PlayerID]; ok {
			disconnected = p
			originalID = req.PlayerID
		}
	}

	if disconnected == nil {
		s.sendError(session, protocol.ErrInternal, "Player session not found")
		return
	}

	if room.GetPlayer(originalID) == nil {
		s.sendError(session, protocol.ErrInternal, "Player not in room")
		return
	}

	// Stop the new session's WritePump (it was started in HandleWebSocket)
	session.StopWritePump()

	// Reset the disconnected session with the new connection
	disconnected.ResetForReconnect(session.Conn)

	// Update player ID in room and game to match new session ID
	room.UpdatePlayerSocketID(originalID, session.ID)

	delete(s.disconnectedPlayers, originalID)
	s.sessions[session.ID] = disconnected

	// Start new WritePump for the reconnected session
	go disconnected.WritePump()

	reconnectState := room.GetReconnectState(session.ID)
	if reconnectState != nil {
		disconnected.Send(protocol.ReconnectSuccess, reconnectState)
	}

	room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
		Player: disconnected.GetInfo(),
	}, disconnected.ID)

	// Re-trigger autoplay timer if player was in auto mode and it's their turn
	room.RetriggerAutoPlayIfNeeded(disconnected.ID)

	util.Info("GameServer", "Player %s reconnected to room %s", req.PlayerName, room.ID)
}

func (s *GameServer) handleLeaveRoom(session *PlayerSession) {
	s.mu.Lock()
	defer s.mu.Unlock()

	player, ok := s.sessions[session.ID]
	if !ok || player.RoomID == "" {
		return
	}

	room, ok := s.rooms[player.RoomID]
	if !ok {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	// During game: treat as disconnect
	if room.State == RoomPlaying {
		util.Info("GameServer", "Player %s left during game, switching to auto mode", player.Name)
		player.IsConnected = false
		s.disconnectedPlayers[player.ID] = player
		delete(s.sessions, session.ID)
		room.HandleSetAuto(player.ID, true)
		s.checkAndDestroyEmptyRoom(room)
		return
	}

	// Not in game: remove from room
	removed, newHostID := room.RemovePlayer(player.ID)
	if removed == nil {
		return
	}

	room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: player.ID})

	if newHostID != "" {
		room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
		room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
			PlayerID: newHostID, IsReady: true,
		})
	}

	if room.IsEmpty() {
		delete(s.rooms, room.ID)
		util.Info("GameServer", "Room %s deleted (empty)", room.ID)
	}

	delete(s.sessions, session.ID)
	util.Info("GameServer", "Player %s left room %s", player.Name, room.ID)
}

func (s *GameServer) handleReady(session *PlayerSession) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	isReady := !player.IsReady
	room.SetPlayerReady(player.ID, isReady)

	room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
		PlayerID: player.ID, IsReady: isReady,
	})

	util.Info("GameServer", "Player %s ready: %v", player.Name, isReady)
}

func (s *GameServer) handleStartGame(session *PlayerSession) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if !player.IsHost {
		s.sendError(session, protocol.ErrInvalidPlay, "Only host can start the game")
		return
	}

	if !room.IsAllPlayersReady() {
		s.sendError(session, protocol.ErrInvalidPlay, "Not all players are ready")
		return
	}

	if !room.StartGame() {
		return
	}

	util.Info("GameServer", "Game started in room %s", room.ID)
}

func (s *GameServer) handleRestartGame(session *PlayerSession) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	room.SetPlayerReady(player.ID, true)
	room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
		PlayerID: player.ID, IsReady: true,
	})

	allReady := room.PlayerWantsRestart(player.ID)
	if allReady {
		room.RestartGame()
		util.Info("GameServer", "Room %s game state cleaned up", room.ID)
	}
}

// ==================== Game Actions ====================

func (s *GameServer) handleSelectFirstDealerCard(session *PlayerSession, req *protocol.SelectFirstDealerCardRequest) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if req.PlayerID != player.ID {
		s.sendError(session, protocol.ErrInvalidPlay, "Player ID mismatch")
		return
	}

	room.HandleSelectFirstDealerCard(player.ID, req.Card)
}

func (s *GameServer) handleDealerCall(session *PlayerSession, req *protocol.DealerCallRequest) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if req.PlayerID != player.ID {
		s.sendError(session, protocol.ErrInvalidPlay, "Player ID mismatch")
		return
	}

	room.HandleDealerCall(player.ID, req.CardsToPlay)
}

func (s *GameServer) handlePlayCards(session *PlayerSession, req *protocol.PlayCardsRequest) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if req.PlayerID != player.ID {
		s.sendError(session, protocol.ErrInvalidPlay, "Player ID mismatch")
		return
	}

	if !s.validateCards(session, req.Cards) {
		return
	}

	room.HandlePlayCards(player.ID, req.Cards)
}

func (s *GameServer) handleSetAuto(session *PlayerSession, req *protocol.SetAutoRequest) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	room.HandleSetAuto(player.ID, req.IsAuto)
}

// ==================== Connection Management ====================

func (s *GameServer) handlePing(session *PlayerSession) {
	s.mu.RLock()
	player := s.sessions[session.ID]
	s.mu.RUnlock()

	if player != nil {
		player.UpdateHeartbeat()
	}
	session.SendRaw(protocol.Pong)
}

// HandleDisconnect is called when a WebSocket connection closes
func (s *GameServer) HandleDisconnect(session *PlayerSession) {
	util.Info("GameServer", "Client disconnected: %s", session.ID)

	s.mu.Lock()
	defer s.mu.Unlock()

	player, ok := s.sessions[session.ID]
	if !ok || player.RoomID == "" {
		delete(s.sessions, session.ID)
		return
	}

	room, ok := s.rooms[player.RoomID]
	if !ok {
		delete(s.sessions, session.ID)
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	player.IsConnected = false

	if room.State == RoomPlaying {
		util.Info("GameServer", "Player %s disconnected during game, enabling auto mode", player.Name)
		s.disconnectedPlayers[player.ID] = player
		delete(s.sessions, session.ID)
		room.HandleSetAuto(player.ID, true)
		s.checkAndDestroyEmptyRoom(room)
	} else {
		// Not in game: remove from room
		removed, newHostID := room.RemovePlayer(player.ID)
		if removed != nil {
			room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: player.ID})
			if newHostID != "" {
				room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
				room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
					PlayerID: newHostID, IsReady: true,
				})
			}
		}
		if room.IsEmpty() {
			delete(s.rooms, room.ID)
		}
		delete(s.sessions, session.ID)
	}
}

func (s *GameServer) checkAndDestroyEmptyRoom(room *GameRoom) {
	allPlayers := room.GetAllPlayers()
	hasOnline := false
	for _, p := range allPlayers {
		if p.IsConnected {
			hasOnline = true
			break
		}
	}

	if !hasOnline {
		util.Info("GameServer", "All players disconnected from room %s, destroying", room.ID)
		for _, p := range allPlayers {
			delete(s.disconnectedPlayers, p.ID)
		}
		delete(s.rooms, room.ID)
	}
}

// ==================== Heartbeat ====================

func (s *GameServer) startHeartbeat() {
	s.heartbeatTicker = time.NewTicker(s.cfg.HeartbeatInterval)
	go func() {
		for range s.heartbeatTicker.C {
			s.heartbeatCheck()
		}
	}()
}

func (s *GameServer) heartbeatCheck() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// Check player timeouts
	var toRemove []string
	for id, player := range s.sessions {
		if player.IsTimeout(s.cfg.PlayerDisconnectTimeout) {
			util.Info("GameServer", "Player %s timeout, removing...", player.Name)
			toRemove = append(toRemove, id)
		}
	}
	for _, id := range toRemove {
		if player, ok := s.sessions[id]; ok {
			if player.RoomID != "" {
				if room, ok := s.rooms[player.RoomID]; ok {
					room.mu.Lock()
					if room.State == RoomPlaying {
						// During game: switch to auto-play instead of removing
						player.IsConnected = false
						s.disconnectedPlayers[player.ID] = player
						room.HandleSetAuto(player.ID, true)
						s.checkAndDestroyEmptyRoom(room)
					} else {
						// Not in game: remove from room
						removed, newHostID := room.RemovePlayer(player.ID)
						if removed != nil {
							room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: player.ID})
							if newHostID != "" {
								room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
							}
						}
						if room.IsEmpty() {
							delete(s.rooms, room.ID)
						}
					}
					room.mu.Unlock()
				}
			}
			delete(s.sessions, id)
		}
	}

	// Check disconnected player timeouts (5 min)
	reconnectTimeout := 5 * time.Minute
	var dcToRemove []string
	for pid, player := range s.disconnectedPlayers {
		if now.Sub(player.LastHeartbeat) > reconnectTimeout {
			util.Info("GameServer", "Disconnected player %s timeout, removing...", player.Name)
			dcToRemove = append(dcToRemove, pid)
		}
	}
	for _, pid := range dcToRemove {
		if player, ok := s.disconnectedPlayers[pid]; ok {
			if player.RoomID != "" {
				if room, ok := s.rooms[player.RoomID]; ok {
					room.mu.Lock()
					room.RemovePlayer(pid)
					room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: pid})
					room.mu.Unlock()
				}
			}
			delete(s.disconnectedPlayers, pid)
		}
	}

	// Check idle rooms
	var roomsToRemove []string
	for id, room := range s.rooms {
		room.mu.Lock()
		if room.IsEmpty() || room.IsIdle(s.cfg.RoomIdleTimeout) {
			roomsToRemove = append(roomsToRemove, id)
		}
		room.mu.Unlock()
	}
	for _, id := range roomsToRemove {
		delete(s.rooms, id)
		util.Info("GameServer", "Room %s removed (idle/empty)", id)
	}
}

// ==================== Helpers ====================

func (s *GameServer) getPlayerAndRoom(session *PlayerSession) (*PlayerSession, *GameRoom) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	player, ok := s.sessions[session.ID]
	if !ok || player.RoomID == "" {
		s.sendError(session, protocol.ErrGameNotStarted, "Not in a game")
		return nil, nil
	}

	room, ok := s.rooms[player.RoomID]
	if !ok {
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return nil, nil
	}

	return player, room
}

func (s *GameServer) validateAndSanitizeName(session *PlayerSession, name string) string {
	if !util.IsValidPlayerName(name) {
		s.sendError(session, protocol.ErrInternal, "Invalid player name")
		return ""
	}
	return util.SanitizePlayerName(name)
}

func (s *GameServer) validateCards(session *PlayerSession, cards []int) bool {
	if len(cards) == 0 {
		s.sendError(session, protocol.ErrInvalidPlay, "No cards provided")
		return false
	}
	if len(cards) > 3 {
		s.sendError(session, protocol.ErrInvalidPlay, "Too many cards")
		return false
	}
	seen := make(map[int]bool)
	for _, card := range cards {
		if !isValidCardValue(card) {
			s.sendError(session, protocol.ErrInvalidPlay, "Invalid card value")
			return false
		}
		if seen[card] {
			s.sendError(session, protocol.ErrInvalidPlay, "Duplicate cards")
			return false
		}
		seen[card] = true
	}
	return true
}

func isValidCardValue(card int) bool {
	if card < 0 || card > 0xFF {
		return false
	}
	suit := card & 0xF0
	point := card & 0x0F

	// Jokers
	if suit == 0x40 {
		return point == 0x01 || point == 0x02
	}
	// Normal cards
	if suit <= 0x30 {
		return point >= 3 && point <= 15
	}
	return false
}

func (s *GameServer) checkRateLimit(session *PlayerSession, limitType string) bool {
	var limiter *util.RateLimiter
	switch limitType {
	case "game":
		limiter = s.gameActionLimiter
	case "room":
		limiter = s.roomActionLimiter
	case "connection":
		limiter = s.connectionLimiter
	default:
		return true
	}

	if !limiter.IsAllowed(session.ID) {
		s.sendError(session, protocol.ErrInternal, "Too many requests, please slow down")
		util.Warn("GameServer", "Rate limit exceeded for %s (%s)", session.ID, limitType)
		return false
	}
	return true
}

func (s *GameServer) sendError(session *PlayerSession, code, message string) {
	session.Send(protocol.Error, protocol.ErrorEvent{Code: code, Message: message})
}

// StatsHandler returns server statistics
func (s *GameServer) StatsHandler(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	type roomDetail struct {
		ID          string `json:"id"`
		PlayerCount int    `json:"playerCount"`
		State       string `json:"state"`
	}

	details := make([]roomDetail, 0, len(s.rooms))
	for _, room := range s.rooms {
		room.mu.Lock()
		details = append(details, roomDetail{
			ID:          room.ID,
			PlayerCount: room.GetPlayerCount(),
			State:       string(room.State),
		})
		room.mu.Unlock()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rooms":       len(s.rooms),
		"players":     len(s.sessions),
		"roomDetails": details,
	})
}

// Shutdown gracefully stops the server
func (s *GameServer) Shutdown() {
	if s.heartbeatTicker != nil {
		s.heartbeatTicker.Stop()
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, session := range s.sessions {
		session.Close()
		if session.Conn != nil {
			session.Conn.Close()
		}
	}

	util.Info("GameServer", "Shutdown complete")
}
