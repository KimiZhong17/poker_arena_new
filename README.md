# 🃏 Poker Arena (扑克竞技场)

A multiplayer online poker gaming platform built with Cocos Creator and Go. The client focuses on UI and input, while the Go server handles game logic and real-time state sync.

## 📋 Table of Contents

- [Features](#-features)
- [Game Modes](#-game-modes)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Networking & Deployment](#-networking--deployment)
- [Architecture](#-architecture)
- [Development](#-development)
- [License](#-license)

## ✨ Features

- **Multi-Game Support** - Extensible game mode system supporting multiple poker variants
- **Real-time Multiplayer** - WebSocket-based client-server architecture for low-latency gameplay
- **LAN Multiplayer Ready** - Simple IP-based configuration for local network sessions
- **Responsive UI** - Adaptive layouts for 2-5 players with dynamic positioning
- **Extensible Architecture** - Stage-based game flow with factory pattern for easy extension
- **Card Evaluation System** - Built-in hand evaluators for different game types
- **Reconnection Support** - Graceful reconnection within timeout window to restore game state
- **Auto-Play System** - AI strategies for disconnected players (conservative, aggressive, random)

## 🎮 Game Modes

### TheDecree (未定之数)

A Texas Hold'em inspired 2-4 player game with unique dealer mechanics.

**Game Rules:**
- 2-4 players supported
- Each player receives 5 cards + 4 community cards
- Dealer announces number of cards to play (1, 2, or 3 cards)
- All players select and play their chosen cards
- Best poker hand wins the round
- Winner earns bonus +1 point
- Loser becomes the next dealer

**Hand Rankings & Scoring:**
- High Card: 2 points
- Pair: 5 points
- Two Pair: 8 points
- Three of a Kind: 10 points
- Straight: 12 points
- Flush: 15 points
- Full House: 18 points
- Four of a Kind: 20 points
- Straight Flush: 23 points
- Royal Flush: 25 points

**Implementation Status:** ✅ Fully playable

### Guandan (掼蛋)

A traditional Chinese poker game for 5 players.

**Game Features:**
- 5 players required
- Uses 2 decks + 4 jokers (108 cards)
- ~21 cards per player
- Level rank progression system (3 → A)
- Bomb combinations supported

**Implementation Status:** 🔄 In Progress (framework complete, play validation pending)

## 🛠️ Technology Stack

### Client
- **Game Engine:** Cocos Creator 3.8.7
- **Language:** TypeScript (ES2017)
- **UI Framework:** Cocos Creator built-in UI system
- **Architecture:** Stage pattern, Factory pattern, Event-driven

### Server
- **Runtime:** Go 1.21
- **Realtime:** Gorilla WebSocket
- **Default Port:** 3000 (configurable via `poker_arena_server_go/config/config.go`)

## 📁 Project Structure

```
poker_arena_new/
├── poker_arena_client/                  # Cocos Creator game client
│   ├── assets/
│   │   ├── Scripts/
│   │   │   ├── Card/                    # Card system & evaluation
│   │   │   │   ├── CardConst.ts         # Card suit/point enumerations
│   │   │   │   ├── CardUtils.ts         # Card utilities (getSuit, getPoint, getLogicWeight)
│   │   │   │   ├── Dealer.ts            # Deck creation & shuffling (Fisher-Yates)
│   │   │   │   ├── HandEvaluator.ts     # Hand evaluation system
│   │   │   │   └── GameConfig.ts        # Game configuration constants
│   │   │   ├── Config/                  # Configuration files
│   │   │   │   ├── NetworkConfig.ts     # Server IP/port configuration
│   │   │   │   ├── SeatConfig.ts        # Player seat layouts (2-5 players)
│   │   │   │   ├── CardDisplayConfig.ts # Card visual display settings
│   │   │   │   ├── DealingAnimationConfig.ts  # Dealing animation parameters
│   │   │   │   └── UIConfig.ts          # UI colors, fonts, sizes
│   │   │   ├── Core/                    # Core game logic
│   │   │   │   ├── GameController.ts    # Main game orchestration
│   │   │   │   ├── GameMode/            # Game mode implementations
│   │   │   │   │   ├── GameModeClientBase.ts      # Abstract base class
│   │   │   │   │   ├── GameModeClientFactory.ts   # Factory for game modes
│   │   │   │   │   ├── TheDecreeModeClient.ts     # The Decree mode
│   │   │   │   │   ├── TheDecreeGameState.ts      # Game state enum
│   │   │   │   │   └── Handlers/                  # Event handlers
│   │   │   │   │       ├── DealingHandler.ts      # Dealing animations
│   │   │   │   │       ├── ShowdownHandler.ts     # Showdown display
│   │   │   │   │       └── ReconnectHandler.ts    # Reconnection restore
│   │   │   │   └── Stage/               # Game stage system
│   │   │   │       ├── GameStageBase.ts
│   │   │   │       ├── StageManager.ts  # Stage transitions
│   │   │   │       ├── ReadyStage.ts
│   │   │   │       ├── PlayingStage.ts
│   │   │   │       └── EndStage.ts
│   │   │   ├── Network/                 # Network communication
│   │   │   │   ├── NetworkClient.ts     # WebSocket client with reconnection
│   │   │   │   ├── NetworkManager.ts    # Singleton network manager
│   │   │   │   └── Messages.ts          # Message type definitions
│   │   │   ├── Services/                # Service layer
│   │   │   │   ├── AuthService.ts       # Authentication (login, guest, logout)
│   │   │   │   ├── GameService.ts       # Game event handling
│   │   │   │   └── RoomService.ts       # Room management (create, join, leave)
│   │   │   ├── LocalStore/              # Local state management
│   │   │   │   ├── LocalUserStore.ts    # User account data (persistent)
│   │   │   │   ├── LocalRoomStore.ts    # Room state (temporary)
│   │   │   │   ├── LocalGameStore.ts    # Game state during gameplay
│   │   │   │   └── LocalPlayerStore.ts  # Player data structures
│   │   │   ├── UI/                      # UI components
│   │   │   │   ├── PlayerUIManager.ts   # Master UI coordinator
│   │   │   │   ├── PlayerUIController.ts # Individual player UI
│   │   │   │   ├── PlayerHandDisplay.ts # Hand cards display & selection
│   │   │   │   ├── PlayerInfoPanel.ts   # Player info (name, score, status)
│   │   │   │   ├── DealingAnimator.ts   # Card dealing animations
│   │   │   │   ├── DeckPile.ts          # Visual card deck
│   │   │   │   ├── DealerIndicator.ts   # Current dealer indicator
│   │   │   │   ├── Poker.ts             # Individual card component
│   │   │   │   ├── PokerFactory.ts      # Card instance factory
│   │   │   │   ├── TheDecreeUIController.ts  # The Decree UI
│   │   │   │   ├── GuandanUIController.ts    # Guandan UI
│   │   │   │   ├── SceneUIController.ts # Scene-level UI (exit, settings)
│   │   │   │   ├── CardsToPlayHint.ts   # Hint display for cards to play
│   │   │   │   ├── MessageTip.ts        # Message notification system
│   │   │   │   ├── LoadingUI.ts         # Loading screen
│   │   │   │   └── Switch.ts           # Toggle switch component
│   │   │   ├── Utils/                   # Utilities
│   │   │   │   ├── EventCenter.ts       # Event bus for decoupled communication
│   │   │   │   ├── Logger.ts            # Logging utility
│   │   │   │   ├── IdGenerator.ts       # UUID generation
│   │   │   │   └── polyfills.ts         # Browser polyfills
│   │   │   ├── Login.ts                 # Login scene controller
│   │   │   ├── Hall.ts                  # Game mode selection scene
│   │   │   ├── Lobby.ts                 # Room creation/joining scene
│   │   │   ├── Game.ts                  # Main game scene orchestrator
│   │   │   └── SceneManager.ts          # Scene transition management
│   │   ├── Scenes/                      # Game scenes
│   │   │   ├── Login.scene
│   │   │   ├── Hall.scene
│   │   │   ├── Lobby.scene
│   │   │   └── GameRoom.scene
│   │   ├── Resources/                   # Game resources
│   │   │   ├── Pokers/                  # Card sprite assets & prefabs
│   │   │   ├── UI/                      # UI prefabs & backgrounds
│   │   │   └── Backgrounds/             # Scene backgrounds
│   │   └── Effects/                     # Shader effects
│   │       └── CardGlow.effect          # Card glow shader
│   └── settings/                        # Cocos editor settings
│
└── poker_arena_server_go/               # Go WebSocket server
    ├── main.go                          # Entry point, HTTP routes, graceful shutdown
    ├── config/
    │   └── config.go                    # Server configuration (port, CORS, timeouts)
    ├── core/
    │   ├── server.go                    # Main game server, WebSocket handling
    │   ├── room.go                      # Game room management & lifecycle
    │   └── session.go                   # Player session & connection
    ├── game/
    │   ├── the_decree.go                # The Decree game state machine
    │   ├── evaluator.go                 # Hand evaluation & comparison
    │   ├── player_manager.go            # Player management
    │   ├── auto_play.go                 # AI strategies (conservative/aggressive/random)
    │   ├── card_utils.go                # Card utilities
    │   ├── card_const.go                # Card constants
    │   ├── hand_type.go                 # Hand type definitions
    │   ├── types.go                     # Type definitions
    │   └── rand.go                      # Random utilities
    ├── protocol/
    │   ├── messages.go                  # Message type constants
    │   ├── events.go                    # Event data structures
    │   └── requests.go                  # Request data structures
    └── util/
        ├── logger.go                    # Structured logging (DEBUG/INFO/WARN/ERROR)
        ├── rate_limiter.go              # Token bucket rate limiting
        └── id_validator.go              # ID validation
```

## 🚀 Quick Start

### Prerequisites

- [Cocos Creator 3.8.7+](https://www.cocos.com/creator-download)
- [Go 1.21+](https://go.dev/)

### Server Setup

```bash
# Navigate to Go server directory
cd poker_arena_server_go

# Run directly
go run .

# Or build and run
# go build -o poker-arena-server
# ./poker-arena-server
```

The WebSocket server runs on port **3000** by default. It will print your LAN IP after startup.

### Client Setup

1. Open Cocos Creator 3.8.7+
2. Open the `poker_arena_client` project folder
3. (LAN) Update server IP/port in `poker_arena_client/assets/Scripts/Config/NetworkConfig.ts`
4. Open the `Login` scene from the assets
5. Click the Play button to run in the editor
6. Or build for your target platform (Web, iOS, Android, etc.)

## 🌐 Networking & Deployment

### Configuration

- **Server port**: `3000` by default (see `poker_arena_server_go/config/config.go`)
- **WebSocket endpoint**: `ws://<server-ip>:3000/ws`
- **Client IP/port**: `poker_arena_client/assets/Scripts/Config/NetworkConfig.ts`
- **Runtime update**: `NetworkConfig.setServerIP('192.168.1.100')`

### Health Checks

- `GET /health` → server status
- `GET /stats` → rooms/players summary

### Guides

- `LAN_MULTIPLAYER_GUIDE.md`
- `CLIENT_NETWORK_GUIDE.md`
- `MOBILE_H5_DEPLOYMENT_GUIDE.md`

## 🏗️ Architecture

### Client-Server Model

The client is a thin UI layer — all game logic runs on the Go server. Communication is via WebSocket with JSON messages.

### Game Mode System (Client)

```typescript
GameModeClientBase (Abstract)
├── TheDecreeModeClient
└── (GuandanModeClient - planned)
```

Each game mode has dedicated Handlers for specific concerns:
- `DealingHandler` - Card dealing animations and distribution
- `ShowdownHandler` - Showdown display and results
- `ReconnectHandler` - Game state restoration after reconnection

### Game Mode System (Server)

```go
// Game state machine (the_decree.go)
setup → first_dealer → dealer_call → player_selection → showdown → scoring → refill → game_over
```

### Stage Management

Games flow through three stages managed by `StageManager`:

```
ReadyStage → PlayingStage → EndStage
```

### Service Layer

The client uses a service-based architecture for server communication:
- `AuthService` - Authentication (login, guest login, logout)
- `GameService` - Game event handling and operations
- `RoomService` - Room management (create, join, leave)

### Local State Management

Client-side state is managed through dedicated stores:
- `LocalUserStore` - User account data (persistent)
- `LocalRoomStore` - Room state (temporary)
- `LocalGameStore` - Game state during gameplay
- `LocalPlayerStore` - Player data structures

### Card Encoding

Cards use 8-bit encoding: `suit (4 bits) | point (4 bits)`

**Suits:**
- Diamond: 0x00
- Club: 0x10
- Heart: 0x20
- Spade: 0x30
- Joker: 0x40

**Points:**
- 3-A: values 3-14
- 2: value 15
- Black Joker: 16
- Red Joker: 17

### UI Layout System

Supports responsive layouts for 2-5 players:
- **2 Players:** Face-to-face (bottom/top)
- **3 Players:** Triangle arrangement
- **4 Players:** Diamond arrangement
- **5 Players:** Pentagon arrangement

All layouts use Cocos Creator's Widget system for responsive positioning.

## 🔧 Development

### Adding a New Game Mode

1. **Server:** Add game logic in `poker_arena_server_go/game/`
2. **Client:** Create a new class extending `GameModeClientBase`:

```typescript
export class MyGameModeClient extends GameModeClientBase {
    // Implement required methods
}
```

3. Register in `GameModeClientFactory.ts`
4. Create a UI controller (e.g., `MyGameUIController.ts`)
5. Add Handlers for dealing, showdown, etc. if needed

### Code Style

- Use TypeScript strict mode
- Follow Cocos Creator conventions
- Separate UI logic from game logic
- Use Services for server communication, LocalStores for state

## 📄 License

ISC

---

**Developed with Cocos Creator 3.8.7 + Go 1.21**
