# 🃏 Poker Arena (扑克竞技场)

A multiplayer online poker gaming platform built with Cocos Creator and Node.js, supporting multiple poker game modes with extensible architecture.

## 📋 Table of Contents

- [Features](#-features)
- [Game Modes](#-game-modes)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Development](#-development)
- [License](#-license)

## ✨ Features

- **Multi-Game Support** - Extensible game mode system supporting multiple poker variants
- **Real-time Multiplayer** - WebSocket-based client-server architecture for low-latency gameplay
- **Responsive UI** - Adaptive layouts for 2-5 players with dynamic positioning
- **Extensible Architecture** - Stage-based game flow with factory pattern for easy extension
- **Card Evaluation System** - Built-in hand evaluators for different game types
- **Player Management** - Comprehensive player state tracking and management

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
- **Architecture:** Stage pattern, Factory pattern

### Server
- **Runtime:** Node.js
- **WebSocket Library:** nodejs-websocket 1.7.2
- **Port:** 8001

## 📁 Project Structure

```
poker_arena_new/
├── poker_arena_client/              # Cocos Creator game client
│   ├── assets/
│   │   ├── Scripts/
│   │   │   ├── Card/                # Card system & evaluation
│   │   │   │   ├── Dealer.ts        # Deck creation & shuffling
│   │   │   │   ├── CardUtils.ts     # Card utilities & comparison
│   │   │   │   ├── HandEvaluator.ts # Guandan hand evaluation
│   │   │   │   └── TexasHoldEmEvaluator.ts  # Hold'em hand ranking
│   │   │   ├── Core/                # Core game logic
│   │   │   │   ├── GameMode/        # Game mode implementations
│   │   │   │   │   ├── GameModeBase.ts
│   │   │   │   │   ├── TheDecreeMode.ts
│   │   │   │   │   ├── GuandanMode.ts
│   │   │   │   │   └── GameModeFactory.ts
│   │   │   │   ├── Stage/           # Game stage system
│   │   │   │   │   ├── GameStageBase.ts
│   │   │   │   │   ├── ReadyStage.ts
│   │   │   │   │   ├── PlayingStage.ts
│   │   │   │   │   └── EndStage.ts
│   │   │   │   └── Room/            # Room management
│   │   │   ├── UI/                  # UI components
│   │   │   │   ├── PlayerUIManager.ts
│   │   │   │   ├── PlayerUINode.ts
│   │   │   │   ├── PlayerHandDisplay.ts
│   │   │   │   ├── DealerIndicator.ts
│   │   │   │   └── UIControllers/   # Game-specific UI controllers
│   │   │   ├── Manager/             # System managers
│   │   │   │   ├── UserManager.ts
│   │   │   │   ├── RoomManager.ts
│   │   │   │   └── SceneManager.ts
│   │   │   └── Test/                # Testing utilities
│   │   └── resources/               # Game resources
│   └── settings/                    # Cocos editor settings
│
└── poker_arena_server/              # WebSocket game server
    ├── app.js                       # Server entry point
    ├── package.json
    └── node_modules/
```

## 🚀 Quick Start

### Prerequisites

- [Cocos Creator 3.8.7+](https://www.cocos.com/creator-download)
- [Node.js 14+](https://nodejs.org/)

### Server Setup

```bash
# Navigate to server directory
cd poker_arena_server

# Install dependencies
npm install

# Start the WebSocket server
node app.js
```

The server will start on port 8001.

### Client Setup

1. Open Cocos Creator 3.8.7+
2. Open the `poker_arena_client` project folder
3. Open the `Login` scene from the assets
4. Click the Play button to run in the editor
5. Or build for your target platform (Web, iOS, Android, etc.)

## 🏗️ Architecture

### Game Mode System

The game uses an extensible architecture based on abstract base classes:

```typescript
GameModeBase (Abstract)
├── TheDecreeMode
└── GuandanMode
```

**Creating a New Game Mode:**
1. Extend `GameModeBase`
2. Implement required methods (start, end, getPlayerCount, etc.)
3. Register in `GameModeFactory`

### Stage Management

Games flow through three stages:

```
ReadyStage → PlayingStage → EndStage
```

Each stage is managed by `StageManager` and can be extended for custom behavior.

### Player System

```typescript
Player (Base)
├── TheDecreePlayer
└── GuandanPlayer
```

Players have state tracking:
- `WAITING` - In lobby
- `PLAYING` - Active in game
- `THINKING` - Deciding move
- `PASSED` - Skipped turn
- `FINISHED` - Completed game

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

### Project Configuration

The client uses TypeScript with the following configuration:
- Target: ES2017
- Module: CommonJS
- Strict type checking enabled
- DOM libraries included

### Adding a New Game Mode

1. Create a new class extending `GameModeBase`:

```typescript
export class MyGameMode extends GameModeBase {
    // Implement required methods
}
```

2. Register in [GameModeFactory.ts](poker_arena_client/assets/Scripts/Core/GameMode/GameModeFactory.ts):

```typescript
GameModeFactory.registerGameMode("MyGame", MyGameMode);
```

3. Create a UI controller extending your base UI needs

4. Add stage implementations if custom flow is needed

### Testing

Test helpers are available in `poker_arena_client/assets/Scripts/Test/`:
- Card evaluation testing
- Game mode testing utilities
- Mock player data

### Code Style

- Use TypeScript strict mode
- Follow Cocos Creator conventions
- Separate UI logic from game logic
- Use managers for cross-cutting concerns

## 📄 License

ISC

---

**Developed with Cocos Creator 3.8.7**
