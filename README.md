# 🎲 LUDO ROYALE — Multiplayer Online Ludo Game

Play classic Ludo with friends anywhere in the world. Create a room, share the code, and play together in real-time from any device.

**Tech Stack:** Node.js · Express · Socket.io · Vanilla JS · SVG  
**Platforms:** Desktop browsers, Mobile browsers (iOS/Android), Tablets

---

## Table of Contents

1. [Quick Start (5 Minutes)](#-quick-start)
2. [How to Play](#-how-to-play)
3. [Project Architecture](#-project-architecture)
4. [Board Layout & Game Rules](#-board-layout--game-rules)
5. [Deploy Online (Play with Friends)](#-deploy-online)
6. [Mobile Support](#-mobile-support)
7. [Development Roadmap](#-development-roadmap)
8. [API Reference (Socket Events)](#-api-reference)
9. [Troubleshooting](#-troubleshooting)
10. [Contributing & Customization](#-customization)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 16+** — [Download here](https://nodejs.org/) (LTS recommended)
- **npm** — comes bundled with Node.js

### Install & Run

```bash
# 1. Clone or download the project
cd ludo-royale

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open your browser to **http://localhost:3000** — that's it!

### Test Multiplayer Locally

Open **two browser tabs** pointing to `http://localhost:3000`:
1. Tab 1 → Enter a name → Click "Create Room" → Copy the room code
2. Tab 2 → Enter a different name → Click "Join Room" → Paste the code
3. Tab 1 → Click "Start Game"
4. Play!

---

## 🎮 How to Play

### Game Flow

```
Enter Name → Create/Join Room → Lobby (wait for players) → Game → Winner!
```

### Rules

| Rule | Description |
|------|-------------|
| **Enter the board** | Roll a **6** to move a token from home base onto the track |
| **Move clockwise** | Tokens travel the 52-cell outer track clockwise |
| **Roll 6 = bonus turn** | Rolling a 6 gives you another roll |
| **Capture** | Land on an opponent's token to send it back to their home base |
| **Safe spots (★)** | Tokens on starred cells cannot be captured (8 safe spots total) |
| **Home column** | After going around the board, tokens enter the colored home column |
| **Win condition** | First player to get all 4 tokens into the center wins |
| **Three 6s** | Rolling three consecutive 6s forfeits your turn |

### Safe Positions

The board has 8 safe positions marked with ★ stars:
- 4 starting positions (one per color)
- 4 additional safe spots evenly spaced around the track

---

## 🏗 Project Architecture

```
ludo-royale/
├── server.js              ← Backend: Express + Socket.io game server
├── package.json           ← Dependencies & scripts
├── .gitignore
├── README.md              ← This file
│
└── public/                ← Frontend (served as static files)
    ├── index.html         ← 4-screen UI (Welcome, Lobby, Game, Winner)
    ├── styles.css         ← Responsive styling with animations
    └── game.js            ← Board renderer, game logic, Socket.io client
```

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE                          │
│                                                              │
│  ┌─────────┐     Socket.io      ┌──────────────────────┐    │
│  │ Browser  │ ◄──── WebSocket ──►│   Node.js Server     │    │
│  │ (Client) │    (real-time)     │   (Single Source      │    │
│  │          │                    │    of Truth)          │    │
│  │ • SVG    │  Events:           │                      │    │
│  │   Board  │  → createRoom      │  • Room management   │    │
│  │ • Game   │  → joinRoom        │  • Game state        │    │
│  │   UI     │  → rollDice        │  • Dice validation   │    │
│  │ • Chat   │  → moveToken       │  • Move validation   │    │
│  │          │  ← diceRolled      │  • Capture detection  │   │
│  │          │  ← tokenMoved      │  • Win detection     │    │
│  │          │  ← turnChanged     │  • Chat relay        │    │
│  └─────────┘                    └──────────────────────┘    │
│                                                              │
│  Client 2, 3, 4 connect the same way.                       │
│  Server validates ALL actions — clients can't cheat.        │
└──────────────────────────────────────────────────────────────┘
```

**Key principle:** The server is the single source of truth. Clients send *intents* (roll dice, move token), and the server validates and broadcasts the results to everyone.

---

## 🎯 Board Layout & Game Rules

### The 15×15 Grid

The Ludo board is a 15×15 grid with this structure:

```
┌────────┬───┬───┬───┬────────┐
│        │   │   │   │        │
│  RED   │ ↓ │ G │ ↓ │ GREEN  │
│  HOME  │   │ H │   │  HOME  │
│  BASE  │   │ C │   │  BASE  │
│        │   │   │   │        │
│ (6×6)  │   │   │   │ (6×6)  │
├────────┼───┼───┼───┼────────┤
│ → │R H │   │ ▲ │   │   │  ← │
├───┤  C ├───┼───┼───┤   ├────┤
│ → │    │ R │ ✦ │ Y │   │  ← │  ← Center (3×3)
├───┤    ├───┼───┼───┤   ├────┤     with colored
│ → │    │   │ ▼ │   │Y H│  ← │     triangles
├────────┼───┼───┼───┼──C├────┤
│        │   │ B │   │   │    │
│  BLUE  │ ↑ │ H │ ↑ │YELLOW │
│  HOME  │   │ C │   │  HOME  │
│  BASE  │   │   │   │  BASE  │
│        │   │   │   │        │
│ (6×6)  │   │   │   │ (6×6)  │
└────────┴───┴───┴───┴────────┘

R/G/Y/B HC = Home Columns (colored paths to center)
✦ = Center finish area
★ = Safe positions (on the track)
```

### Track Layout (52 cells)

Tokens travel clockwise around the outer track:
- **Red** enters at position 0 (row 6, col 1) → travels up, right, down, left
- **Green** enters at position 13 (row 1, col 8)
- **Yellow** enters at position 26 (row 8, col 13)
- **Blue** enters at position 39 (row 13, col 6)

After completing a full circuit, tokens enter their colored **home column** (5 cells leading to center), then reach the **finish** in the center.

---

## 🌍 Deploy Online

To play with friends over the internet, you need to deploy the server. Here are 3 free options:

### Option 1: Render.com (Recommended — 100% Free)

**Step 1:** Push code to GitHub
```bash
cd ludo-royale
git init
git add .
git commit -m "Ludo Royale multiplayer game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ludo-royale.git
git push -u origin main
```

**Step 2:** Deploy on Render
1. Go to [render.com](https://render.com) → Sign up with GitHub (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your `ludo-royale` repository
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click **"Create Web Service"**
6. Wait 2-3 minutes

You'll get a URL like `https://ludo-royale-abc.onrender.com` — share it with friends!

**Note:** Free tier servers sleep after 15 minutes of inactivity. First visit after sleep takes ~30 seconds to wake up.

### Option 2: Railway.app (Also Free)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select `ludo-royale` → Railway auto-deploys
4. Go to Settings → copy your public domain
5. Share with friends

### Option 3: ngrok (Quick Testing, No Deploy)

Perfect for testing — no GitHub needed:

```bash
# Terminal 1: Start your server
npm start

# Terminal 2: Expose it to the internet
npx ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL and share it. Works immediately!

**Limitation:** URL changes every restart (unless you pay for ngrok).

### Playing with Friends

Once deployed:
1. **You** open the URL → Enter name → Click "Create Room"
2. **Copy** the 6-character room code
3. **Share** the URL + room code via WhatsApp, Discord, etc.
4. **Friends** open the URL → Enter name → Click "Join Room" → Enter code
5. **You** click "Start Game" when everyone's in
6. **Play!** 🎲

---

## 📱 Mobile Support

The game is fully responsive and works on:

| Platform | Browser | Status |
|----------|---------|--------|
| iPhone | Safari, Chrome | ✅ Full support |
| Android | Chrome, Firefox | ✅ Full support |
| iPad | Safari | ✅ Full support |
| Desktop | Chrome, Firefox, Safari, Edge | ✅ Full support |

### Mobile optimizations included:
- Touch-friendly token selection (tap to move)
- Responsive board that scales to screen size
- Landscape mode support
- No pinch-zoom interference (viewport locked)
- Collapsible chat panel

---

## 🗺 Development Roadmap

### Phase 1: Core Game ✅ (Current)
- [x] Authentic 15×15 Ludo board with SVG rendering
- [x] 8 safe positions with star markers
- [x] Colored home columns with directional flow
- [x] Complete 52-cell track with clockwise movement
- [x] Room creation & joining with 6-character codes
- [x] Real-time multiplayer (2-4 players) via Socket.io
- [x] Server-side game state validation (anti-cheat)
- [x] Dice rolling with animation
- [x] Token capture mechanics
- [x] Win detection
- [x] Player disconnect handling
- [x] In-game chat
- [x] Mobile responsive design

### Phase 2: Polish & UX (Next)
- [ ] Token movement animation (smooth SVG transitions)
- [ ] Sound effects (dice roll, token move, capture, win)
- [ ] Haptic feedback on mobile
- [ ] Player avatars / emoji selection
- [ ] "Share Room" button (native share API on mobile)
- [ ] Spectator mode
- [ ] Game timer per turn (30-second auto-skip)

### Phase 3: AI & Solo Play
- [ ] AI opponent (easy / medium / hard)
- [ ] Practice mode (play vs bots offline)
- [ ] Tutorial / interactive rule walkthrough

### Phase 4: Social Features
- [ ] Persistent leaderboard (MongoDB or Firebase)
- [ ] Player accounts (Google/GitHub OAuth)
- [ ] Friends list
- [ ] Game history & replay
- [ ] ELO rating system

### Phase 5: Advanced
- [ ] Dark mode / theme selection
- [ ] Custom board skins
- [ ] Tournament mode (bracket-style)
- [ ] Power-ups variant (optional house rules)
- [ ] React Native mobile app
- [ ] PWA (install as app from browser)

---

## 📡 API Reference

### Socket.io Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `createRoom` | `{ playerName }` | Create a new game room |
| `joinRoom` | `{ roomCode, playerName }` | Join existing room |
| `startGame` | — | Host starts the game (needs 2+ players) |
| `rollDice` | — | Roll dice (must be your turn) |
| `moveToken` | `{ tokenId }` | Move a specific token (0-3) |
| `chatMessage` | `{ message }` | Send chat message to room |
| `rematch` | — | Restart game with same players |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `playerJoined` | `{ players, newPlayer }` | Someone joined the room |
| `playerDisconnected` | `{ playerIndex, name }` | Someone left |
| `gameStarted` | `{ gameState, players, currentTurn }` | Game begins |
| `diceRolled` | `{ value, playerIndex, validMoves }` | Dice result + moveable tokens |
| `tokenMoved` | `{ playerIndex, tokenId, move, captured, gameState }` | Token was moved |
| `extraTurn` | `{ playerIndex, reason }` | Player gets another roll |
| `turnChanged` | `{ currentTurn, gameState }` | Next player's turn |
| `gameOver` | `{ winner, winnerName, winnerColor }` | Game finished |
| `chatMessage` | `{ name, color, message, timestamp }` | Chat message |

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the game UI |
| `/health` | GET | Server health check (rooms count, uptime) |

---

## 🔧 Troubleshooting

### "Cannot find module 'express'" or similar
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 already in use
```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

Or change the port:
```bash
PORT=3001 npm start
```

### Game not loading on mobile
- Make sure you're using the **full URL** (including `https://`)
- Try clearing browser cache
- Check that your device is connected to the internet
- Try a different browser

### Players can't connect to my room
- If running locally, others can only connect if on the same network
- For internet play, you **must** deploy online (see Deploy section)
- Check that the room code is entered correctly (case insensitive)

### Server crashes on Render
- Check the Render dashboard logs for error messages
- Make sure `package.json` lists all dependencies
- Verify the start command is `npm start`

---

## 🎨 Customization

### Change Player Colors

Edit the `COLORS` object in `public/game.js`:
```javascript
const COLORS = {
  red:    { bg: '#D32F2F', light: '#EF5350', ... },
  green:  { bg: '#2E7D32', light: '#66BB6A', ... },
  // Change these to any colors you want
};
```

And the matching CSS variables in `public/styles.css`:
```css
:root {
  --red: #D32F2F;
  --green: #2E7D32;
  --blue: #1565C0;
  --yellow: #F9A825;
}
```

### Change Max Players

In `server.js`, find `maxPlayers: 4` in the room creation and change it.

### Change Port

```bash
PORT=8080 npm start
```

Or edit `server.js` directly:
```javascript
const PORT = process.env.PORT || 8080;
```

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Total code | ~2,500 lines |
| Files | 6 (+ docs) |
| Technologies | Node.js, Express, Socket.io, HTML5, CSS3, SVG |
| Dependencies | 2 (express, socket.io) |
| Board cells | 52 track + 20 home column + center |
| Safe positions | 8 |

---

## 📜 License

MIT License — free for personal and commercial use.

---

**Built with ❤️ by Raj Poddar**

**Happy Gaming! 🎲🎮**
