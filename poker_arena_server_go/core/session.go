package core

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"poker-arena-server/protocol"
	"poker-arena-server/util"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	maxMsgSize = 4096
	sendBufSize = 64
)

// PlayerSession wraps a WebSocket connection
type PlayerSession struct {
	ID            string
	GuestID       string
	Name          string
	Conn          *websocket.Conn
	RoomID        string
	SeatIndex     int
	IsReady       bool
	IsHost        bool
	IsConnected   bool
	LastHeartbeat time.Time

	send chan []byte
	mu   sync.Mutex // protects Conn writes via channel, and field updates
}

func NewPlayerSession(conn *websocket.Conn, id, name, guestID string) *PlayerSession {
	return &PlayerSession{
		ID:            id,
		GuestID:       guestID,
		Name:          name,
		Conn:          conn,
		SeatIndex:     -1,
		IsConnected:   true,
		LastHeartbeat: time.Now(),
		send:          make(chan []byte, sendBufSize),
	}
}

// Send marshals and queues a message for sending
func (s *PlayerSession) Send(msgType string, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		util.Error("Session", "Failed to marshal data: %v", err)
		return
	}

	env := protocol.Envelope{
		Type: msgType,
		Data: json.RawMessage(payload),
	}
	bytes, err := json.Marshal(env)
	if err != nil {
		util.Error("Session", "Failed to marshal envelope: %v", err)
		return
	}

	select {
	case s.send <- bytes:
	default:
		util.Warn("Session", "Send buffer full for %s, dropping message", s.ID)
	}
}

// SendRaw queues raw bytes for sending (for pong etc.)
func (s *PlayerSession) SendRaw(msgType string) {
	env := protocol.Envelope{Type: msgType}
	bytes, _ := json.Marshal(env)
	select {
	case s.send <- bytes:
	default:
	}
}

// UpdateHeartbeat refreshes the heartbeat timestamp
func (s *PlayerSession) UpdateHeartbeat() {
	s.mu.Lock()
	s.LastHeartbeat = time.Now()
	s.mu.Unlock()
}

// IsTimeout checks if the player has timed out
func (s *PlayerSession) IsTimeout(timeout time.Duration) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Since(s.LastHeartbeat) > timeout
}

// GetInfo returns player info for broadcasting
func (s *PlayerSession) GetInfo() protocol.PlayerInfo {
	return protocol.PlayerInfo{
		ID:        s.ID,
		Name:      s.Name,
		SeatIndex: s.SeatIndex,
		IsReady:   s.IsReady,
		IsHost:    s.IsHost,
	}
}

// ReadPump reads messages from the WebSocket connection
func (s *PlayerSession) ReadPump(server *GameServer) {
	defer func() {
		server.HandleDisconnect(s)
		s.Conn.Close()
	}()

	s.Conn.SetReadLimit(maxMsgSize)
	s.Conn.SetReadDeadline(time.Now().Add(pongWait))
	s.Conn.SetPongHandler(func(string) error {
		s.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := s.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				util.Debug("Session", "Read error for %s: %v", s.ID, err)
			}
			break
		}

		var env protocol.Envelope
		if err := json.Unmarshal(message, &env); err != nil {
			util.Warn("Session", "Invalid message from %s: %v", s.ID, err)
			continue
		}

		server.HandleMessage(s, &env)
	}
}

// WritePump writes messages to the WebSocket connection
func (s *PlayerSession) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		s.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-s.send:
			s.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				s.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := s.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			s.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := s.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Close shuts down the session's send channel
func (s *PlayerSession) Close() {
	defer func() { recover() }() // ignore double close
	close(s.send)
}
