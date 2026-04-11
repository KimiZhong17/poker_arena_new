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
	connections         map[string]*PlayerSession // key: connID (for ReadPump/WritePump dispatch)
	playersByID         map[string]*PlayerSession // key: stable playerID (for game logic)
	disconnectedPlayers map[string]*PlayerSession // key: stable playerID

	cfg             *config.Config
	heartbeatTicker *time.Ticker
	heartbeatStop   chan struct{}
	heartbeatOnce   sync.Once
	connCounter     uint64

	gameActionLimiter *util.RateLimiter
	roomActionLimiter *util.RateLimiter
	connectionLimiter *util.RateLimiter
}

func NewGameServer(cfg *config.Config) *GameServer {
	s := &GameServer{
		rooms:               make(map[string]*GameRoom),
		connections:         make(map[string]*PlayerSession),
		playersByID:         make(map[string]*PlayerSession),
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

	// Create a temporary session; playerID defaults to connID and remains stable per player
	session := NewPlayerSession(conn, connID, "", connID)

	s.mu.Lock()
	s.connections[connID] = session
	s.mu.Unlock()

	util.Info("GameServer", "Client connected: %s", connID)

	go session.WritePump()
	go session.ReadPump(s)
}

// HandleMessage dispatches incoming messages
func (s *GameServer) HandleMessage(session *PlayerSession, env *protocol.Envelope) {
	if env.Type != protocol.Ping {
		util.Info("GameServer", "[conn=%s player=%s] Received message: type=%s, data=%s", session.ConnID, session.ID, env.Type, string(env.Data))
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
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleGameAction(session, protocol.DealerCall, env.Data)
	case protocol.SelectFirstDealerCard:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleGameAction(session, protocol.SelectFirstDealerCard, env.Data)
	case protocol.PlayCards:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleGameAction(session, protocol.PlayCards, env.Data)
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

	// Cipher Trace actions — all routed through generic handler
	case protocol.CTPickSignal, protocol.CTPlay, protocol.CTPass,
		protocol.CTTributeGive, protocol.CTTributeReturn:
		if !s.checkRateLimit(session, "game") {
			return
		}
		s.handleGameAction(session, env.Type, env.Data)

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

	if !isValidPlayerCount(req.GameMode, req.MaxPlayers) {
		s.sendError(session, protocol.ErrInternal, "Invalid player count for game mode")
		return
	}

	// Snapshot existing room IDs without holding s.mu during room operations.
	var existingIDs map[string]bool
	s.mu.RLock()
	roomsCount := len(s.rooms)
	existingIDs = make(map[string]bool, len(s.rooms))
	for id := range s.rooms {
		existingIDs[id] = true
	}
	s.mu.RUnlock()

	if roomsCount >= s.cfg.MaxRooms {
		s.sendError(session, protocol.ErrInternal, "Server is full")
		return
	}

	room := NewGameRoom(req.GameMode, req.MaxPlayers, existingIDs)

	session.Name = name
	session.GuestID = req.GuestID

	room.mu.Lock()
	added := room.AddPlayer(session)
	room.mu.Unlock()

	if !added {
		s.sendError(session, protocol.ErrInternal, "Failed to join room")
		return
	}

	// Finalize maps under s.mu (no room.mu held).
	s.mu.Lock()
	if len(s.rooms) >= s.cfg.MaxRooms {
		s.mu.Unlock()
		room.mu.Lock()
		room.RemovePlayer(session.ID)
		room.mu.Unlock()
		s.sendError(session, protocol.ErrInternal, "Server is full")
		return
	}
	if _, exists := s.rooms[room.ID]; exists {
		existingIDs := make(map[string]bool, len(s.rooms))
		for id := range s.rooms {
			existingIDs[id] = true
		}
		newID := generateUniqueRoomID(existingIDs)
		room.mu.Lock()
		room.ID = newID
		for _, p := range room.players {
			p.RoomID = newID
		}
		room.mu.Unlock()
	}
	s.rooms[room.ID] = room
	s.playersByID[session.ID] = session
	s.mu.Unlock()

	session.Send(protocol.RoomCreated, protocol.RoomCreatedEvent{
		RoomID:     room.ID,
		PlayerID:   session.ID,
		PlayerName: session.Name,
		MaxPlayers: room.MaxPlayers,
	})

	util.Info("GameServer", "Room created: %s by %s (playerID=%s)", room.ID, name, session.ID)
}

func (s *GameServer) handleJoinRoom(session *PlayerSession, req *protocol.JoinRoomRequest) {
	name := s.validateAndSanitizeName(session, req.PlayerName)
	if name == "" {
		return
	}

	var (
		room         *GameRoom
		disconnected *PlayerSession
		existing     *PlayerSession
	)

	// Snapshot room + possible reconnection candidates under s.mu.
	s.mu.RLock()
	room = s.rooms[req.RoomID]
	if room != nil && req.GuestID != "" {
		for _, p := range s.disconnectedPlayers {
			if p.GuestID == req.GuestID && p.RoomID == room.ID {
				disconnected = p
				break
			}
		}
		if disconnected == nil {
			for _, p := range s.playersByID {
				if p.GuestID == req.GuestID && p.RoomID == room.ID {
					existing = p
					break
				}
			}
		}
	}
	s.mu.RUnlock()

	if room == nil {
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return
	}

	session.Name = name
	session.GuestID = req.GuestID

	room.mu.Lock()
	if room.closed {
		room.mu.Unlock()
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return
	}

	// Check reconnection by GuestID during game
	if req.GuestID != "" && room.State == RoomPlaying {
		if disconnected != nil && room.GetPlayer(disconnected.ID) != nil {
			adopt := s.adoptSessionInRoomLocked(room, disconnected, session)
			reconnectState := room.GetReconnectState(session.ID)
			if reconnectState != nil {
				session.Send(protocol.ReconnectSuccess, reconnectState)
			}
			room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
				Player: session.GetInfo(),
			}, session.ID)
			room.RetriggerAutoPlayIfNeeded(session.ID)
			room.mu.Unlock()

			s.finalizeAdoptSession(session, adopt)
			util.Info("GameServer", "Player %s reconnected (disconnected) to room %s", name, room.ID)
			return
		}
		if existing != nil && room.GetPlayer(existing.ID) != nil {
			adopt := s.adoptSessionInRoomLocked(room, existing, session)
			reconnectState := room.GetReconnectState(session.ID)
			if reconnectState != nil {
				session.Send(protocol.ReconnectSuccess, reconnectState)
			}
			room.RetriggerAutoPlayIfNeeded(session.ID)
			room.mu.Unlock()

			s.finalizeAdoptSession(session, adopt)
			util.Info("GameServer", "Player %s reconnected (socket replaced) to room %s", name, room.ID)
			return
		}
	}

	if room.IsFull() {
		room.mu.Unlock()
		s.sendError(session, protocol.ErrRoomFull, "Room is full")
		return
	}

	room.AddPlayer(session)

	roomID := room.ID
	hostID := room.GetHostID()
	players := room.GetPlayersInfo()
	maxPlayers := room.MaxPlayers

	room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
		Player: session.GetInfo(),
	}, session.ID)
	room.mu.Unlock()

	s.mu.Lock()
	s.playersByID[session.ID] = session
	s.mu.Unlock()

	session.Send(protocol.RoomJoined, protocol.RoomJoinedEvent{
		RoomID:           roomID,
		PlayerID:         session.ID,
		MyPlayerIDInRoom: session.ID,
		HostID:           hostID,
		Players:          players,
		MaxPlayers:       maxPlayers,
	})

	util.Info("GameServer", "Player %s joined room %s (playerID=%s)", name, roomID, session.ID)
}

type adoptResult struct {
	sameSession bool
	oldConnID   string
}

// adoptSessionInRoomLocked replaces an existing player session with the current connection session.
// Caller must hold room.mu.
func (s *GameServer) adoptSessionInRoomLocked(room *GameRoom, old *PlayerSession, session *PlayerSession) adoptResult {
	if old == session {
		session.SetConnected(true)
		session.UpdateHeartbeat()
		if room != nil {
			room.players[session.ID] = session
		}
		return adoptResult{sameSession: true}
	}

	// Close old connection and stop its writer.
	old.StopWritePump()
	if old.Conn != nil {
		old.Conn.Close()
	}

	// Copy stable player state onto the new session.
	session.ID = old.ID
	session.GuestID = old.GuestID
	session.Name = old.Name
	session.RoomID = old.RoomID
	session.SeatIndex = old.SeatIndex
	session.IsReady = old.IsReady
	session.IsHost = old.IsHost
	session.SetConnected(true)
	session.UpdateHeartbeat()

	if room != nil {
		room.players[session.ID] = session
	}

	return adoptResult{oldConnID: old.ConnID}
}

// finalizeAdoptSession updates server maps without holding room.mu.
func (s *GameServer) finalizeAdoptSession(session *PlayerSession, res adoptResult) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !res.sameSession {
		delete(s.connections, res.oldConnID)
	}

	if !session.IsConnectionActive() {
		util.Warn("GameServer", "Skipping adopt finalization for disconnected session: player=%s conn=%s", session.ID, session.ConnID)
		return
	}

	delete(s.disconnectedPlayers, session.ID)
	s.playersByID[session.ID] = session
	s.connections[session.ConnID] = session
}

func (s *GameServer) handleReconnect(session *PlayerSession, req *protocol.ReconnectRequest) {
	if !util.IsValidPlayerName(req.PlayerName) {
		s.sendError(session, protocol.ErrInternal, "Invalid player name")
		return
	}

	var (
		room         *GameRoom
		disconnected *PlayerSession
	)

	// Snapshot room + disconnected player under s.mu.
	s.mu.RLock()
	room = s.rooms[req.RoomID]
	if req.PlayerID != "" {
		disconnected = s.disconnectedPlayers[req.PlayerID]
	}
	if disconnected == nil && req.GuestID != "" {
		for _, p := range s.disconnectedPlayers {
			if p.GuestID == req.GuestID {
				disconnected = p
				break
			}
		}
	}
	s.mu.RUnlock()

	if room == nil {
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return
	}

	room.mu.Lock()
	if room.State != RoomPlaying {
		room.mu.Unlock()
		s.sendError(session, protocol.ErrInvalidPlay, "Room is not in playing state")
		return
	}

	if disconnected == nil {
		room.mu.Unlock()
		s.sendError(session, protocol.ErrInternal, "Player session not found")
		return
	}

	if room.GetPlayer(disconnected.ID) == nil {
		room.mu.Unlock()
		s.sendError(session, protocol.ErrInternal, "Player not in room")
		return
	}

	adopt := s.adoptSessionInRoomLocked(room, disconnected, session)

	reconnectState := room.GetReconnectState(session.ID)
	if reconnectState != nil {
		session.Send(protocol.ReconnectSuccess, reconnectState)
	}

	room.Broadcast(protocol.PlayerJoined, protocol.PlayerJoinedEvent{
		Player: session.GetInfo(),
	}, session.ID)

	room.RetriggerAutoPlayIfNeeded(session.ID)
	room.mu.Unlock()

	s.finalizeAdoptSession(session, adopt)

	util.Info("GameServer", "Player %s reconnected to room %s", req.PlayerName, room.ID)
}

func (s *GameServer) handleLeaveRoom(session *PlayerSession) {
	// Phase 1: locate current player+room without holding room.mu.
	s.mu.RLock()
	player, ok := s.playersByID[session.ID]
	if !ok || player.RoomID == "" {
		s.mu.RUnlock()
		return
	}
	room, ok := s.rooms[player.RoomID]
	s.mu.RUnlock()
	if !ok || room == nil {
		return
	}

	var (
		emptyAfterLeave   bool
		shouldDestroyRoom bool
		destroyIDs        []string
	)

	room.mu.Lock()
	if room.closed {
		room.mu.Unlock()
		return
	}

	// During game: treat as disconnect
	if room.State == RoomPlaying {
		util.Info("GameServer", "Player %s left during game, switching to auto mode", player.Name)
		player.SetConnected(false)
		room.HandleSetAuto(player.ID, true)
		shouldDestroyRoom, destroyIDs = shouldDestroyRoomLocked(room)
		room.mu.Unlock()

		// Phase 3: update server maps (no room.mu held).
		s.mu.Lock()
		s.disconnectedPlayers[player.ID] = player
		delete(s.connections, player.ConnID)
		delete(s.playersByID, player.ID)
		if shouldDestroyRoom {
			for _, pid := range destroyIDs {
				delete(s.disconnectedPlayers, pid)
			}
		}
		s.mu.Unlock()

		if shouldDestroyRoom {
			s.deleteRoom(room, "all players disconnected")
		}
		return
	}

	// Not in game: remove from room
	removed, newHostID := room.RemovePlayer(player.ID)
	if removed == nil {
		room.mu.Unlock()
		return
	}

	room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: player.ID})

	if newHostID != "" {
		room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
		room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
			PlayerID: newHostID, IsReady: true,
		})
	}

	emptyAfterLeave = room.IsEmpty()
	room.mu.Unlock()

	s.mu.Lock()
	delete(s.connections, player.ConnID)
	delete(s.playersByID, player.ID)
	s.mu.Unlock()

	util.Info("GameServer", "Player %s left room %s", player.Name, room.ID)
	if emptyAfterLeave {
		s.deleteRoom(room, "empty")
	}
}

func (s *GameServer) handleReady(session *PlayerSession) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}
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

func (s *GameServer) handleGameAction(session *PlayerSession, actionType string, data json.RawMessage) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}
	defer room.mu.Unlock()

	room.HandleGameAction(actionType, player.ID, data)
}

func (s *GameServer) handleSetAuto(session *PlayerSession, req *protocol.SetAutoRequest) {
	player, room := s.getPlayerAndRoom(session)
	if player == nil {
		return
	}
	defer room.mu.Unlock()

	room.HandleSetAuto(player.ID, req.IsAuto)
}

// ==================== Connection Management ====================

func (s *GameServer) handlePing(session *PlayerSession) {
	// session is the connection-level object, update heartbeat directly
	session.UpdateHeartbeat()
	session.SendRaw(protocol.Pong)
}

// HandleDisconnect is called when a WebSocket connection closes
func (s *GameServer) HandleDisconnect(session *PlayerSession) {
	session.SetConnected(false)
	util.Info("GameServer", "Client disconnected: conn=%s player=%s", session.ConnID, session.ID)

	// Phase 1: update connection map + validate "current session" under s.mu.
	var (
		current *PlayerSession
		room    *GameRoom
	)
	s.mu.Lock()
	delete(s.connections, session.ConnID)

	// If this session has no playerID, nothing more to do
	if session.ID == "" {
		s.mu.Unlock()
		return
	}

	// Ensure this session is still the active session for the player
	var ok bool
	current, ok = s.playersByID[session.ID]
	if !ok || current != session {
		s.mu.Unlock()
		return
	}

	if current.RoomID == "" {
		delete(s.playersByID, current.ID)
		s.mu.Unlock()
		return
	}

	room, ok = s.rooms[current.RoomID]
	if !ok || room == nil {
		delete(s.playersByID, current.ID)
		s.mu.Unlock()
		return
	}
	s.mu.Unlock()

	var (
		emptyAfterLeave   bool
		shouldDestroyRoom bool
		destroyIDs        []string
	)

	room.mu.Lock()
	if room.GetPlayer(current.ID) != current {
		room.mu.Unlock()
		return
	}

	if room.closed {
		room.mu.Unlock()
		// Room is already closed/deleting; just clear the player from the server map.
		s.mu.Lock()
		if cur, ok := s.playersByID[current.ID]; ok && cur == current {
			delete(s.playersByID, current.ID)
		}
		s.mu.Unlock()
		return
	}

	current.SetConnected(false)

	if room.State == RoomPlaying {
		util.Info("GameServer", "Player %s disconnected during game, enabling auto mode", current.Name)
		room.HandleSetAuto(current.ID, true)
		shouldDestroyRoom, destroyIDs = shouldDestroyRoomLocked(room)
		room.mu.Unlock()

		s.mu.Lock()
		if cur, ok := s.playersByID[current.ID]; !ok || cur != current {
			s.mu.Unlock()
			return
		}
		s.disconnectedPlayers[current.ID] = current
		delete(s.playersByID, current.ID)
		if shouldDestroyRoom {
			for _, pid := range destroyIDs {
				delete(s.disconnectedPlayers, pid)
			}
		}
		s.mu.Unlock()

		if shouldDestroyRoom {
			s.deleteRoom(room, "all players disconnected")
		}
		return
	}

	// Not in game: remove from room
	removed, newHostID := room.RemovePlayer(current.ID)
	if removed != nil {
		room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: current.ID})
		if newHostID != "" {
			room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
			room.Broadcast(protocol.PlayerReady, protocol.PlayerReadyEvent{
				PlayerID: newHostID, IsReady: true,
			})
		}
	}
	emptyAfterLeave = room.IsEmpty()
	room.mu.Unlock()

	s.mu.Lock()
	if cur, ok := s.playersByID[current.ID]; ok && cur == current {
		delete(s.playersByID, current.ID)
	}
	s.mu.Unlock()

	if emptyAfterLeave {
		s.deleteRoom(room, "empty")
	}
}

// shouldDestroyRoomLocked returns whether the room should be destroyed because all players are disconnected.
// Caller must hold room.mu. It returns the stable player IDs that should be removed from s.disconnectedPlayers.
func shouldDestroyRoomLocked(room *GameRoom) (bool, []string) {
	allPlayers := room.GetAllPlayers()
	for _, p := range allPlayers {
		if p.IsConnectionActive() {
			return false, nil
		}
	}

	util.Info("GameServer", "All players disconnected from room %s, destroying", room.ID)
	ids := make([]string, 0, len(allPlayers))
	for _, p := range allPlayers {
		ids = append(ids, p.ID)
	}
	return true, ids
}

// deleteRoom closes a room and removes it from the server without ever nesting s.mu and room.mu.
// Safe to call multiple times.
func (s *GameServer) deleteRoom(room *GameRoom, reason string) {
	if room == nil {
		return
	}

	// Close first (takes room.mu). We intentionally do NOT hold s.mu here.
	room.Close()

	removed := false
	s.mu.Lock()
	if cur, ok := s.rooms[room.ID]; ok && cur == room {
		delete(s.rooms, room.ID)
		removed = true
	}
	s.mu.Unlock()

	if removed {
		util.Info("GameServer", "Room %s deleted (%s)", room.ID, reason)
	}
}

// ==================== Heartbeat ====================

func (s *GameServer) startHeartbeat() {
	s.heartbeatStop = make(chan struct{})
	s.heartbeatTicker = time.NewTicker(s.cfg.HeartbeatInterval)
	go func(stop <-chan struct{}) {
		for {
			select {
			case <-stop:
				return
			case <-s.heartbeatTicker.C:
				s.heartbeatCheck()
			}
		}
	}(s.heartbeatStop)
}

func (s *GameServer) stopHeartbeat() {
	s.heartbeatOnce.Do(func() {
		if s.heartbeatTicker != nil {
			s.heartbeatTicker.Stop()
		}
		if s.heartbeatStop != nil {
			close(s.heartbeatStop)
		}
	})
}

func (s *GameServer) heartbeatCheck() {
	// Snapshot current maps so we never hold s.mu while taking room.mu.
	var (
		playersSnapshot      []*PlayerSession
		disconnectedSnapshot []*PlayerSession
		roomsSnapshot        []*GameRoom
	)
	s.mu.RLock()
	playersSnapshot = make([]*PlayerSession, 0, len(s.playersByID))
	for _, p := range s.playersByID {
		playersSnapshot = append(playersSnapshot, p)
	}
	disconnectedSnapshot = make([]*PlayerSession, 0, len(s.disconnectedPlayers))
	for _, p := range s.disconnectedPlayers {
		disconnectedSnapshot = append(disconnectedSnapshot, p)
	}
	roomsSnapshot = make([]*GameRoom, 0, len(s.rooms))
	for _, r := range s.rooms {
		roomsSnapshot = append(roomsSnapshot, r)
	}
	s.mu.RUnlock()

	// Check connected player timeouts (playersByID).
	var toRemove []string
	for _, player := range playersSnapshot {
		if player.IsTimeout(s.cfg.PlayerDisconnectTimeout) {
			util.Info("GameServer", "Player %s timeout, removing...", player.Name)
			toRemove = append(toRemove, player.ID)
		}
	}
	for _, id := range toRemove {
		s.handleConnectedPlayerTimeout(id)
	}

	// Check disconnected player timeouts (5 min)
	reconnectTimeout := 5 * time.Minute
	var dcToRemove []string
	for _, player := range disconnectedSnapshot {
		if player.IsTimeout(reconnectTimeout) {
			util.Info("GameServer", "Disconnected player %s timeout, removing...", player.Name)
			dcToRemove = append(dcToRemove, player.ID)
		}
	}
	for _, pid := range dcToRemove {
		s.handleDisconnectedPlayerTimeout(pid)
	}

	// Check idle rooms
	for _, room := range roomsSnapshot {
		room.mu.Lock()
		shouldRemove := !room.closed && (room.IsEmpty() || room.IsIdle(s.cfg.RoomIdleTimeout))
		room.mu.Unlock()
		if shouldRemove {
			// Note: this may evict rooms with players if they are idle; this matches the previous behavior.
			s.deleteRoom(room, "idle/empty")
		}
	}

	// Cleanup expired rate limiter entries
	s.gameActionLimiter.Cleanup()
	s.roomActionLimiter.Cleanup()
	s.connectionLimiter.Cleanup()
}

// handleConnectedPlayerTimeout removes a timed-out connected player from server maps and updates the room state.
// It never holds s.mu and room.mu at the same time.
func (s *GameServer) handleConnectedPlayerTimeout(playerID string) {
	// Phase 1: locate player + room under s.mu.
	var (
		player *PlayerSession
		room   *GameRoom
	)
	s.mu.RLock()
	player = s.playersByID[playerID]
	if player != nil && player.RoomID != "" {
		room = s.rooms[player.RoomID]
	}
	s.mu.RUnlock()
	if player == nil {
		return
	}

	var (
		emptyAfterLeave   bool
		shouldDestroyRoom bool
		destroyIDs        []string
	)

	if room != nil {
		room.mu.Lock()
		if room.closed {
			room.mu.Unlock()
		} else if room.State == RoomPlaying {
			// During game: switch to auto-play instead of removing.
			player.SetConnected(false)
			room.HandleSetAuto(player.ID, true)
			shouldDestroyRoom, destroyIDs = shouldDestroyRoomLocked(room)
			room.mu.Unlock()

			s.mu.Lock()
			// Re-check the player is still the active connected session (may have reconnected).
			if cur, ok := s.playersByID[playerID]; !ok || cur != player {
				s.mu.Unlock()
				return
			}
			s.disconnectedPlayers[player.ID] = player
			delete(s.connections, player.ConnID)
			delete(s.playersByID, player.ID)
			if shouldDestroyRoom {
				for _, pid := range destroyIDs {
					delete(s.disconnectedPlayers, pid)
				}
			}
			s.mu.Unlock()

			if shouldDestroyRoom {
				s.deleteRoom(room, "all players disconnected")
			}
			return
		} else {
			// Not in game: remove from room.
			removed, newHostID := room.RemovePlayer(player.ID)
			if removed != nil {
				room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: player.ID})
				if newHostID != "" {
					room.Broadcast(protocol.HostChanged, protocol.HostChangedEvent{NewHostID: newHostID})
				}
			}
			emptyAfterLeave = room.IsEmpty()
			room.mu.Unlock()

			s.mu.Lock()
			if cur, ok := s.playersByID[playerID]; ok && cur == player {
				delete(s.connections, player.ConnID)
				delete(s.playersByID, player.ID)
			}
			s.mu.Unlock()

			if emptyAfterLeave {
				s.deleteRoom(room, "empty")
			}
			return
		}
	}

	// No room: just remove from server maps if still current.
	s.mu.Lock()
	if cur, ok := s.playersByID[playerID]; ok && cur == player {
		delete(s.connections, player.ConnID)
		delete(s.playersByID, player.ID)
	}
	s.mu.Unlock()
}

// handleDisconnectedPlayerTimeout removes a timed-out disconnected player from the room (if present) and server map.
// It never holds s.mu and room.mu at the same time.
func (s *GameServer) handleDisconnectedPlayerTimeout(playerID string) {
	// Phase 1: locate player + room under s.mu.
	var (
		player *PlayerSession
		room   *GameRoom
	)
	s.mu.RLock()
	player = s.disconnectedPlayers[playerID]
	if player != nil && player.RoomID != "" {
		room = s.rooms[player.RoomID]
	}
	s.mu.RUnlock()
	if player == nil {
		return
	}

	if room != nil {
		room.mu.Lock()
		if !room.closed {
			room.RemovePlayer(playerID)
			room.Broadcast(protocol.PlayerLeft, protocol.PlayerLeftEvent{PlayerID: playerID})
		}
		room.mu.Unlock()
	}

	s.mu.Lock()
	delete(s.disconnectedPlayers, playerID)
	s.mu.Unlock()
}

// ==================== Helpers ====================

// getPlayerAndRoom looks up the player and their room, then locks room.mu
// without nesting s.mu and room.mu. Callers must defer room.mu.Unlock() themselves.
// Callers must defer room.mu.Unlock() themselves.
func (s *GameServer) getPlayerAndRoom(session *PlayerSession) (*PlayerSession, *GameRoom) {
	s.mu.RLock()

	player, ok := s.playersByID[session.ID]
	if !ok || player.RoomID == "" {
		s.mu.RUnlock()
		s.sendError(session, protocol.ErrGameNotStarted, "Not in a game")
		return nil, nil
	}

	room, ok := s.rooms[player.RoomID]
	if !ok {
		s.mu.RUnlock()
		s.sendError(session, protocol.ErrRoomNotFound, "Room not found")
		return nil, nil
	}
	s.mu.RUnlock()

	room.mu.Lock()
	if room.closed {
		room.mu.Unlock()
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

func isValidPlayerCount(gameMode string, maxPlayers int) bool {
	switch gameMode {
	case "the_decree":
		return maxPlayers >= 2 && maxPlayers <= 4
	case "cipher_trace":
		return maxPlayers >= 5 && maxPlayers <= 8
	default:
		return false
	}
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

	if !limiter.IsAllowed(session.ConnID) {
		s.sendError(session, protocol.ErrInternal, "Too many requests, please slow down")
		util.Warn("GameServer", "Rate limit exceeded for %s (%s)", session.ConnID, limitType)
		return false
	}
	return true
}

func (s *GameServer) sendError(session *PlayerSession, code, message string) {
	session.Send(protocol.Error, protocol.ErrorEvent{Code: code, Message: message})
}

// StatsHandler returns server statistics
func (s *GameServer) StatsHandler(w http.ResponseWriter, r *http.Request) {
	type roomDetail struct {
		ID          string `json:"id"`
		PlayerCount int    `json:"playerCount"`
		State       string `json:"state"`
	}

	// Snapshot rooms under s.mu, then lock rooms individually to avoid lock nesting.
	var (
		roomsCount   int
		playersCount int
		rooms        []*GameRoom
	)
	s.mu.RLock()
	roomsCount = len(s.rooms)
	playersCount = len(s.playersByID)
	rooms = make([]*GameRoom, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	s.mu.RUnlock()

	details := make([]roomDetail, 0, len(rooms))
	for _, room := range rooms {
		room.mu.Lock()
		if !room.closed {
			details = append(details, roomDetail{
				ID:          room.ID,
				PlayerCount: room.GetPlayerCount(),
				State:       string(room.State),
			})
		}
		room.mu.Unlock()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rooms":       roomsCount,
		"players":     playersCount,
		"roomDetails": details,
	})
}

// Shutdown gracefully stops the server
func (s *GameServer) Shutdown() {
	s.stopHeartbeat()

	// Snapshot under s.mu then close outside to avoid lock nesting with room.mu/session operations.
	var (
		rooms    []*GameRoom
		players  []*PlayerSession
		conns    []*PlayerSession
	)
	s.mu.Lock()
	rooms = make([]*GameRoom, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	players = make([]*PlayerSession, 0, len(s.playersByID))
	for _, session := range s.playersByID {
		players = append(players, session)
	}
	conns = make([]*PlayerSession, 0, len(s.connections))
	for _, session := range s.connections {
		conns = append(conns, session)
	}
	s.mu.Unlock()

	for _, room := range rooms {
		room.Close()
	}

	for _, session := range players {
		session.Close()
		if session.Conn != nil {
			session.Conn.Close()
		}
	}

	for _, session := range conns {
		session.Close()
		if session.Conn != nil {
			session.Conn.Close()
		}
	}

	util.Info("GameServer", "Shutdown complete")
}
