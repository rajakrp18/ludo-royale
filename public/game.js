/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║           LUDO ROYALE — CLIENT GAME ENGINE v2             ║
 * ║   Pawn tokens • Fixed movement • Touch support            ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════
// 1. CONSTANTS
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  red:    { bg: '#D32F2F', lt: '#EF5350', dk: '#B71C1C', pa: '#FFCDD2' },
  green:  { bg: '#2E7D32', lt: '#66BB6A', dk: '#1B5E20', pa: '#C8E6C9' },
  yellow: { bg: '#F9A825', lt: '#FFEE58', dk: '#F57F17', pa: '#FFF9C4' },
  blue:   { bg: '#1565C0', lt: '#42A5F5', dk: '#0D47A1', pa: '#BBDEFB' },
};

const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const CELL = 40;
const GAP = 1;
const BOARD_PX = 15 * (CELL + GAP) + GAP;
const NS = 'http://www.w3.org/2000/svg';

/**
 * TRACK — 52 cells going clockwise. Index 0 = Red's start.
 * Each entry is [row, col] in the 15×15 grid.
 */
const TRACK = [
  [6,1],[6,2],[6,3],[6,4],[6,5],           // 0-4:   Red side →
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],      // 5-10:  Up left column
  [0,7],[0,8],                              // 11-12: Top edge →
  [1,8],[2,8],[3,8],[4,8],[5,8],            // 13-17: Down right column (Green start = 13)
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14], // 18-23: Green side →
  [7,14],[8,14],                            // 24-25: Right edge ↓
  [8,13],[8,12],[8,11],[8,10],[8,9],        // 26-30: Yellow side ← (Yellow start = 26)
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8], // 31-36: Down right column
  [14,7],[14,6],                            // 37-38: Bottom edge ←
  [13,6],[12,6],[11,6],[10,6],[9,6],        // 39-43: Up left column (Blue start = 39)
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],      // 44-49: Blue side ←
  [7,0],[6,0],                              // 50-51: Left edge ↑
];

const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const HOME_COLUMNS = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
  blue:   [[13,7],[12,7],[11,7],[10,7],[9,7]],
};

const HOME_BASE = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]],
};

function gp(row, col) {
  return [GAP + col * (CELL + GAP), GAP + row * (CELL + GAP)];
}

// ═══════════════════════════════════════════════════════════════
// 2. SVG BOARD RENDERER
// ═══════════════════════════════════════════════════════════════

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function renderBoard(svg) {
  svg.innerHTML = '';

  // Background
  svg.appendChild(el('rect', {
    x: 0, y: 0, width: BOARD_PX, height: BOARD_PX,
    fill: '#FAF6ED', rx: 6, stroke: '#B8860B', 'stroke-width': 2,
  }));

  // ─── HOME BASES ────────────────────────────────────────
  const bases = { red: [0,0], green: [0,9], blue: [9,0], yellow: [9,9] };
  for (const [color, [sr, sc]] of Object.entries(bases)) {
    const col = COLORS[color];
    const [bx, by] = gp(sr, sc);
    const sz = 6 * (CELL + GAP) - GAP;
    const ins = CELL * 0.72;

    svg.appendChild(el('rect', { x: bx, y: by, width: sz, height: sz, fill: col.bg, rx: 6 }));
    svg.appendChild(el('rect', {
      x: bx + ins, y: by + ins, width: sz - ins * 2, height: sz - ins * 2,
      fill: '#FFFFFF', rx: 8, stroke: col.dk, 'stroke-width': 1.5,
    }));

    for (const [r, c] of HOME_BASE[color]) {
      const [x, y] = gp(r, c);
      svg.appendChild(el('circle', { cx: x + CELL/2, cy: y + CELL/2, r: 13, fill: '#FFF', stroke: col.dk, 'stroke-width': 1.5 }));
      svg.appendChild(el('circle', { cx: x + CELL/2, cy: y + CELL/2, r: 8, fill: col.bg, opacity: 0.3 }));
    }
  }

  // ─── PATH CELLS ────────────────────────────────────────
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (!((r <= 5 && c >= 6 && c <= 8) || (r >= 9 && c >= 6 && c <= 8) ||
            (r >= 6 && r <= 8 && c <= 5) || (r >= 6 && r <= 8 && c >= 9))) continue;
      const [x, y] = gp(r, c);
      svg.appendChild(el('rect', {
        x, y, width: CELL, height: CELL,
        fill: '#FFFFFF', stroke: '#C5C5C5', 'stroke-width': 0.5, rx: 2,
      }));
    }
  }

  // ─── HOME COLUMNS (colored) ────────────────────────────
  for (const [color, cells] of Object.entries(HOME_COLUMNS)) {
    for (const [r, c] of cells) {
      const [x, y] = gp(r, c);
      svg.appendChild(el('rect', { x: x+2, y: y+2, width: CELL-4, height: CELL-4, fill: COLORS[color].bg, rx: 3, opacity: 0.8 }));
    }
  }

  // ─── START CELLS (colored) ─────────────────────────────
  const starts = { red: [6,1], green: [1,8], yellow: [8,13], blue: [13,6] };
  for (const [color, [r, c]] of Object.entries(starts)) {
    const [x, y] = gp(r, c);
    svg.appendChild(el('rect', { x, y, width: CELL, height: CELL, fill: COLORS[color].bg, rx: 2 }));
  }

  // ─── SAFE STARS ────────────────────────────────────────
  const safeCoords = [[6,1],[2,6],[1,8],[6,12],[8,13],[12,8],[13,6],[8,2]];
  for (const [r, c] of safeCoords) {
    const [x, y] = gp(r, c);
    const isStart = Object.values(starts).some(([sr,sc]) => sr===r && sc===c);
    const t = el('text', {
      x: x + CELL/2, y: y + CELL/2 + 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': isStart ? 18 : 16, fill: isStart ? '#FFF' : '#999', 'font-weight': 'bold',
    });
    t.textContent = '★';
    svg.appendChild(t);
  }

  // ─── CENTER (3×3 with colored triangles) ───────────────
  const [cx, cy] = gp(6, 6);
  const cs = 3 * CELL + 2 * GAP;
  const mx = cx + cs/2, my = cy + cs/2;

  svg.appendChild(el('rect', { x: cx, y: cy, width: cs, height: cs, fill: '#FFF' }));
  const tris = [
    ['red',    `${cx},${cy} ${mx},${my} ${cx},${cy+cs}`],
    ['green',  `${cx},${cy} ${mx},${my} ${cx+cs},${cy}`],
    ['yellow', `${cx+cs},${cy} ${mx},${my} ${cx+cs},${cy+cs}`],
    ['blue',   `${cx},${cy+cs} ${mx},${my} ${cx+cs},${cy+cs}`],
  ];
  for (const [color, pts] of tris) {
    svg.appendChild(el('polygon', { points: pts, fill: COLORS[color].bg, opacity: 0.88 }));
  }
  svg.appendChild(el('rect', { x: cx, y: cy, width: cs, height: cs, fill: 'none', stroke: '#777', 'stroke-width': 1.5 }));
  svg.appendChild(el('circle', { cx: mx, cy: my, r: 16, fill: '#FFF', stroke: '#888', 'stroke-width': 1.2 }));
  // HOME text in center
  const homeText = el('text', {
    x: mx, y: my + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': 8, 'font-weight': 'bold', 'font-family': 'Fredoka, sans-serif',
    fill: '#555', 'letter-spacing': 1,
  });
  homeText.textContent = 'HOME';
  svg.appendChild(homeText);

  // Entry arrows
  for (const [r, c, txt] of [[6,0,'→'],[0,8,'↓'],[8,14,'←'],[14,6,'↑']]) {
    const [x, y] = gp(r, c);
    const a = el('text', {
      x: x+CELL/2, y: y+CELL/2+1, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 13, fill: '#AAA',
    });
    a.textContent = txt;
    svg.appendChild(a);
  }

  // Token group (rendered on top)
  const tg = el('g', { id: 'tokenGroup' });
  svg.appendChild(tg);
}

// ═══════════════════════════════════════════════════════════════
// 3. PAWN TOKENS
// ═══════════════════════════════════════════════════════════════

/**
 * Draw a pawn shape at (cx, cy) — looks like a real Ludo piece:
 * round head on top, tapered body, flat base.
 */
function drawPawn(group, cx, cy, color, moveable, tokenId) {
  const col = COLORS[color];

  // Glow ring for moveable pawns
  if (moveable) {
    const glow = el('circle', { cx, cy: cy+2, r: 20, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.5, opacity: 0.8 });
    // Animate glow
    const anim1 = el('animate', { attributeName: 'r', values: '18;22;18', dur: '0.7s', repeatCount: 'indefinite' });
    const anim2 = el('animate', { attributeName: 'opacity', values: '0.9;0.3;0.9', dur: '0.7s', repeatCount: 'indefinite' });
    glow.appendChild(anim1);
    glow.appendChild(anim2);
    group.appendChild(glow);
  }

  // Shadow
  group.appendChild(el('ellipse', { cx: cx+1, cy: cy+10, rx: 11, ry: 5, fill: 'rgba(0,0,0,0.2)' }));

  // Base (wide bottom)
  group.appendChild(el('ellipse', { cx, cy: cy+6, rx: 11, ry: 5, fill: col.dk }));
  group.appendChild(el('ellipse', { cx, cy: cy+5, rx: 11, ry: 5, fill: col.bg }));

  // Body (tapered)
  group.appendChild(el('path', {
    d: `M${cx-9},${cy+4} Q${cx-7},${cy-5} ${cx-5},${cy-8} L${cx+5},${cy-8} Q${cx+7},${cy-5} ${cx+9},${cy+4} Z`,
    fill: col.bg, stroke: col.dk, 'stroke-width': 0.8,
  }));

  // Neck ring
  group.appendChild(el('ellipse', { cx, cy: cy-7, rx: 6, ry: 2.5, fill: col.dk, opacity: 0.5 }));

  // Head (round ball on top)
  group.appendChild(el('circle', { cx, cy: cy-12, r: 7, fill: col.bg, stroke: col.dk, 'stroke-width': 1 }));

  // Head shine
  group.appendChild(el('circle', { cx: cx-2, cy: cy-14, r: 2.8, fill: 'rgba(255,255,255,0.55)' }));

  // Body shine
  group.appendChild(el('path', {
    d: `M${cx-4},${cy+3} Q${cx-3},${cy-4} ${cx-2},${cy-7} L${cx},${cy-7} Q${cx-1},${cy-4} ${cx},${cy+3} Z`,
    fill: 'rgba(255,255,255,0.2)',
  }));

  // CLICK TARGET — invisible large rect covering entire pawn area
  // This is the fix for the click issue!
  const hitArea = el('rect', {
    x: cx - 16, y: cy - 22, width: 32, height: 38,
    fill: 'transparent', cursor: moveable ? 'pointer' : 'default',
    'data-token-id': tokenId, 'data-moveable': moveable ? '1' : '0',
  });
  group.appendChild(hitArea);
}

/**
 * Get pixel position of a token.
 */
function getTokenPos(color, tokenId, tokenData) {
  switch (tokenData.state) {
    case 'home': {
      const [r, c] = HOME_BASE[color][tokenId];
      const [x, y] = gp(r, c);
      return [x + CELL/2, y + CELL/2];
    }
    case 'active': {
      const [r, c] = TRACK[tokenData.trackPos];
      const [x, y] = gp(r, c);
      return [x + CELL/2, y + CELL/2];
    }
    case 'homeColumn': {
      const pos = tokenData.homeColPos;
      if (pos >= 0 && pos < HOME_COLUMNS[color].length) {
        const [r, c] = HOME_COLUMNS[color][pos];
        const [x, y] = gp(r, c);
        return [x + CELL/2, y + CELL/2];
      }
      const [cx, cy] = gp(7, 7);
      return [cx + CELL/2, cy + CELL/2];
    }
    case 'finished': {
      const offsets = { red: [-14,-14], green: [14,-14], yellow: [14,14], blue: [-14,14] };
      const [cx, cy] = gp(7, 7);
      const [ox, oy] = offsets[color];
      return [cx + CELL/2 + ox, cy + CELL/2 + oy];
    }
    default: return [0, 0];
  }
}

/**
 * Re-render all tokens on the board.
 */
function renderAllTokens() {
  const group = document.getElementById('tokenGroup');
  if (!group || !GS.tokens) return;
  group.innerHTML = '';

  const playerColors = GS.players.map(p => p.color);
  const isMyTurn = GS.currentTurn === GS.myIndex;
  const posMap = {};

  for (let pi = 0; pi < GS.tokens.length; pi++) {
    const color = playerColors[pi];
    if (!color) continue;

    for (let ti = 0; ti < GS.tokens[pi].length; ti++) {
      const tk = GS.tokens[pi][ti];
      let [cx, cy] = getTokenPos(color, ti, tk);

      // Stack offset
      const pk = `${Math.round(cx)},${Math.round(cy)}`;
      if (!posMap[pk]) posMap[pk] = 0;
      const off = posMap[pk] * 3;
      posMap[pk]++;

      const moveable = isMyTurn && pi === GS.myIndex && GS.validMoveTokens.includes(ti);

      const pawnGroup = el('g', {});
      drawPawn(pawnGroup, cx + off, cy + off, color, moveable, ti);

      // Attach click handler directly to the group
      if (moveable) {
        pawnGroup.style.cursor = 'pointer';
        // Use a closure to capture tokenId properly
        (function(tokenId) {
          pawnGroup.addEventListener('click', function(e) {
            e.stopPropagation();
            handleTokenClick(tokenId);
          });
          pawnGroup.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleTokenClick(tokenId);
          }, { passive: false });
        })(ti);
      }

      group.appendChild(pawnGroup);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. GAME STATE & SOCKET.IO
// ═══════════════════════════════════════════════════════════════

const socket = io();

const GS = {
  myIndex: -1, myColor: null, myName: '', roomCode: '', isHost: false,
  players: [], tokens: null, currentTurn: -1, diceValue: null,
  validMoveTokens: [], rolling: false,
};

// ─── Token click handler (critical fix) ────────────────
function handleTokenClick(tokenId) {
  if (!GS.validMoveTokens.includes(tokenId)) return;
  console.log('[MOVE] Token', tokenId);

  // Clear moveable state immediately for responsiveness
  GS.validMoveTokens = [];
  renderAllTokens();

  socket.emit('moveToken', { tokenId }, (res) => {
    if (!res?.success) {
      showToast(res?.error || 'Invalid move');
    }
  });
}

// ─── Socket Events ─────────────────────────────────────

socket.on('connect', () => console.log('[CONNECTED]', socket.id));
socket.on('disconnect', () => showToast('Connection lost...'));

socket.on('playerJoined', ({ players, newPlayer }) => {
  GS.players = players;
  updateLobbyPlayers(players);
  showToast(`${newPlayer} joined!`);
});

socket.on('playerDisconnected', ({ playerIndex, name }) => {
  if (GS.players[playerIndex]) GS.players[playerIndex].connected = false;
  updateGamePlayers();
  showToast(`${name} disconnected`);
});

socket.on('gameStarted', ({ gameState: gs, players, currentTurn }) => {
  GS.tokens = gs.tokens;
  GS.currentTurn = currentTurn;
  GS.players = players;
  GS.diceValue = null;
  GS.validMoveTokens = [];
  showScreen('game');
  initGameScreen();
});

socket.on('diceRolled', ({ value, playerIndex, validMoves, threeSixes }) => {
  GS.diceValue = value;

  animateDice(value, () => {
    if (threeSixes) {
      setMsg('Three 6s! Turn skipped.');
      return;
    }

    if (playerIndex === GS.myIndex) {
      GS.validMoveTokens = validMoves || [];
      if (validMoves.length === 0) {
        setMsg(`No moves available. Turn passes.`);
      } else if (validMoves.length === 1) {
        // Auto-move single option after brief delay so user sees the dice
        setTimeout(() => handleTokenClick(validMoves[0]), 400);
      } else {
        setMsg(`Rolled ${value}! Tap a glowing pawn.`);
      }
    } else {
      const name = GS.players[playerIndex]?.name || 'Player';
      setMsg(`${name} rolled ${value}`);
    }
    renderAllTokens();
  });
});

socket.on('tokenMoved', ({ playerIndex, tokenId, move, captured, gameState: gs }) => {
  GS.tokens = gs.tokens;
  GS.validMoveTokens = [];
  if (captured) {
    const capName = GS.players[captured.playerIndex]?.name || 'Player';
    showToast(`Captured ${capName}'s token!`);
  }
  renderAllTokens();
});

socket.on('extraTurn', ({ playerIndex, reason }) => {
  GS.diceValue = null;
  GS.validMoveTokens = [];
  GS.rolling = false;
  updateDice(null);

  if (playerIndex === GS.myIndex) {
    setMsg(`Bonus turn! Roll again.`);
    enableDice();
  } else {
    const name = GS.players[playerIndex]?.name || 'Player';
    setMsg(`${name} gets bonus turn!`);
  }
  renderAllTokens();
});

socket.on('turnChanged', ({ currentTurn, gameState: gs }) => {
  GS.currentTurn = currentTurn;
  GS.tokens = gs.tokens;
  GS.diceValue = null;
  GS.validMoveTokens = [];
  GS.rolling = false;

  updateGamePlayers();
  updateDice(null);
  renderAllTokens();

  if (currentTurn === GS.myIndex) {
    setMsg(`Your turn! Roll the dice.`);
    enableDice();
  } else {
    const name = GS.players[currentTurn]?.name || 'Player';
    setMsg(`${name}'s turn...`);
    disableDice();
  }
});

socket.on('gameOver', ({ winner, winnerName, winnerColor }) => {
  showScreen('winner');
  document.getElementById('winnerTitle').textContent = `${winnerName} Wins!`;
  document.getElementById('winnerTitle').style.color = COLORS[winnerColor]?.bg || '#FFD700';
  startConfetti();
});

socket.on('chatMessage', ({ name, color, message }) => {
  addChatMsg(name, color, message);
});

// ═══════════════════════════════════════════════════════════════
// 5. UI HELPERS
// ═══════════════════════════════════════════════════════════════

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(`screen-${name}`);
  if (t) { t.classList.add('active'); requestAnimationFrame(() => t.style.opacity = 1); }
}

function showError(msg) {
  const e = document.getElementById('welcomeError');
  e.textContent = msg; e.classList.remove('hidden');
  setTimeout(() => e.classList.add('hidden'), 4000);
}

function showToast(msg) {
  const e = document.getElementById('toast');
  e.textContent = msg; e.classList.remove('hidden');
  clearTimeout(e._t);
  e._t = setTimeout(() => e.classList.add('hidden'), 3000);
}

function setMsg(msg) {
  const e = document.getElementById('gameMessage');
  if (e) e.textContent = msg;
}

// ═══════════════════════════════════════════════════════════════
// 6. WELCOME SCREEN
// ═══════════════════════════════════════════════════════════════

// Particles
(function() {
  const c = document.getElementById('particles');
  if (!c) return;
  const cols = ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[Math.floor(Math.random() * cols.length)];
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    c.appendChild(p);
  }
})();

// Create Room
document.getElementById('btnCreateRoom').addEventListener('click', () => {
  const name = document.getElementById('playerName').value.trim();
  if (!name) return showError('Enter your name first.');
  GS.myName = name;
  GS.isHost = true;

  socket.emit('createRoom', { playerName: name }, (r) => {
    if (r.success) {
      GS.myIndex = r.playerIndex; GS.myColor = r.color;
      GS.roomCode = r.roomCode; GS.players = r.players;
      document.getElementById('lobbyRoomCode').textContent = r.roomCode;
      updateLobbyPlayers(r.players);
      showScreen('lobby');
      document.getElementById('btnStartGame').classList.remove('hidden');
    } else showError(r.error || 'Failed to create room.');
  });
});

// Join toggle
document.getElementById('btnShowJoin').addEventListener('click', () => {
  const s = document.getElementById('joinSection');
  s.classList.toggle('hidden');
  if (!s.classList.contains('hidden')) document.getElementById('roomCodeInput').focus();
});

// Join Room
document.getElementById('btnJoinRoom').addEventListener('click', () => {
  const name = document.getElementById('playerName').value.trim();
  const code = document.getElementById('roomCodeInput').value.trim();
  if (!name) return showError('Enter your name first.');
  if (!code || code.length < 4) return showError('Enter a valid room code.');
  GS.myName = name;

  socket.emit('joinRoom', { roomCode: code, playerName: name }, (r) => {
    if (r.success) {
      GS.myIndex = r.playerIndex; GS.myColor = r.color;
      GS.roomCode = r.roomCode; GS.players = r.players;
      document.getElementById('lobbyRoomCode').textContent = r.roomCode;
      updateLobbyPlayers(r.players);
      showScreen('lobby');
      document.getElementById('lobbyStatus').textContent = 'Waiting for host to start...';
    } else showError(r.error || 'Failed to join.');
  });
});

// Enter key
document.getElementById('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btnCreateRoom').click(); });
document.getElementById('roomCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btnJoinRoom').click(); });

// ═══════════════════════════════════════════════════════════════
// 7. LOBBY SCREEN
// ═══════════════════════════════════════════════════════════════

function updateLobbyPlayers(players) {
  const slots = document.querySelectorAll('.player-slot');
  slots.forEach((slot, i) => {
    if (players[i]) {
      slot.classList.add('joined');
      slot.querySelector('.slot-name').textContent = players[i].name;
    } else {
      slot.classList.remove('joined');
      slot.querySelector('.slot-name').textContent = 'Waiting...';
    }
  });
  const btn = document.getElementById('btnStartGame');
  if (GS.isHost) {
    btn.disabled = players.length < 2;
    document.getElementById('lobbyStatus').textContent =
      players.length >= 2 ? `${players.length} players ready!` : 'Need at least 2 players.';
  }
}

document.getElementById('btnCopyCode').addEventListener('click', () => {
  // Copy FULL SHAREABLE URL (not just the code)
  const shareUrl = `${window.location.origin}?room=${GS.roomCode}`;
  if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied! Share it with friends.'));
  else { const t = document.createElement('textarea'); t.value = shareUrl; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); showToast('Link copied!'); }
});

// NATIVE SHARE (mobile share sheet — WhatsApp, Telegram, etc.)
document.getElementById('btnShareLink').addEventListener('click', () => {
  const shareUrl = `${window.location.origin}?room=${GS.roomCode}`;
  if (navigator.share) {
    navigator.share({
      title: 'Ludo Royale — Play with me!',
      text: `Join my Ludo game! Tap the link to play: `,
      url: shareUrl,
    }).catch(() => {});
  } else {
    // Fallback: copy to clipboard
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied!'));
  }
});

document.getElementById('btnStartGame').addEventListener('click', () => {
  socket.emit('startGame', null, (r) => { if (!r.success) showToast(r.error || 'Cannot start.'); });
});

// ═══════════════════════════════════════════════════════════════
// 8. GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function initGameScreen() {
  renderBoard(document.getElementById('ludoBoard'));
  updateGamePlayers();
  renderAllTokens();

  if (GS.currentTurn === GS.myIndex) {
    setMsg('Your turn! Roll the dice.');
    enableDice();
  } else {
    const name = GS.players[GS.currentTurn]?.name || 'Player';
    setMsg(`${name}'s turn...`);
    disableDice();
  }

  // AUTO-START VOICE CHAT when game begins
  // Small delay so the game screen renders first, then mic prompt appears
  if (!voiceState.active) {
    setTimeout(() => {
      startVoice().catch(() => {
        console.log('[VOICE] Auto-start failed — user can tap 🎤 manually');
      });
    }, 1500);
  }
}

function updateGamePlayers() {
  const c = document.getElementById('gamePlayers');
  c.innerHTML = '';
  GS.players.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = `gp-item ${i === GS.currentTurn ? 'active' : ''} ${p.connected === false ? 'disconnected' : ''}`;
    const dot = document.createElement('span');
    dot.className = 'gp-dot';
    dot.style.background = COLORS[p.color]?.bg || '#888';
    const nm = document.createElement('span');
    nm.textContent = p.name + (i === GS.myIndex ? ' (You)' : '');
    d.appendChild(dot); d.appendChild(nm);
    if (i === GS.currentTurn) { const e = document.createElement('span'); e.textContent = ' 🎲'; d.appendChild(e); }
    c.appendChild(d);
  });
}

// ─── Dice ──────────────────────────────────────────────

function enableDice() { document.getElementById('btnRollDice').disabled = false; }
function disableDice() { document.getElementById('btnRollDice').disabled = true; }

function updateDice(value) {
  const svg = document.getElementById('diceSvg');
  svg.innerHTML = '';
  svg.appendChild(el('rect', { x: 1, y: 1, width: 58, height: 58, rx: 10, fill: '#FFFDF5', stroke: '#8B7355', 'stroke-width': 2 }));

  if (!value) {
    const q = el('text', { x: 30, y: 35, 'text-anchor': 'middle', 'font-size': 26, fill: '#8B7355' });
    q.textContent = '?';
    svg.appendChild(q);
    return;
  }

  const dots = { 1:[[30,30]], 2:[[18,18],[42,42]], 3:[[18,18],[30,30],[42,42]],
    4:[[18,18],[42,18],[18,42],[42,42]], 5:[[18,18],[42,18],[30,30],[18,42],[42,42]],
    6:[[18,18],[42,18],[18,30],[42,30],[18,42],[42,42]] };

  for (const [cx, cy] of (dots[value] || [])) {
    svg.appendChild(el('circle', { cx, cy, r: 5.5, fill: '#2C1810' }));
  }
}

function animateDice(finalValue, callback) {
  const box = document.getElementById('diceBox');
  box.classList.add('rolling');
  disableDice();
  GS.rolling = true;

  let c = 0;
  const iv = setInterval(() => {
    updateDice(Math.floor(Math.random() * 6) + 1);
    if (++c >= 10) {
      clearInterval(iv);
      box.classList.remove('rolling');
      GS.rolling = false;
      updateDice(finalValue);
      GS.diceValue = finalValue;
      callback?.();
    }
  }, 65);
}

// Roll dice — shared function used by both button and dice click
function triggerRoll() {
  if (GS.rolling || GS.currentTurn !== GS.myIndex) return;
  if (document.getElementById('btnRollDice').disabled) return;
  disableDice();
  socket.emit('rollDice', null, (r) => {
    if (!r?.success) { enableDice(); showToast(r?.error || 'Cannot roll.'); }
  });
}

// Click the "ROLL DICE" button
document.getElementById('btnRollDice').addEventListener('click', triggerRoll);

// Click/tap directly on the dice itself
document.getElementById('diceBox').addEventListener('click', triggerRoll);
document.getElementById('diceBox').addEventListener('touchstart', (e) => {
  e.preventDefault();
  triggerRoll();
}, { passive: false });

// ═══════════════════════════════════════════════════════════════
// 9. CHAT
// ═══════════════════════════════════════════════════════════════

document.getElementById('btnChatToggle').addEventListener('click', () => {
  document.getElementById('chatPanel').classList.toggle('hidden');
});
document.getElementById('btnCloseChat').addEventListener('click', () => {
  document.getElementById('chatPanel').classList.add('hidden');
});

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', { message: msg });
  input.value = '';
}
document.getElementById('btnSendChat').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

function addChatMsg(name, color, message) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'chat-msg';
  const n = document.createElement('span');
  n.className = 'chat-msg-name';
  n.style.color = COLORS[color]?.bg || '#888';
  n.textContent = name;
  const m = document.createElement('span');
  m.textContent = message;
  d.appendChild(n); d.appendChild(m);
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
// 10. WINNER & CONFETTI
// ═══════════════════════════════════════════════════════════════

function startConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const cols = ['#D32F2F','#2E7D32','#1565C0','#F9A825','#9C27B0','#FF6D00'];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
      c: cols[Math.floor(Math.random() * cols.length)],
      vy: Math.random() * 3 + 2, vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360, rv: (Math.random() - 0.5) * 10,
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.y += p.vy; p.x += p.vx; p.rot += p.rv;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
    }
    if (++frame < 250) requestAnimationFrame(draw);
  }
  draw();
}

document.getElementById('btnRematch').addEventListener('click', () => {
  socket.emit('rematch', null, (r) => { if (!r?.success) showToast('Failed to rematch.'); });
});
document.getElementById('btnNewGame').addEventListener('click', () => window.location.reload());

// ═══════════════════════════════════════════════════════════════
// 11. VOICE CHAT (WebRTC Peer-to-Peer Audio)
// ═══════════════════════════════════════════════════════════════
//
// HOW IT WORKS:
// ─────────────
// 1. Player clicks 🎤 → browser asks for microphone permission
// 2. Player's mic audio stream is captured
// 3. WebRTC peer connections are created with every other player
// 4. Socket.io relays the "signaling" messages (offers/answers/ICE)
// 5. Once connected, audio flows DIRECTLY between browsers (P2P)
//    — the server is NOT involved in the audio stream at all
//
// This means: low latency, no server bandwidth cost for audio,
// and it works across the internet via STUN/TURN servers.

const voiceState = {
  active: false,
  muted: false,
  localStream: null,
  peers: {},          // peerId → RTCPeerConnection
  remoteStreams: {},   // peerId → MediaStream
};

// Free public STUN + TURN servers for NAT traversal
// STUN handles most cases; TURN is the fallback for strict firewalls/mobile networks
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN relay from OpenRelay (works across mobile networks)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

/**
 * Create a peer connection with another player.
 * This sets up the WebRTC plumbing for audio exchange.
 */
function createPeerConnection(peerId, peerName) {
  if (voiceState.peers[peerId]) return voiceState.peers[peerId];

  const pc = new RTCPeerConnection(RTC_CONFIG);
  voiceState.peers[peerId] = pc;

  // Add our local audio tracks to this connection
  if (voiceState.localStream) {
    voiceState.localStream.getTracks().forEach(track => {
      pc.addTrack(track, voiceState.localStream);
    });
  }

  // When we receive audio from the remote peer
  pc.ontrack = (event) => {
    console.log(`[VOICE] Receiving audio from ${peerName}`);
    const stream = event.streams[0];
    voiceState.remoteStreams[peerId] = stream;

    // Create or reuse audio element to play remote audio
    let audioEl = document.getElementById(`audio-${peerId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio-${peerId}`;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      document.getElementById('remoteAudioContainer').appendChild(audioEl);
    }
    audioEl.srcObject = stream;

    showToast(`${peerName} connected to voice`);
  };

  // ICE candidates — network path discovery
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('iceCandidate', {
        targetId: peerId,
        candidate: event.candidate,
      });
    }
  };

  // Connection state logging
  pc.onconnectionstatechange = () => {
    console.log(`[VOICE] Connection to ${peerName}: ${pc.connectionState}`);
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      showToast(`Voice disconnected from ${peerName}`);
    }
  };

  return pc;
}

/**
 * Initiate a voice connection TO another peer (we send the offer).
 */
async function initiateVoiceConnection(peerId, peerName) {
  const pc = createPeerConnection(peerId, peerName);

  try {
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    socket.emit('voiceOffer', {
      targetId: peerId,
      offer: pc.localDescription,
    });

    console.log(`[VOICE] Sent offer to ${peerName}`);
  } catch (err) {
    console.error('[VOICE] Failed to create offer:', err);
  }
}

/**
 * Start voice chat — get mic, connect to all peers in room.
 */
async function startVoice() {
  try {
    // Request microphone access
    voiceState.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    voiceState.active = true;
    updateVoiceButton();
    showToast('Voice chat joined! 🎤');

    // Tell server we're ready for voice — server will send us list of peers
    socket.emit('voiceReady');
  } catch (err) {
    console.error('[VOICE] Microphone access denied:', err);
    if (err.name === 'NotAllowedError') {
      showToast('Microphone access denied. Check browser permissions.');
    } else if (err.name === 'NotFoundError') {
      showToast('No microphone found on this device.');
    } else {
      showToast('Could not access microphone.');
    }
  }
}

/**
 * Stop voice chat — close all connections, stop mic.
 */
function stopVoice() {
  // Close all peer connections
  for (const [peerId, pc] of Object.entries(voiceState.peers)) {
    pc.close();
    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();
  }
  voiceState.peers = {};
  voiceState.remoteStreams = {};

  // Stop local mic
  if (voiceState.localStream) {
    voiceState.localStream.getTracks().forEach(t => t.stop());
    voiceState.localStream = null;
  }

  voiceState.active = false;
  voiceState.muted = false;
  updateVoiceButton();
  showToast('Voice chat left');
}

/**
 * Toggle mute — disable/enable mic track without closing connection.
 */
function toggleMute() {
  if (!voiceState.localStream) return;
  voiceState.muted = !voiceState.muted;
  voiceState.localStream.getAudioTracks().forEach(track => {
    track.enabled = !voiceState.muted;
  });
  updateVoiceButton();
  showToast(voiceState.muted ? 'Muted 🔇' : 'Unmuted 🔊');
}

function updateVoiceButton() {
  const btn = document.getElementById('btnVoiceToggle');
  btn.classList.remove('voice-on', 'voice-muted');
  if (voiceState.active && voiceState.muted) {
    btn.classList.add('voice-muted');
    btn.textContent = '🔇';
    btn.title = 'Click to unmute';
  } else if (voiceState.active) {
    btn.classList.add('voice-on');
    btn.textContent = '🔊';
    btn.title = 'Click to mute (long-press to leave voice)';
  } else {
    btn.textContent = '🎤';
    btn.title = 'Join Voice Chat';
  }
}

// Voice button: click = join/toggle mute, long press = leave
let voicePressTimer = null;
const voiceBtn = document.getElementById('btnVoiceToggle');

voiceBtn.addEventListener('mousedown', () => {
  voicePressTimer = setTimeout(() => {
    voicePressTimer = null;
    if (voiceState.active) stopVoice();
  }, 800);
});
voiceBtn.addEventListener('mouseup', () => {
  if (voicePressTimer !== null) {
    clearTimeout(voicePressTimer);
    voicePressTimer = null;
    // Short click
    if (!voiceState.active) startVoice();
    else toggleMute();
  }
});
voiceBtn.addEventListener('mouseleave', () => {
  if (voicePressTimer !== null) { clearTimeout(voicePressTimer); voicePressTimer = null; }
});

// Touch support for mobile
voiceBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  voicePressTimer = setTimeout(() => {
    voicePressTimer = null;
    if (voiceState.active) stopVoice();
  }, 800);
}, { passive: false });
voiceBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (voicePressTimer !== null) {
    clearTimeout(voicePressTimer);
    voicePressTimer = null;
    if (!voiceState.active) startVoice();
    else toggleMute();
  }
});

// ─── WebRTC Socket Signaling Handlers ──────────────────────

// Server tells us about existing peers when we join voice
socket.on('voicePeers', ({ peers }) => {
  console.log(`[VOICE] Found ${peers.length} existing voice peers`);
  for (const peer of peers) {
    initiateVoiceConnection(peer.id, peer.name);
  }
});

// A new peer joined voice — they'll send us an offer, or we send one
socket.on('voiceNewPeer', ({ id, playerIndex, name }) => {
  console.log(`[VOICE] New peer ready: ${name}`);
  if (voiceState.active) {
    initiateVoiceConnection(id, name);
  }
});

// Received an offer — create answer and send back
socket.on('voiceOffer', async ({ fromId, fromIndex, offer }) => {
  if (!voiceState.active) return;
  const peerName = GS.players[fromIndex]?.name || 'Player';
  console.log(`[VOICE] Received offer from ${peerName}`);

  const pc = createPeerConnection(fromId, peerName);

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('voiceAnswer', {
      targetId: fromId,
      answer: pc.localDescription,
    });
  } catch (err) {
    console.error('[VOICE] Failed to handle offer:', err);
  }
});

// Received an answer to our offer
socket.on('voiceAnswer', async ({ fromId, fromIndex, answer }) => {
  const pc = voiceState.peers[fromId];
  if (!pc) return;
  const peerName = GS.players[fromIndex]?.name || 'Player';
  console.log(`[VOICE] Received answer from ${peerName}`);

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error('[VOICE] Failed to handle answer:', err);
  }
});

// Received ICE candidate
socket.on('iceCandidate', async ({ fromId, candidate }) => {
  const pc = voiceState.peers[fromId];
  if (!pc) return;

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error('[VOICE] Failed to add ICE candidate:', err);
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. INIT & AUTO-JOIN FROM URL
// ═══════════════════════════════════════════════════════════════

/**
 * AUTO-JOIN FLOW:
 * If URL contains ?room=ABC123, we skip the "Create/Join" buttons
 * and show a simplified "Enter name → Join instantly" UI.
 * The friend just taps the link → enters name → they're in.
 */
function checkAutoJoin() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');

  if (roomCode && roomCode.length >= 4) {
    console.log(`[AUTO-JOIN] Room code from URL: ${roomCode}`);

    // Hide the Create/Join buttons, show a direct join UI
    document.getElementById('btnCreateRoom').style.display = 'none';
    document.getElementById('btnShowJoin').style.display = 'none';

    // Show join section automatically with code pre-filled
    const joinSection = document.getElementById('joinSection');
    joinSection.classList.remove('hidden');
    document.getElementById('roomCodeInput').value = roomCode.toUpperCase();
    document.getElementById('roomCodeInput').readOnly = true;
    document.getElementById('roomCodeInput').style.opacity = '0.7';

    // Change the join button text
    document.getElementById('btnJoinRoom').innerHTML = '<span class="btn-icon">🎮</span> Join Game';

    // Update subtitle
    document.querySelector('.logo-subtitle').textContent = "You've been invited to play!";

    // Auto-join when they enter name and press Enter or click join
    const nameInput = document.getElementById('playerName');
    nameInput.placeholder = 'Your name to join...';
    nameInput.focus();

    // Clean URL without reloading page (remove ?room= from address bar)
    window.history.replaceState({}, '', window.location.pathname);
  }
}

window.addEventListener('load', () => {
  document.getElementById('playerName').focus();
  checkAutoJoin();
});

window.addEventListener('resize', () => {
  const c = document.getElementById('confettiCanvas');
  if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
});

console.log('🎲 LUDO ROYALE v2 — Ready!');
