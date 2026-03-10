/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║              LUDO ROYALE — MULTIPLAYER SERVER             ║
 * ║     Node.js + Express + Socket.io Game Server             ║
 * ║     Author: Raj Poddar                                    ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE:
 * ─────────────
 * Client ←→ Socket.io ←→ Server (this file)
 *
 * The server is the SINGLE SOURCE OF TRUTH for all game state.
 * Clients send actions (roll dice, move token), server validates
 * and broadcasts the updated state to all players in the room.
 *
 * ROOM LIFECYCLE:
 * ───────────────
 * 1. Player creates room → gets 6-char code
 * 2. Other players join with code
 * 3. Host starts game (min 2 players)
 * 4. Server manages turns, dice, movement, captures, wins
 * 5. Room destroyed when all players leave
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── SERVE STATIC FILES ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (useful for deployment monitoring)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: Object.keys(rooms).length,
    players: Object.keys(players).length,
    uptime: process.uptime(),
  });
});

// ─── GAME CONSTANTS ──────────────────────────────────────────

// Color order: diagonal first so 2 players sit across from each other
const PLAYER_COLORS = ['red', 'yellow', 'green', 'blue'];
const TOKENS_PER_PLAYER = 4;
const BOARD_SIZE = 52; // Total cells on the outer track
const HOME_STRETCH = 6; // 6 cells in each home column

/**
 * STARTING POSITIONS for each color on the 52-cell track.
 * These are the cells where tokens enter the board after rolling a 6.
 * The track is numbered 0-51 going clockwise.
 */
const START_POSITIONS = { red: 0, green: 13, yellow: 26, blue: 39 };

/**
 * ENTRY TO HOME COLUMN — the last track cell before a token
 * enters its home column. After this cell, tokens go into
 * positions H0-H5 (home column) instead of continuing on track.
 */
const HOME_ENTRY = { red: 50, green: 11, yellow: 24, blue: 37 };

/**
 * SAFE POSITIONS on the track where tokens CANNOT be captured.
 * Includes all 4 start positions + 4 additional safe spots.
 */
const SAFE_POSITIONS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ─── STATE STORAGE ───────────────────────────────────────────

const rooms = {};   // roomCode → room object
const players = {}; // socket.id → { roomCode, playerIndex, name }

// ─── UTILITY FUNCTIONS ───────────────────────────────────────

/** Generate a random 6-character room code (uppercase letters + digits) */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I)
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[code]); // Ensure uniqueness
  return code;
}

/** Create initial token state for a player (all tokens in home base) */
function createTokens() {
  return Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({
    id: i,
    state: 'home',     // 'home' | 'active' | 'homeColumn' | 'finished'
    trackPos: -1,       // Position on 52-cell track (0-51), -1 when not on track
    homeColPos: -1,     // Position in home column (0-5), -1 when not in home column
  }));
}

/** Calculate the effective track position for a color + steps from start */
function getTrackPosition(color, steps) {
  return (START_POSITIONS[color] + steps) % BOARD_SIZE;
}

/** Check if a move would land on a safe position */
function isSafePosition(trackPos) {
  return SAFE_POSITIONS.has(trackPos);
}

/**
 * Get all valid moves for a player given a dice value.
 * Returns array of { tokenId, type, from, to } objects.
 */
function getValidMoves(room, playerIndex, diceValue) {
  const player = room.players[playerIndex];
  if (!player) return [];
  const color = player.color;
  const tokens = room.gameState.tokens[playerIndex];
  const moves = [];

  tokens.forEach((token, idx) => {
    switch (token.state) {
      case 'home':
        // Can only leave home on a 6
        // In standard Ludo, multiple own pawns CAN stack on the start cell
        if (diceValue === 6) {
          const startPos = START_POSITIONS[color];
          moves.push({ tokenId: idx, type: 'enter', to: startPos });
        }
        break;

      case 'active': {
        // Calculate steps from player's start (0 = just entered, 50 = last track cell)
        let stepsFromStart = (token.trackPos - START_POSITIONS[color] + BOARD_SIZE) % BOARD_SIZE;
        let newSteps = stepsFromStart + diceValue;

        // Each player traverses 51 track cells (steps 0-50), then enters home column.
        // Home column has 6 positions (0-5). Max total = 50 + 6 = 56.
        const LAST_TRACK_STEP = 50;
        const MAX_STEPS = LAST_TRACK_STEP + HOME_STRETCH; // 56

        if (newSteps > MAX_STEPS) {
          // Can't move past the end of home column — no valid move
          break;
        }

        if (newSteps > LAST_TRACK_STEP) {
          // Entering home column (steps 51-56 → homePos 0-5)
          const homePos = newSteps - LAST_TRACK_STEP - 1;
          // Check if own token already in that home column position
          const blocked = tokens.some(
            (t, i) => i !== idx && t.state === 'homeColumn' && t.homeColPos === homePos
          );
          if (!blocked) {
            if (homePos === HOME_STRETCH - 1) {
              moves.push({ tokenId: idx, type: 'finish', homeColPos: homePos });
            } else {
              moves.push({ tokenId: idx, type: 'homeColumn', homeColPos: homePos });
            }
          }
        } else {
          // Normal track movement (steps 0-50)
          const newTrackPos = getTrackPosition(color, newSteps);
          // Check if own token is on destination
          const ownBlocked = tokens.some(
            (t, i) => i !== idx && t.state === 'active' && t.trackPos === newTrackPos
          );
          if (!ownBlocked) {
            moves.push({ tokenId: idx, type: 'move', to: newTrackPos });
          }
        }
        break;
      }

      case 'homeColumn': {
        // Move within home column
        const newHomePos = token.homeColPos + diceValue;
        if (newHomePos > HOME_STRETCH - 1) break; // Overshoot

        const blocked = tokens.some(
          (t, i) => i !== idx && t.state === 'homeColumn' && t.homeColPos === newHomePos
        );
        if (!blocked) {
          if (newHomePos === HOME_STRETCH - 1) {
            moves.push({ tokenId: idx, type: 'finish', homeColPos: newHomePos });
          } else {
            moves.push({ tokenId: idx, type: 'homeColumnMove', homeColPos: newHomePos });
          }
        }
        break;
      }

      case 'finished':
        // Can't move finished tokens
        break;
    }
  });

  return moves;
}

/**
 * Execute a move and return capture info if any.
 * Mutates room.gameState in place.
 */
function executeMove(room, playerIndex, tokenId, move) {
  const tokens = room.gameState.tokens[playerIndex];
  const token = tokens[tokenId];
  let captured = null;

  switch (move.type) {
    case 'enter':
      token.state = 'active';
      token.trackPos = move.to;
      // Check for capture on start position
      captured = checkCapture(room, playerIndex, move.to);
      break;

    case 'move':
      token.trackPos = move.to;
      // Check for capture
      captured = checkCapture(room, playerIndex, move.to);
      break;

    case 'homeColumn':
      token.state = 'homeColumn';
      token.trackPos = -1;
      token.homeColPos = move.homeColPos;
      break;

    case 'homeColumnMove':
      token.homeColPos = move.homeColPos;
      break;

    case 'finish':
      token.state = 'finished';
      token.trackPos = -1;
      token.homeColPos = move.homeColPos;
      break;
  }

  return captured;
}

/**
 * Check if landing on trackPos captures an opponent's token.
 * Returns { playerIndex, tokenId, color } of captured token, or null.
 */
function checkCapture(room, attackerIndex, trackPos) {
  if (isSafePosition(trackPos)) return null;

  for (let i = 0; i < room.players.length; i++) {
    if (i === attackerIndex || !room.players[i]) continue;
    const opponentTokens = room.gameState.tokens[i];
    if (!opponentTokens) continue;

    for (let t = 0; t < opponentTokens.length; t++) {
      if (opponentTokens[t].state === 'active' && opponentTokens[t].trackPos === trackPos) {
        // Send opponent token back home
        opponentTokens[t].state = 'home';
        opponentTokens[t].trackPos = -1;
        return {
          playerIndex: i,
          tokenId: t,
          color: room.players[i].color,
        };
      }
    }
  }
  return null;
}

/** Check if a player has won (all 4 tokens finished) */
function checkWin(room, playerIndex) {
  const tokens = room.gameState.tokens[playerIndex];
  return tokens && tokens.every(t => t.state === 'finished');
}

/** Advance to the next connected player's turn */
function nextTurn(room) {
  const total = room.players.length;
  let next = (room.gameState.currentTurn + 1) % total;
  let attempts = 0;

  // Skip disconnected players (but not bots)
  while (attempts < total) {
    if (room.players[next] && (room.players[next].connected || room.players[next].isBot)) {
      break;
    }
    next = (next + 1) % total;
    attempts++;
  }

  room.gameState.currentTurn = next;
  room.gameState.diceValue = null;
  room.gameState.validMoves = [];
  room.gameState.rolled = false;

  // If next player is a bot, schedule their turn
  if (room.players[next] && room.players[next].isBot) {
    scheduleBotTurn(room);
  }
}

// ═══════════════════════════════════════════════════════════════
// AI BOT ENGINE
// ═══════════════════════════════════════════════════════════════
//
// The bot runs entirely on the server. When it's a bot's turn:
// 1. Wait a realistic delay (so it doesn't feel instant)
// 2. Roll the dice
// 3. Score all valid moves using a strategy engine
// 4. Pick the best move and execute it
// 5. Handle bonus turns (6s, captures) by looping
//
// DIFFICULTY LEVELS:
// - easy:   random moves, sometimes misses good plays
// - medium: prefers captures and exits, decent strategy
// - hard:   full scoring system, plays optimally

/**
 * Score a move for AI decision-making.
 * Higher score = better move. Returns 0-100.
 */
function scoreBotMove(room, botIndex, move, diceValue, difficulty) {
  const botColor = room.players[botIndex].color;
  const tokens = room.gameState.tokens[botIndex];
  const token = tokens[move.tokenId];

  // Easy: mostly random
  if (difficulty === 'easy') {
    let score = Math.random() * 50;
    if (move.type === 'finish') score += 30;
    if (move.type === 'enter') score += 15;
    return score;
  }

  let score = 10; // base score for any valid move

  // ─── FINISH (highest priority) ─────────────────────────
  if (move.type === 'finish') {
    score += 100; // Always finish a token
  }

  // ─── CAPTURE (very high priority) ──────────────────────
  if (move.type === 'move' || move.type === 'enter') {
    const targetPos = move.to;
    if (!isSafePosition(targetPos)) {
      for (let i = 0; i < room.players.length; i++) {
        if (i === botIndex) continue;
        const oppTokens = room.gameState.tokens[i];
        if (oppTokens) {
          for (const ot of oppTokens) {
            if (ot.state === 'active' && ot.trackPos === targetPos) {
              score += 80; // Capture is great
              // Extra points if opponent token was far from their home
              const oppColor = room.players[i].color;
              const oppSteps = (ot.trackPos - START_POSITIONS[oppColor] + BOARD_SIZE) % BOARD_SIZE;
              score += Math.min(oppSteps, 20); // More points for capturing advanced tokens
            }
          }
        }
      }
    }
  }

  // ─── ENTER (get tokens on the board) ───────────────────
  if (move.type === 'enter') {
    const tokensInHome = tokens.filter(t => t.state === 'home').length;
    score += 40 + tokensInHome * 5; // Higher priority when many tokens stuck in home
  }

  // ─── MOVE TO SAFETY ────────────────────────────────────
  if (move.type === 'move' && isSafePosition(move.to)) {
    score += 25; // Landing on safe spot is good
  }

  // ─── ENTER HOME COLUMN (safe from capture) ─────────────
  if (move.type === 'homeColumn') {
    score += 60; // Getting into home column is very good
  }

  if (move.type === 'homeColumnMove') {
    score += 50 + move.homeColPos * 5; // Closer to finish = better
  }

  // ─── ADVANCE TOKENS THAT ARE CLOSER TO HOME ───────────
  if (move.type === 'move' && token.state === 'active') {
    const stepsFromStart = (token.trackPos - START_POSITIONS[botColor] + BOARD_SIZE) % BOARD_SIZE;
    score += stepsFromStart * 0.3; // Prefer advancing tokens that are further along
  }

  // ─── ESCAPE DANGER (move away from opponent's path) ────
  if (move.type === 'move' && token.state === 'active' && difficulty === 'hard') {
    // Check if current position is threatened by any opponent
    for (let i = 0; i < room.players.length; i++) {
      if (i === botIndex) continue;
      const oppTokens = room.gameState.tokens[i];
      if (!oppTokens) continue;
      for (const ot of oppTokens) {
        if (ot.state === 'active') {
          // Can they reach us in 1-6 moves?
          for (let d = 1; d <= 6; d++) {
            const oppColor = room.players[i].color;
            const oppSteps = (ot.trackPos - START_POSITIONS[oppColor] + BOARD_SIZE) % BOARD_SIZE;
            const oppNewPos = getTrackPosition(oppColor, oppSteps + d);
            if (oppNewPos === token.trackPos && !isSafePosition(token.trackPos)) {
              score += 15; // Bonus for moving a threatened token
              break;
            }
          }
        }
      }
    }
  }

  // Medium difficulty: add some randomness
  if (difficulty === 'medium') {
    score += Math.random() * 15;
  }

  return score;
}

/**
 * Execute a full bot turn: roll → pick move → execute → handle bonus turns.
 */
function playBotTurn(room) {
  if (room.status !== 'playing') return;

  const gs = room.gameState;
  const botIndex = gs.currentTurn;
  const bot = room.players[botIndex];
  if (!bot || !bot.isBot) return;

  const difficulty = bot.difficulty || 'medium';

  // ─── ROLL DICE ──────────────────────────────────────────
  // Opening rule: reduced pool [1,3,6] when all pawns in home
  const botTokens = gs.tokens[botIndex];
  const botAllHome = botTokens.every(t => t.state === 'home' || t.state === 'finished');
  const botNoActive = !botTokens.some(t => t.state === 'active' || t.state === 'homeColumn');

  const value = (botAllHome && botNoActive)
    ? [1, 3, 6][Math.floor(Math.random() * 3)]
    : (Math.floor(Math.random() * 6) + 1);
  gs.diceValue = value;
  gs.rolled = true;

  // Three consecutive sixes check
  if (value === 6) {
    gs.consecutiveSixes++;
    if (gs.consecutiveSixes >= 3) {
      gs.consecutiveSixes = 0;
      gs.validMoves = [];

      io.to(room.code).emit('diceRolled', {
        value, playerIndex: botIndex, validMoves: [], threeSixes: true,
      });

      setTimeout(() => {
        nextTurn(room);
        io.to(room.code).emit('turnChanged', {
          currentTurn: gs.currentTurn, gameState: gs,
        });
      }, 1500);
      return;
    }
  } else {
    gs.consecutiveSixes = 0;
  }

  // Get valid moves
  const validMoves = getValidMoves(room, botIndex, value);
  gs.validMoves = validMoves;

  io.to(room.code).emit('diceRolled', {
    value, playerIndex: botIndex,
    validMoves: validMoves.map(m => m.tokenId),
  });

  // ─── NO VALID MOVES → auto-skip ────────────────────────
  if (validMoves.length === 0) {
    setTimeout(() => {
      nextTurn(room);
      io.to(room.code).emit('turnChanged', {
        currentTurn: gs.currentTurn, gameState: gs,
      });
    }, 1200);
    return;
  }

  // ─── PICK BEST MOVE ────────────────────────────────────
  setTimeout(() => {
    if (room.status !== 'playing') return;

    let bestMove = validMoves[0];
    let bestScore = -1;

    for (const move of validMoves) {
      const score = scoreBotMove(room, botIndex, move, value, difficulty);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    // Execute the move
    const captured = executeMove(room, botIndex, bestMove.tokenId, bestMove);

    // Check win
    if (checkWin(room, botIndex)) {
      gs.winner = botIndex;
      room.status = 'finished';

      io.to(room.code).emit('tokenMoved', {
        playerIndex: botIndex, tokenId: bestMove.tokenId,
        move: bestMove, captured, gameState: gs,
      });
      io.to(room.code).emit('gameOver', {
        winner: botIndex, winnerName: bot.name, winnerColor: bot.color,
      });
      return;
    }

    // Broadcast move
    io.to(room.code).emit('tokenMoved', {
      playerIndex: botIndex, tokenId: bestMove.tokenId,
      move: bestMove, captured, gameState: gs,
    });

    // Handle bonus turn
    const botDidFinish = bestMove.type === 'finish';
    const gotExtraTurn = value === 6 || captured !== null || botDidFinish;
    if (gotExtraTurn) {
      gs.diceValue = null;
      gs.validMoves = [];
      gs.rolled = false;

      const reason = botDidFinish ? 'Token reached home!' : (value === 6 ? 'Rolled a 6!' : 'Captured!');
      io.to(room.code).emit('extraTurn', {
        playerIndex: botIndex,
        reason,
      });

      // Bot plays again after delay
      scheduleBotTurn(room);
    } else {
      nextTurn(room);
      io.to(room.code).emit('turnChanged', {
        currentTurn: gs.currentTurn, gameState: gs,
      });
    }
  }, 800 + Math.random() * 600); // Realistic thinking delay (0.8-1.4s)
}

/**
 * Schedule a bot turn with a human-like delay.
 */
function scheduleBotTurn(room) {
  if (room.status !== 'playing') return;
  const delay = 1000 + Math.random() * 800; // 1.0-1.8s delay before rolling
  setTimeout(() => playBotTurn(room), delay);
}

// ─── SOCKET.IO EVENT HANDLERS ────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  /**
   * CREATE ROOM
   * Client sends: { playerName }
   * Server responds: { roomCode, playerIndex, color }
   */
  socket.on('createRoom', ({ playerName }, callback) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      players: [
        { id: socket.id, name: playerName, color: PLAYER_COLORS[0], connected: true },
      ],
      gameState: null,
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      maxPlayers: 4,
      createdAt: Date.now(),
    };

    rooms[roomCode] = room;
    players[socket.id] = { roomCode, playerIndex: 0, name: playerName };
    socket.join(roomCode);

    console.log(`[ROOM CREATED] ${roomCode} by ${playerName}`);

    callback({
      success: true,
      roomCode,
      playerIndex: 0,
      color: PLAYER_COLORS[0],
      players: room.players.map(p => ({ name: p.name, color: p.color, connected: p.connected })),
    });
  });

  /**
   * CREATE BOT GAME — Play vs Computer
   * Creates a room with 1 human + 1-3 AI bots, starts immediately.
   * Client sends: { playerName, botCount (1-3), difficulty ('easy'|'medium'|'hard') }
   */
  socket.on('createBotGame', ({ playerName, botCount = 1, difficulty = 'medium' }, callback) => {
    const roomCode = generateRoomCode();
    const bots = Math.min(Math.max(botCount, 1), 3); // 1-3 bots
    const botNames = ['Captain Bot', 'Sir Ludo', 'Lady Dice', 'Duke Roll'];

    const room = {
      code: roomCode,
      host: socket.id,
      players: [
        { id: socket.id, name: playerName, color: PLAYER_COLORS[0], connected: true, isBot: false },
      ],
      gameState: null,
      status: 'waiting',
      maxPlayers: bots + 1,
      createdAt: Date.now(),
      hasBots: true,
    };

    // Add bot players
    for (let i = 0; i < bots; i++) {
      room.players.push({
        id: `bot-${roomCode}-${i}`,
        name: botNames[i] || `Bot ${i + 1}`,
        color: PLAYER_COLORS[i + 1],
        connected: true,
        isBot: true,
        difficulty: difficulty,
      });
    }

    rooms[roomCode] = room;
    players[socket.id] = { roomCode, playerIndex: 0, name: playerName };
    socket.join(roomCode);

    console.log(`[BOT GAME] ${roomCode} by ${playerName} with ${bots} bot(s) [${difficulty}]`);

    // Auto-start game immediately
    room.status = 'playing';
    room.gameState = {
      tokens: room.players.map(() => createTokens()),
      currentTurn: 0, // Human goes first
      diceValue: null,
      validMoves: [],
      rolled: false,
      consecutiveSixes: 0,
      winner: null,
    };

    const playerList = room.players.map(p => ({ name: p.name, color: p.color, isBot: p.isBot || false }));

    callback({
      success: true,
      roomCode,
      playerIndex: 0,
      color: PLAYER_COLORS[0],
      players: playerList,
    });

    // Emit game started (slight delay so client can process the callback first)
    setTimeout(() => {
      io.to(roomCode).emit('gameStarted', {
        gameState: room.gameState,
        players: playerList,
        currentTurn: 0,
      });
    }, 200);
  });

  /**
   * CREATE LOCAL GAME — Multiple players on same device (pass & play).
   * One socket controls all human players. Colors chosen by the user.
   */
  socket.on('createLocalGame', ({ playerName, colors }, callback) => {
    const roomCode = generateRoomCode();
    const colorNames = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue' };

    const room = {
      code: roomCode,
      host: socket.id,
      players: colors.map((color, i) => ({
        id: socket.id, // All controlled by same socket
        name: i === 0 ? playerName : colorNames[color],
        color: color,
        connected: true,
        isBot: false,
      })),
      gameState: null,
      status: 'waiting',
      maxPlayers: colors.length,
      createdAt: Date.now(),
      isLocalGame: true, // Flag: single socket controls all players
    };

    rooms[roomCode] = room;
    players[socket.id] = { roomCode, playerIndex: 0, name: playerName };
    socket.join(roomCode);

    console.log(`[LOCAL GAME] ${roomCode} by ${playerName} with colors ${colors.join(',')}`);

    // Auto-start
    room.status = 'playing';
    room.gameState = {
      tokens: room.players.map(() => createTokens()),
      currentTurn: 0,
      diceValue: null,
      validMoves: [],
      rolled: false,
      consecutiveSixes: 0,
      winner: null,
    };

    const playerList = room.players.map(p => ({ name: p.name, color: p.color, isBot: false }));

    callback({
      success: true,
      roomCode,
      playerIndex: 0,
      color: colors[0],
      players: playerList,
    });

    setTimeout(() => {
      io.to(roomCode).emit('gameStarted', {
        gameState: room.gameState,
        players: playerList,
        currentTurn: 0,
      });
    }, 200);
  });

  /**
   * JOIN ROOM
   * Client sends: { roomCode, playerName }
   * Server responds: { playerIndex, color, players }
   */
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      return callback({ success: false, error: 'Room not found. Check the code and try again.' });
    }
    if (room.status !== 'waiting') {
      return callback({ success: false, error: 'Game already in progress.' });
    }
    if (room.players.length >= room.maxPlayers) {
      return callback({ success: false, error: 'Room is full (max 4 players).' });
    }

    const playerIndex = room.players.length;
    room.players.push({
      id: socket.id,
      name: playerName,
      color: PLAYER_COLORS[playerIndex],
      connected: true,
    });

    players[socket.id] = { roomCode: code, playerIndex, name: playerName };
    socket.join(code);

    console.log(`[JOIN] ${playerName} joined ${code} as ${PLAYER_COLORS[playerIndex]}`);

    // Notify everyone in room
    const playerList = room.players.map(p => ({
      name: p.name, color: p.color, connected: p.connected,
    }));

    io.to(code).emit('playerJoined', { players: playerList, newPlayer: playerName });

    callback({
      success: true,
      playerIndex,
      color: PLAYER_COLORS[playerIndex],
      players: playerList,
      roomCode: code,
    });
  });

  /**
   * START GAME
   * Only the host can start. Requires at least 2 players.
   */
  socket.on('startGame', (_, callback) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return callback?.({ success: false, error: 'Not in a room.' });

    const room = rooms[playerInfo.roomCode];
    if (!room) return callback?.({ success: false, error: 'Room not found.' });
    if (room.host !== socket.id) return callback?.({ success: false, error: 'Only the host can start.' });
    if (room.players.length < 2) return callback?.({ success: false, error: 'Need at least 2 players.' });

    // Initialize game state
    room.status = 'playing';
    room.gameState = {
      tokens: room.players.map(() => createTokens()),
      currentTurn: 0,
      diceValue: null,
      validMoves: [],
      rolled: false,
      consecutiveSixes: 0,
      winner: null,
    };

    console.log(`[GAME START] ${playerInfo.roomCode} with ${room.players.length} players`);

    io.to(playerInfo.roomCode).emit('gameStarted', {
      gameState: room.gameState,
      players: room.players.map(p => ({ name: p.name, color: p.color })),
      currentTurn: 0,
    });

    callback?.({ success: true });
  });

  /**
   * ROLL DICE
   * Validates it's the player's turn, generates random 1-6,
   * computes valid moves, and broadcasts.
   */
  socket.on('rollDice', (_, callback) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return callback?.({ success: false });

    const room = rooms[playerInfo.roomCode];
    if (!room || room.status !== 'playing') return callback?.({ success: false });

    const gs = room.gameState;
    // Local game: single socket controls all players
    const activePlayer = room.isLocalGame ? gs.currentTurn : playerInfo.playerIndex;
    if (!room.isLocalGame && gs.currentTurn !== playerInfo.playerIndex) {
      return callback?.({ success: false, error: 'Not your turn.' });
    }
    if (gs.rolled) {
      return callback?.({ success: false, error: 'Already rolled this turn.' });
    }

    // Roll the dice (1-6)
    const playerTokens = gs.tokens[activePlayer];
    const allInHome = playerTokens.every(t => t.state === 'home' || t.state === 'finished');
    const noActiveTokens = !playerTokens.some(t => t.state === 'active' || t.state === 'homeColumn');

    let value;
    if (allInHome && noActiveTokens) {
      const openingPool = [1, 3, 6];
      value = openingPool[Math.floor(Math.random() * openingPool.length)];
    } else {
      value = Math.floor(Math.random() * 6) + 1;
    }
    gs.diceValue = value;
    gs.rolled = true;

    // Track consecutive sixes (3 sixes = lose turn)
    if (value === 6) {
      gs.consecutiveSixes++;
      if (gs.consecutiveSixes >= 3) {
        gs.consecutiveSixes = 0;
        gs.validMoves = [];
        io.to(playerInfo.roomCode).emit('diceRolled', {
          value,
          playerIndex: activePlayer,
          validMoves: [],
          threeSixes: true,
        });
        // Skip turn
        setTimeout(() => {
          nextTurn(room);
          io.to(playerInfo.roomCode).emit('turnChanged', {
            currentTurn: gs.currentTurn,
            gameState: gs,
          });
        }, 1500);
        return callback?.({ success: true, value, validMoves: [], threeSixes: true });
      }
    } else {
      gs.consecutiveSixes = 0;
    }

    // Compute valid moves
    const validMoves = getValidMoves(room, activePlayer, value);
    gs.validMoves = validMoves;

    io.to(playerInfo.roomCode).emit('diceRolled', {
      value,
      playerIndex: activePlayer,
      validMoves: validMoves.map(m => m.tokenId),
    });

    // If no valid moves, auto-advance turn after brief delay
    if (validMoves.length === 0) {
      setTimeout(() => {
        nextTurn(room);
        io.to(playerInfo.roomCode).emit('turnChanged', {
          currentTurn: gs.currentTurn,
          gameState: gs,
        });
      }, 1200);
    }

    callback?.({ success: true, value, validMoves: validMoves.map(m => m.tokenId) });
  });

  /**
   * MOVE TOKEN
   * Client sends which token to move. Server validates and executes.
   */
  socket.on('moveToken', ({ tokenId }, callback) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return callback?.({ success: false });

    const room = rooms[playerInfo.roomCode];
    if (!room || room.status !== 'playing') return callback?.({ success: false });

    const gs = room.gameState;
    const activePlayer = room.isLocalGame ? gs.currentTurn : playerInfo.playerIndex;
    if (!room.isLocalGame && gs.currentTurn !== playerInfo.playerIndex) {
      return callback?.({ success: false, error: 'Not your turn.' });
    }

    // Find the valid move for this token
    const move = gs.validMoves.find(m => m.tokenId === tokenId);
    if (!move) {
      return callback?.({ success: false, error: 'Invalid move.' });
    }

    // Execute the move
    const captured = executeMove(room, activePlayer, tokenId, move);

    // Check for win
    if (checkWin(room, activePlayer)) {
      gs.winner = activePlayer;
      room.status = 'finished';

      io.to(playerInfo.roomCode).emit('tokenMoved', {
        playerIndex: activePlayer, tokenId, move, captured, gameState: gs,
      });

      io.to(playerInfo.roomCode).emit('gameOver', {
        winner: activePlayer,
        winnerName: room.players[activePlayer].name,
        winnerColor: room.players[activePlayer].color,
      });

      return callback?.({ success: true });
    }

    // Broadcast the move
    io.to(playerInfo.roomCode).emit('tokenMoved', {
      playerIndex: activePlayer, tokenId, move, captured, gameState: gs,
    });

    // Determine next action
    const rolledValue = gs.diceValue;
    const didFinish = move.type === 'finish';
    const gotExtraTurn = rolledValue === 6 || captured !== null || didFinish;

    if (gotExtraTurn) {
      gs.diceValue = null;
      gs.validMoves = [];
      gs.rolled = false;

      const reason = didFinish ? 'Token reached home!' : (rolledValue === 6 ? 'Rolled a 6!' : 'Captured opponent!');
      io.to(playerInfo.roomCode).emit('extraTurn', {
        playerIndex: activePlayer, reason,
      });
    } else {
      nextTurn(room);
      io.to(playerInfo.roomCode).emit('turnChanged', {
        currentTurn: gs.currentTurn, gameState: gs,
      });
    }

    callback?.({ success: true });
  });

  /**
   * CHAT MESSAGE
   * Simple in-game chat between players in the same room.
   */
  socket.on('chatMessage', ({ message }) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return;

    const room = rooms[playerInfo.roomCode];
    if (!room) return;

    const sanitized = message.slice(0, 200).replace(/[<>]/g, '');
    io.to(playerInfo.roomCode).emit('chatMessage', {
      playerIndex: playerInfo.playerIndex,
      name: playerInfo.name,
      color: room.players[playerInfo.playerIndex]?.color,
      message: sanitized,
      timestamp: Date.now(),
    });
  });

  /**
   * REMATCH — host can restart with same players
   */
  socket.on('rematch', (_, callback) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return callback?.({ success: false });

    const room = rooms[playerInfo.roomCode];
    if (!room) return callback?.({ success: false });

    room.status = 'playing';
    room.gameState = {
      tokens: room.players.map(() => createTokens()),
      currentTurn: 0,
      diceValue: null,
      validMoves: [],
      rolled: false,
      consecutiveSixes: 0,
      winner: null,
    };

    io.to(playerInfo.roomCode).emit('gameStarted', {
      gameState: room.gameState,
      players: room.players.map(p => ({ name: p.name, color: p.color })),
      currentTurn: 0,
    });

    callback?.({ success: true });
  });

  /**
   * REJOIN ROOM — Reconnect after accidental disconnect/page refresh.
   * Client sends { roomCode, playerName } and gets back into the same slot.
   */
  socket.on('rejoinRoom', ({ roomCode, playerName }, callback) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      return callback({ success: false, error: 'Room no longer exists.' });
    }

    // Find the disconnected player slot matching this name
    const slotIndex = room.players.findIndex(
      p => p.name === playerName && !p.connected && !p.isBot
    );

    if (slotIndex === -1) {
      return callback({ success: false, error: 'No matching slot found. Game may have ended.' });
    }

    // Reconnect the player
    const slot = room.players[slotIndex];
    slot.id = socket.id;
    slot.connected = true;

    // Cancel room destruction timer
    if (room._destroyTimer) {
      clearTimeout(room._destroyTimer);
      room._destroyTimer = null;
    }

    players[socket.id] = { roomCode: code, playerIndex: slotIndex, name: playerName };
    socket.join(code);

    console.log(`[REJOIN] ${playerName} rejoined ${code} as ${slot.color}`);

    // Notify everyone
    io.to(code).emit('playerJoined', {
      players: room.players.map(p => ({ name: p.name, color: p.color, connected: p.connected })),
      newPlayer: playerName + ' (reconnected)',
    });

    // Send full game state to the rejoining player
    callback({
      success: true,
      playerIndex: slotIndex,
      color: slot.color,
      roomCode: code,
      players: room.players.map(p => ({ name: p.name, color: p.color, isBot: p.isBot || false })),
      gameState: room.gameState,
      status: room.status,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // WEBRTC SIGNALING — Voice Chat
  // The server relays WebRTC offers/answers/ICE candidates
  // between peers. Actual audio goes peer-to-peer (not through server).
  // ═══════════════════════════════════════════════════════════

  /**
   * VOICE OFFER — Player A wants to connect audio with Player B.
   * Relay the SDP offer to the target player.
   */
  socket.on('voiceOffer', ({ targetId, offer }) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return;
    io.to(targetId).emit('voiceOffer', {
      fromId: socket.id,
      fromIndex: playerInfo.playerIndex,
      offer,
    });
  });

  /**
   * VOICE ANSWER — Player B responds to A's offer.
   * Relay the SDP answer back.
   */
  socket.on('voiceAnswer', ({ targetId, answer }) => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return;
    io.to(targetId).emit('voiceAnswer', {
      fromId: socket.id,
      fromIndex: playerInfo.playerIndex,
      answer,
    });
  });

  /**
   * ICE CANDIDATE — Exchange network path info for NAT traversal.
   * Both peers send these to establish the best connection route.
   */
  socket.on('iceCandidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('iceCandidate', {
      fromId: socket.id,
      candidate,
    });
  });

  /**
   * VOICE READY — Player announces they want voice chat.
   * Broadcast to all other players in the room so they can initiate connections.
   */
  socket.on('voiceReady', () => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return;
    const room = rooms[playerInfo.roomCode];
    if (!room) return;

    // Tell this player about all other connected players' socket IDs
    // so they can initiate WebRTC connections
    const otherPlayers = room.players
      .filter(p => p.id !== socket.id && p.connected)
      .map(p => ({ id: p.id, playerIndex: room.players.indexOf(p), name: p.name }));

    socket.emit('voicePeers', { peers: otherPlayers });

    // Tell other players that this player is ready for voice
    socket.to(playerInfo.roomCode).emit('voiceNewPeer', {
      id: socket.id,
      playerIndex: playerInfo.playerIndex,
      name: playerInfo.name,
    });
  });

  /**
   * DISCONNECT
   * Handle player leaving (mark as disconnected, don't destroy room immediately)
   */
  socket.on('disconnect', () => {
    const playerInfo = players[socket.id];
    if (!playerInfo) return;

    const room = rooms[playerInfo.roomCode];
    if (room) {
      const player = room.players[playerInfo.playerIndex];
      if (player) {
        player.connected = false;
        console.log(`[DISCONNECT] ${playerInfo.name} from ${playerInfo.roomCode}`);

        io.to(playerInfo.roomCode).emit('playerDisconnected', {
          playerIndex: playerInfo.playerIndex,
          name: playerInfo.name,
        });

        // If it was this player's turn, skip to next
        if (room.gameState && room.gameState.currentTurn === playerInfo.playerIndex) {
          nextTurn(room);
          io.to(playerInfo.roomCode).emit('turnChanged', {
            currentTurn: room.gameState.currentTurn,
            gameState: room.gameState,
          });
        }

        // Check if all HUMAN players disconnected
        const allHumansDisconnected = room.players
          .filter(p => !p.isBot)
          .every(p => !p.connected);
        if (allHumansDisconnected) {
          // Keep room alive for 5 minutes for reconnection
          console.log(`[ROOM IDLE] ${playerInfo.roomCode} — all humans left, keeping for 5 min`);
          if (room._destroyTimer) clearTimeout(room._destroyTimer);
          room._destroyTimer = setTimeout(() => {
            if (rooms[playerInfo.roomCode]) {
              console.log(`[ROOM DESTROYED] ${playerInfo.roomCode} (timeout)`);
              delete rooms[playerInfo.roomCode];
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      }
    }

    delete players[socket.id];
  });
});

// ─── START SERVER ────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║         🎲  LUDO ROYALE SERVER  🎲            ║
║                                               ║
║   Running on: http://localhost:${PORT}          ║
║   Status:     READY                           ║
║                                               ║
║   Share this with friends to play!            ║
╚═══════════════════════════════════════════════╝
  `);
});
