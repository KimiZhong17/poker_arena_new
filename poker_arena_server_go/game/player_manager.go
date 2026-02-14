package game

import "poker-arena-server/util"

// PlayerManager manages an ordered collection of players
type PlayerManager struct {
	players     map[string]*TheDecreePlayer
	playerOrder []string
}

func NewPlayerManager() *PlayerManager {
	return &PlayerManager{
		players:     make(map[string]*TheDecreePlayer),
		playerOrder: []string{},
	}
}

func (pm *PlayerManager) CreatePlayers(infos []PlayerInfo) {
	pm.Clear()
	for _, info := range infos {
		p := NewTheDecreePlayer(info)
		pm.players[p.ID] = p
		pm.playerOrder = append(pm.playerOrder, p.ID)
	}
	util.Info("PlayerManager", "Created %d players", len(pm.players))
}

func (pm *PlayerManager) GetPlayer(id string) *TheDecreePlayer {
	return pm.players[id]
}

func (pm *PlayerManager) GetAllPlayers() []*TheDecreePlayer {
	result := make([]*TheDecreePlayer, 0, len(pm.playerOrder))
	for _, id := range pm.playerOrder {
		if p, ok := pm.players[id]; ok {
			result = append(result, p)
		}
	}
	return result
}

func (pm *PlayerManager) GetPlayerOrder() []string {
	out := make([]string, len(pm.playerOrder))
	copy(out, pm.playerOrder)
	return out
}

func (pm *PlayerManager) GetPlayerCount() int {
	return len(pm.players)
}

func (pm *PlayerManager) Clear() {
	pm.players = make(map[string]*TheDecreePlayer)
	pm.playerOrder = []string{}
}

func (pm *PlayerManager) UpdatePlayerID(oldID, newID string) bool {
	p, ok := pm.players[oldID]
	if !ok {
		return false
	}
	delete(pm.players, oldID)
	p.ID = newID
	pm.players[newID] = p

	for i, id := range pm.playerOrder {
		if id == oldID {
			pm.playerOrder[i] = newID
			break
		}
	}
	util.Info("PlayerManager", "Player ID updated: %s -> %s", oldID, newID)
	return true
}
