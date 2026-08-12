# jAcquire 🏨

A modern, real-time LAN party adaptation of the classic board game **Acquire**. Built with a blazing-fast Python/FastAPI backend and a highly animated React/TypeScript frontend.

jAcquire brings the cutthroat corporate real estate market to your browser with live WebSocket synchronization, slick animations, custom game variants, and a robust networking model designed specifically for local multiplayer.

---

## ✨ Features

- **Real-Time Multiplayer:** Instantaneous game state updates across all clients using WebSockets.
- **LAN-Optimized Trust Model:** Session tokens automatically prevent LAN players from hijacking each other's turns or making unauthorized API calls.
- **Robust Reconnection:** Built-in exponential backoff and background polling ensure that dropped Wi-Fi or locked mobile screens won't ruin the game.
- **Slick UI & Animations:** Fluid DOM animations for tile placements, hotel mergers, and shareholder payouts using `motion/react`, custom CSS, and particle effects.
- **Detailed Game Log:** A highly stylized, rolling log that tracks every action, tile placement, and merger resolution in real-time.
- **Live Stock Tracking:** Automatically calculates dynamic hotel pricing, available shares, and projected majority/minority bonuses.
- **Persistent High Scores:** Tracks and displays the top 3 wealthiest tycoons per player-count.

## 🎲 Game Variants

Spice up standard Acquire with these optional rules (togglable by the Host in the lobby):

* **Wild Tile:** Each player receives one powerful "Wild Tile" that can be placed on *any* valid space on the board.
* **Special Powers:** Every player starts with all five power cards, each usable exactly once for the rest of the game (only one power may be activated per turn):
  * *Take 5:* Draw 5 extra tiles at the start of your turn.
  * *Place 4:* Place up to 4 tiles in a single turn.
  * *Buy 5:* Purchase up to 5 stocks instead of the standard 3.
  * *Free 3:* Your next 3 stock purchases this turn cost $0.
  * *Trade 2:* Trade two of your stocks for one from the bank, up to 3 times.
* **Fast Game:** The server randomly pre-places 15 non-adjacent tiles onto the board before the first turn begins to jump-start the economy.

---

## 🛠️ Tech Stack

**Backend**
- Python 3.11+
- FastAPI & Uvicorn (HTTP REST & WebSocket APIs)
- Pydantic (Strict data validation)
- Asyncio (Concurrent connection handling)

**Frontend**
- React 19 & TypeScript
- Vite (Bundler & Dev Server)
- Motion (fka Framer Motion - UI animations)
- `@tsparticles/confetti` & `@fireworks-js/react` (Celebratory VFX)

---

## 🚀 Running Locally

### Prerequisites
* Python 3.11 or higher
* [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/)

### 1. Start the Backend
Open a terminal in the project root and start the FastAPI server:
```bash
# Optional: Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies (fastapi, uvicorn, pydantic)
pip install fastapi uvicorn

# Start the server
python3 -m src.server.main

The backend runs on http://0.0.0.0:3000 and binds to all local network interfaces.
2. Start the Frontend

Open a second terminal window:
code Bash

# Install Node dependencies
pnpm install

# Start the Vite development server exposing to the local network
pnpm run dev

The frontend runs on http://localhost:5173.
One-Liner (Linux/GNOME)

If you are on a Linux environment using GNOME, you can launch both servers simultaneously with the included bash script:
code Bash

chmod +x jacquire.sh
./jacquire.sh

📁 Project Structure
code Text

jacquire/
├── src/
│   ├── server/
│   │   ├── main.py               # FastAPI app, routes, and WS endpoint
│   │   ├── game_logic.py         # Core Acquire rules engine & state mutation
│   │   ├── models.py             # Pydantic request/response models & Types
│   │   ├── connection_manager.py # WebSocket broadcasting & concurrency
│   │   ├── utils.py              # Price tables and server helpers
│   │   └── highscore.txt         # Persisted JSON-line high scores
│   │
│   ├── hooks/                    # Custom React hooks (WebSockets, timers)
│   ├── utils/                    # Shared TypeScript constants & helpers
│   ├── styles/                   # Modular CSS stylesheets
│   │
│   ├── App.tsx                   # Main React entry point & connection routing
│   ├── GameBoard.tsx             # Primary game UI and turn orchestration
│   ├── UnifiedIntro.tsx          # Lobby, player setup, and variant selection
│   ├── MergerResolutionModal.tsx # Complex stock trading/selling logic UI
│   └── ...                       # Additional React Components
│
├── package.json                  # Frontend dependencies and scripts
├── vite.config.ts                # Vite build configuration
└── jacquire.sh                   # Linux quick-start script

🤝 Networking Notes for LAN Parties

Because jAcquire is optimized for local area networks, the frontend dynamically points its API requests to window.location.hostname.
To play with friends on the same Wi-Fi:

    Find the host computer's local IP address (e.g., 192.168.1.55).

    Have your friends navigate to http://192.168.1.55:5173 on their phones or laptops.

    Enjoy the game!
