// Client Side Logic for Business Tour / Monopoly
const socket = io();

// Color definitions
const GROUP_COLORS = {
  BROWN: '#8B5A2B',
  CYAN: '#00BCD4',
  PINK: '#E91E63',
  ORANGE: '#FF9800',
  RED: '#F44336',
  YELLOW: '#FBC02D',
  GREEN: '#4CAF50',
  BLUE: '#2196F3',
  STATION: '#607D8B',
  SPECIAL: '#475569'
};

// Tile coordinate map for 9x9 perimeter ring (32 tiles total)
const TILE_GRID_POSITIONS = {
  0:  { row: 9, col: 1 }, // Start (Bottom-Left)
  1:  { row: 8, col: 1 },
  2:  { row: 7, col: 1 },
  3:  { row: 6, col: 1 },
  4:  { row: 5, col: 1 },
  5:  { row: 4, col: 1 },
  6:  { row: 3, col: 1 },
  7:  { row: 2, col: 1 },
  8:  { row: 1, col: 1 }, // Jail (Top-Left)
  9:  { row: 1, col: 2 },
  10: { row: 1, col: 3 },
  11: { row: 1, col: 4 },
  12: { row: 1, col: 5 },
  13: { row: 1, col: 6 },
  14: { row: 1, col: 7 },
  15: { row: 1, col: 8 },
  16: { row: 1, col: 9 }, // Resort (Top-Right)
  17: { row: 2, col: 9 },
  18: { row: 3, col: 9 },
  19: { row: 4, col: 9 },
  20: { row: 5, col: 9 },
  21: { row: 6, col: 9 },
  22: { row: 7, col: 9 },
  23: { row: 8, col: 9 },
  24: { row: 9, col: 9 }, // Go to Jail (Bottom-Right)
  25: { row: 9, col: 8 },
  26: { row: 9, col: 7 },
  27: { row: 9, col: 6 },
  28: { row: 9, col: 5 },
  29: { row: 9, col: 4 },
  30: { row: 9, col: 3 },
  31: { row: 9, col: 2 }
};

// State
let myId = null;
let currentProperties = [];
let currentPlayers = [];
let selectedColor = '#3B82F6';
let soundEnabled = true;
let isJoined = false;

// Web Audio API Sound Generator
class SoundFx {
  constructor() {
    this.ctx = null;
    this.userInteracted = false;
  }
  init() {
    if (!this.userInteracted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
  playTone(freq, type, duration, delay = 0, vol = 0.15) {
    if (!soundEnabled || !this.userInteracted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio not permitted or failed
    }
  }
  dice() {
    for (let i = 0; i < 4; i++) {
      this.playTone(200 + Math.random() * 250, 'square', 0.04, i * 0.06, 0.1);
    }
  }
  cash() {
    this.playTone(523.25, 'sine', 0.12, 0, 0.2); // C5
    this.playTone(659.25, 'sine', 0.12, 0.08, 0.2); // E5
    this.playTone(783.99, 'sine', 0.25, 0.16, 0.2); // G5
  }
  buy() {
    this.playTone(440, 'triangle', 0.1, 0, 0.2);
    this.playTone(880, 'triangle', 0.2, 0.1, 0.2);
  }
  jail() {
    this.playTone(300, 'sawtooth', 0.15, 0, 0.2);
    this.playTone(200, 'sawtooth', 0.3, 0.15, 0.2);
  }
  victory() {
    const notes = [523, 659, 783, 1046];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.3, idx * 0.12, 0.25);
    });
  }
}
const sfx = new SoundFx();

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name-input');
const btnJoin = document.getElementById('btn-join');
const btnAddBot = document.getElementById('btn-add-bot');
const btnStartGame = document.getElementById('btn-start-game');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyReadyStatus = document.getElementById('lobby-ready-status');

const boardEl = document.getElementById('board');
const btnRollDice = document.getElementById('btn-roll-dice');
const dice1El = document.getElementById('dice-1');
const dice2El = document.getElementById('dice-2');
const dice1Val = document.getElementById('dice-1-val');
const dice2Val = document.getElementById('dice-2-val');
const diceTotalEl = document.getElementById('dice-total');
const turnPlayerNameEl = document.getElementById('turn-player-name');
const turnBadgeEl = document.getElementById('turn-badge');
const turnSubtextEl = document.getElementById('turn-subtext');
const centerStatusTip = document.getElementById('center-status-tip');

const playersListEl = document.getElementById('players-list');
const sidebarTurnTag = document.getElementById('sidebar-turn-tag');
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

// Modals
const buyModal = document.getElementById('buy-modal');
const modalTileIcon = document.getElementById('modal-tile-icon');
const modalPropertyTitle = document.getElementById('modal-property-title');
const modalTileType = document.getElementById('modal-tile-type');
const modalActionSubtitle = document.getElementById('modal-action-subtitle');
const levelCardsContainer = document.getElementById('level-cards-container');
const modalRentRate = document.getElementById('modal-rent-rate');
const modalCurrentBalance = document.getElementById('modal-current-balance');
const modalAfterBalance = document.getElementById('modal-after-balance');
const btnBuyProperty = document.getElementById('btn-buy-property');
const buyButtonText = document.getElementById('buy-button-text');
const btnPassProperty = document.getElementById('btn-pass-property');

let selectedTargetLevel = null;

const winnerModal = document.getElementById('winner-modal');
const winnerTitle = document.getElementById('winner-title');
const winnerMessage = document.getElementById('winner-message');
const btnPlayAgain = document.getElementById('btn-play-again');

// Chance Card Modal Elements
const chanceCardModal = document.getElementById('chance-card-modal');
const chanceCardTitle = document.getElementById('chance-card-title');
const chanceCardIcon = document.getElementById('chance-card-icon');
const chanceCardText = document.getElementById('chance-card-text');
const chancePlayerBadge = document.getElementById('chance-player-badge');
const chanceCardEffectTag = document.getElementById('chance-card-effect-tag');
const chanceTimerBar = document.getElementById('chance-timer-bar');
const btnCloseChanceCard = document.getElementById('btn-close-chance-card');
let chanceCardTimer = null;

const btnSoundToggle = document.getElementById('btn-sound-toggle');
const soundIcon = document.getElementById('sound-icon');
const btnRestart = document.getElementById('btn-restart');

// Initialize Board Tiles in DOM
function setupBoardGrid(properties) {
  currentProperties = properties;
  // Remove existing tiles except the board-center
  const existingTiles = boardEl.querySelectorAll('.board-tile');
  existingTiles.forEach(el => el.remove());

  properties.forEach(tile => {
    const tileEl = document.createElement('div');
    tileEl.id = `tile-${tile.id}`;
    tileEl.className = 'board-tile';
    if (tile.id === 0 || tile.id === 8 || tile.id === 16 || tile.id === 24) {
      tileEl.classList.add('corner-tile');
    }

    const pos = TILE_GRID_POSITIONS[tile.id] || { row: 1, col: 1 };
    tileEl.style.gridRow = pos.row;
    tileEl.style.gridColumn = pos.col;

    const groupColor = GROUP_COLORS[tile.group] || '#475569';

    // Color bar for properties
    const colorBarHtml = tile.type === 'terreno' 
      ? `<div class="tile-color-bar" style="background-color: ${groupColor};"></div>`
      : '';

    // Price tag
    let priceHtml = '';
    if (tile.type === 'terreno') {
      priceHtml = `<span class="tile-price" id="price-tile-${tile.id}">$${tile.price}</span>`;
    } else if (tile.type === 'taxa') {
      priceHtml = `<span class="tile-price">-$${tile.rent || 100}</span>`;
    } else if (tile.type === 'inicio') {
      priceHtml = `<span class="tile-price">+$200</span>`;
    }

    tileEl.innerHTML = `
      ${colorBarHtml}
      <div class="tile-inner">
        <span class="tile-icon">${tile.icon || '📍'}</span>
        <span class="tile-name" title="${tile.name}">${tile.name}</span>
        ${priceHtml}
        <div class="tile-buildings" id="buildings-tile-${tile.id}"></div>
      </div>
      <div class="tile-pawns-container" id="pawns-tile-${tile.id}"></div>
    `;

    boardEl.appendChild(tileEl);
  });
}

// Update Board with Owners & Pawns
function renderBoardState(properties, players) {
  // Update property ownership borders, ribbons, buildings, and rent
  properties.forEach(tile => {
    const tileEl = document.getElementById(`tile-${tile.id}`);
    if (!tileEl) return;

    const existingRibbon = tileEl.querySelector('.tile-owner-ribbon');
    if (existingRibbon) existingRibbon.remove();

    const priceEl = document.getElementById(`price-tile-${tile.id}`);

    if (tile.owner) {
      const owner = players.find(p => p.id === tile.owner);
      const ownerColor = owner ? owner.color : '#3B82F6';
      const ownerInitial = owner ? owner.name.substring(0, 3).toUpperCase() : 'PRO';

      tileEl.classList.add('is-owned');
      tileEl.style.setProperty('--owner-color', ownerColor);

      const ribbon = document.createElement('div');
      ribbon.className = 'tile-owner-ribbon';
      ribbon.textContent = ownerInitial;
      tileEl.appendChild(ribbon);

      // Show current rent if owned
      if (priceEl && tile.rentValues && tile.level !== undefined) {
        priceEl.textContent = `Alug: $${tile.rentValues[tile.level]}`;
        priceEl.style.color = '#38bdf8';
      }
    } else {
      tileEl.classList.remove('is-owned');
      tileEl.style.removeProperty('--owner-color');
      if (priceEl && tile.type === 'terreno') {
        priceEl.textContent = `$${tile.price}`;
        priceEl.style.color = 'var(--accent-gold)';
      }
    }

    // Update Building Indicators (Business Tour)
    const bldContainer = document.getElementById(`buildings-tile-${tile.id}`);
    if (bldContainer) {
      bldContainer.innerHTML = '';
      const lvl = tile.level || 0;
      if (lvl === 1) {
        const land = document.createElement('span');
        land.className = 'land-pip';
        land.title = 'Terreno';
        bldContainer.appendChild(land);
      } else if (lvl >= 2 && lvl <= 4) {
        const houses = lvl - 1; // Lvl 2 = 1 house, Lvl 3 = 2 houses, Lvl 4 = 3 houses
        for (let h = 0; h < houses; h++) {
          const house = document.createElement('span');
          house.className = 'house-pip';
          house.title = `Casa ${h + 1}`;
          bldContainer.appendChild(house);
        }
      } else if (lvl === 5) {
        const hotel = document.createElement('span');
        hotel.className = 'hotel-pip';
        hotel.textContent = 'HOTEL';
        hotel.title = 'Hotel';
        bldContainer.appendChild(hotel);
      }
    }

    // Clear pawns container
    const pawnsContainer = document.getElementById(`pawns-tile-${tile.id}`);
    if (pawnsContainer) {
      pawnsContainer.innerHTML = '';
    }
  });

  // Render players as pawns on their current tile
  players.forEach(player => {
    if (player.isBankrupt) return;
    const pawnsContainer = document.getElementById(`pawns-tile-${player.position}`);
    if (pawnsContainer) {
      const pawn = document.createElement('div');
      pawn.className = 'pawn-token';
      pawn.style.setProperty('--player-color', player.color);
      pawn.textContent = player.name.charAt(0).toUpperCase();
      pawn.title = `${player.name} ($${player.money}) - Volta ${player.laps || 0}`;
      pawnsContainer.appendChild(pawn);
    }
  });
}

// Render Players in Lobby
function renderLobbyPlayers(players) {
  lobbyPlayerCount.textContent = players.length;
  lobbyPlayersList.innerHTML = '';

  if (players.length === 0) {
    lobbyPlayersList.innerHTML = `<div class="lobby-empty-hint">Nenhum jogador na sala ainda. Digite seu nome e clique em Entrar!</div>`;
    btnStartGame.disabled = true;
    lobbyReadyStatus.textContent = 'Aguardando participantes';
    return;
  }

  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    row.style.setProperty('--player-color', p.color);

    const isMe = p.socketId === myId;
    row.innerHTML = `
      <div class="player-info-meta">
        <div class="player-avatar-mini">${p.name.charAt(0).toUpperCase()}</div>
        <span class="player-name-text">${p.name} ${isMe ? '(Você)' : ''}</span>
      </div>
      <div>
        ${p.isBot ? `<span class="player-type-badge">BOT</span> <button class="btn-remove-bot" data-bot-id="${p.id}" title="Remover Bot">✕</button>` : '<span class="player-type-badge">HUMANO</span>'}
      </div>
    `;

    lobbyPlayersList.appendChild(row);
  });

  // Attach bot remove buttons
  lobbyPlayersList.querySelectorAll('.btn-remove-bot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const botId = e.currentTarget.getAttribute('data-bot-id');
      socket.emit('remove_bot', { botId });
    });
  });

  // Enable Start Game button if >= 1 player (allow testing with 1 or bots!)
  btnStartGame.disabled = players.length < 1;
  lobbyReadyStatus.textContent = players.length >= 2 ? 'Pronto para começar!' : 'Mínimo 1 jogador recomendado';
}

// Render Players List in Game Sidebar
function renderSidebarPlayers(players, currentTurnIndex) {
  playersListEl.innerHTML = '';
  const currentTurnPlayer = players[currentTurnIndex];

  players.forEach((p, idx) => {
    const isTurn = idx === currentTurnIndex;
    const isMe = p.socketId === myId;

    const ownedCount = currentProperties.filter(t => t.owner === p.id).length;

    const card = document.createElement('div');
    card.className = `player-card-item ${isTurn ? 'is-turn' : ''} ${p.isBankrupt ? 'is-bankrupt' : ''}`;
    card.style.setProperty('--player-color', p.color);

    let statusHtml = '';
    if (p.isBankrupt) {
      statusHtml = `<span class="player-status-badge status-bankrupt">FALIDO</span>`;
    } else if (p.inJail) {
      statusHtml = `<span class="player-status-badge status-jail">PRESO</span>`;
    } else if (isTurn) {
      statusHtml = `<span class="player-status-badge status-turn">JOGANDO</span>`;
    }

    card.innerHTML = `
      <div class="player-card-left">
        <div class="player-card-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-card-name-box">
          <span class="player-card-name">${p.name} ${isMe ? '★' : ''}</span>
          <span class="player-card-props-count">Propriedades: ${ownedCount} • Volta: ${p.laps || 0}</span>
        </div>
      </div>
      <div class="player-card-right">
        <span class="player-card-money">$${p.money}</span>
        ${statusHtml}
      </div>
    `;

    playersListEl.appendChild(card);
  });

  if (currentTurnPlayer) {
    sidebarTurnTag.textContent = `Turno: ${currentTurnPlayer.name}`;
  }
}

// Update Turn Indicator and Dice Button
function updateTurnDisplay(players, currentTurnIndex, diceState, pendingAction) {
  const current = players[currentTurnIndex];
  if (!current) return;

  const isMyTurn = current.socketId === myId && !current.isBankrupt;

  turnPlayerNameEl.textContent = current.name;
  turnPlayerNameEl.style.color = current.color;

  if (isMyTurn) {
    turnBadgeEl.textContent = 'SUA VEZ!';
    turnBadgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
    turnBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    turnBadgeEl.style.color = '#10B981';
    turnSubtextEl.textContent = 'Clique em Rolar Dados para mover seu peão!';
    centerStatusTip.textContent = 'É a sua vez de jogar!';
    btnRollDice.disabled = !!pendingAction;
  } else {
    turnBadgeEl.textContent = 'TURNO';
    turnBadgeEl.style.background = 'rgba(251, 191, 36, 0.15)';
    turnBadgeEl.style.borderColor = 'rgba(251, 191, 36, 0.3)';
    turnBadgeEl.style.color = 'var(--accent-gold)';
    turnSubtextEl.textContent = current.isBot ? 'Bot pensando no movimento...' : 'Aguardando jogada...';
    centerStatusTip.textContent = `Vez de ${current.name}`;
    btnRollDice.disabled = true;
  }

  // Update Dice values
  if (diceState && diceState.d1 && diceState.d2) {
    dice1Val.textContent = diceState.d1;
    dice2Val.textContent = diceState.d2;
    diceTotalEl.textContent = diceState.sum;
  }
}

// Append Chat / Event Log
function appendLog(log) {
  const entry = document.createElement('div');
  entry.className = `chat-entry type-${log.type || 'system'}`;
  entry.innerHTML = `<span class="chat-time">${log.time || ''}</span> <span class="chat-msg-body">${log.text}</span>`;
  chatMessagesEl.appendChild(entry);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  // Sound effects based on log content
  if (log.type === 'dice') sfx.dice();
  if (log.type === 'money') sfx.cash();
  if (log.type === 'jail') sfx.jail();
}

// Business Tour Purchase & Upgrade Modal Logic
function openBusinessTourModal({ tileId, tileName, tileIcon, tileGroup, currentLevel, options, playerMoney, isUpgrade }) {
  if (!buyModal) return;

  const tile = currentProperties.find(t => t.id === tileId) || { name: tileName, icon: tileIcon, group: tileGroup };
  const me = currentPlayers.find(p => p.socketId === myId);
  const money = me ? me.money : (playerMoney || 0);

  if (modalTileIcon) modalTileIcon.textContent = tile.icon || '🏛️';
  if (modalPropertyTitle) modalPropertyTitle.textContent = tile.name;
  if (modalTileType) {
    modalTileType.textContent = isUpgrade 
      ? `Evolução de Propriedade (Atual: Nível ${currentLevel})` 
      : 'Novo Terreno Disponível';
  }
  if (modalActionSubtitle) {
    modalActionSubtitle.textContent = isUpgrade 
      ? 'Selecione até qual nível deseja expandir sua propriedade:' 
      : 'Selecione o nível de compra inicial desejado:';
  }

  const banner = document.getElementById('modal-color-banner');
  if (banner) {
    const groupColor = GROUP_COLORS[tile.group] || '#1e293b';
    banner.style.borderTop = `6px solid ${groupColor}`;
  }

  if (modalCurrentBalance) {
    modalCurrentBalance.textContent = `$${money}`;
  }

  // Clear existing cards
  if (levelCardsContainer) {
    levelCardsContainer.innerHTML = '';
  }

  if (!options || options.length === 0) {
    buyModal.classList.add('hidden');
    return;
  }

  // Pick default selection: highest affordable option
  const affordableOptions = options.filter(opt => money >= opt.cost);
  const defaultSelected = affordableOptions.length > 0 
    ? affordableOptions[affordableOptions.length - 1] 
    : options[0];
  selectedTargetLevel = defaultSelected ? defaultSelected.level : null;

  options.forEach(opt => {
    const card = document.createElement('div');
    const isAffordable = money >= opt.cost;
    const isSelected = selectedTargetLevel === opt.level;

    card.className = `level-card ${isSelected ? 'selected' : ''} ${!isAffordable ? 'disabled' : ''}`;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    card.setAttribute('data-level', opt.level);

    card.innerHTML = `
      ${isSelected ? '<span class="level-card-badge">ESCOLHIDO</span>' : ''}
      <span class="level-card-icon">${opt.icon || '🏠'}</span>
      <span class="level-card-name">${opt.name}</span>
      <span class="level-card-cost">$${opt.cost}</span>
      <span class="level-card-rent-badge">Aluguel: $${opt.rent}</span>
    `;

    if (isAffordable) {
      card.addEventListener('click', () => {
        selectedTargetLevel = opt.level;
        updateModalSelection(options, money);
      });
    }

    if (levelCardsContainer) {
      levelCardsContainer.appendChild(card);
    }
  });

  updateModalSelection(options, money);
  buyModal.classList.remove('hidden');
}

function updateModalSelection(options, money) {
  const chosen = options.find(opt => opt.level === selectedTargetLevel);

  // Update visual selection across cards
  if (levelCardsContainer) {
    levelCardsContainer.querySelectorAll('.level-card').forEach(card => {
      const lvl = Number(card.getAttribute('data-level'));
      const isSel = lvl === selectedTargetLevel;
      card.classList.toggle('selected', isSel);
      card.setAttribute('aria-checked', isSel ? 'true' : 'false');
      const badge = card.querySelector('.level-card-badge');
      if (isSel && !badge) {
        const b = document.createElement('span');
        b.className = 'level-card-badge';
        b.textContent = 'ESCOLHIDO';
        card.prepend(b);
      } else if (!isSel && badge) {
        badge.remove();
      }
    });
  }

  if (chosen) {
    if (modalRentRate) modalRentRate.textContent = `Rent rate: $${chosen.rent}`;
    if (modalAfterBalance) modalAfterBalance.textContent = `$${money - chosen.cost}`;
    if (buyButtonText) buyButtonText.textContent = `BUY FOR $${chosen.cost}`;
    if (btnBuyProperty) btnBuyProperty.disabled = false;
  } else {
    if (modalRentRate) modalRentRate.textContent = 'Rent rate: $0';
    if (modalAfterBalance) modalAfterBalance.textContent = `$${money}`;
    if (buyButtonText) buyButtonText.textContent = 'SALDO INSUFICIENTE';
    if (btnBuyProperty) btnBuyProperty.disabled = true;
  }
}

// Show/Hide Buy Modal based on gameState pendingAction
function checkBuyModal(pendingAction, players) {
  if (!buyModal) return;
  if (!pendingAction || (pendingAction.type !== 'purchase' && pendingAction.type !== 'upgrade' && pendingAction.type !== 'buy_prompt')) {
    buyModal.classList.add('hidden');
    return;
  }

  const isMe = pendingAction.playerId === myId;
  if (!isMe) {
    buyModal.classList.add('hidden');
    return;
  }

  const me = players.find(p => p.socketId === myId);
  if (!me) return;

  const tile = currentProperties.find(t => t.id === pendingAction.tileId);
  if (!tile) return;

  const isUpgrade = pendingAction.type === 'upgrade';
  const options = pendingAction.options || [
    { level: 1, name: 'Terreno', icon: '🏛️', cost: tile.price, rent: tile.rent }
  ];

  openBusinessTourModal({
    tileId: tile.id,
    tileName: tile.name,
    tileIcon: tile.icon,
    tileGroup: tile.group,
    currentLevel: tile.level || 0,
    options,
    playerMoney: me.money,
    isUpgrade
  });
}

// Socket Event Handlers
socket.on('connect', () => {
  myId = socket.id;
  console.log('Conectado ao servidor:', socket.id);
});

socket.on('init_data', data => {
  myId = data.socketId || socket.id;
  if (data.properties) {
    setupBoardGrid(data.properties);
  }
  currentPlayers = data.players || [];
  
  // Render logs
  chatMessagesEl.innerHTML = '';
  if (data.chatLogs) {
    data.chatLogs.forEach(appendLog);
  }

  if (data.gameStarted) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderBoardState(data.properties, data.players);
    renderSidebarPlayers(data.players, data.currentTurnIndex);
    updateTurnDisplay(data.players, data.currentTurnIndex, data.diceState, data.pendingAction);
    checkBuyModal(data.pendingAction, data.players);
  } else {
    lobbyScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    renderLobbyPlayers(data.players);
  }
});

socket.on('game_state_update', data => {
  currentProperties = data.properties;
  currentPlayers = data.players;

  if (data.gameStarted) {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    renderBoardState(data.properties, data.players);
    renderSidebarPlayers(data.players, data.currentTurnIndex);
    updateTurnDisplay(data.players, data.currentTurnIndex, data.diceState, data.pendingAction);
    checkBuyModal(data.pendingAction, data.players);
  } else {
    lobbyScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    renderLobbyPlayers(data.players);
  }

  // Handle Winner
  if (data.winner) {
    winnerTitle.textContent = `Vitória de ${data.winner.name}! 🏆`;
    winnerMessage.textContent = `${data.winner.name} conquistou o tabuleiro e levou todos os outros à falência com saldo de $${data.winner.money}!`;
    winnerModal.classList.remove('hidden');
    sfx.victory();
  } else {
    winnerModal.classList.add('hidden');
  }
});

socket.on('new_log', log => {
  appendLog(log);
});

// Event: Chance Card Drawn ("Sorte ou Revés")
socket.on('card_drawn', ({ playerName, playerColor, card }) => {
  if (!chanceCardModal) return;

  // Set card content
  if (chanceCardTitle) chanceCardTitle.textContent = card.title || 'Sorte ou Revés';
  if (chanceCardIcon) chanceCardIcon.textContent = card.icon || '🎴';
  if (chanceCardText) chanceCardText.textContent = card.text || '';
  if (chancePlayerBadge) {
    chancePlayerBadge.textContent = playerName;
    chancePlayerBadge.style.setProperty('--player-color', playerColor || '#3b82f6');
  }

  // Set effect tag styling and text
  if (chanceCardEffectTag) {
    chanceCardEffectTag.className = 'chance-card-effect-tag';
    if (card.type === 'money') {
      if (card.value > 0) {
        chanceCardEffectTag.textContent = `+ $${card.value}`;
        chanceCardEffectTag.classList.add('effect-positive');
        sfx.cash();
      } else {
        chanceCardEffectTag.textContent = `- $${Math.abs(card.value)}`;
        chanceCardEffectTag.classList.add('effect-negative');
        sfx.jail();
      }
    } else if (card.type === 'move_to') {
      const targetTile = currentProperties.find(t => t.id === card.target);
      const targetName = targetTile ? targetTile.name : `Casa ${card.target}`;
      chanceCardEffectTag.textContent = `Destino: ${targetName}`;
      chanceCardEffectTag.classList.add(card.inJail ? 'effect-negative' : 'effect-movement');
      if (card.inJail) sfx.jail(); else sfx.buy();
    } else if (card.type === 'move_relative') {
      if (card.delta > 0) {
        chanceCardEffectTag.textContent = `Avançar +${card.delta} Casas`;
        chanceCardEffectTag.classList.add('effect-movement');
        sfx.buy();
      } else {
        chanceCardEffectTag.textContent = `Recuar ${card.delta} Casas`;
        chanceCardEffectTag.classList.add('effect-negative');
        sfx.jail();
      }
    }
  }

  // Trigger 4-second progress bar animation
  if (chanceTimerBar) {
    chanceTimerBar.classList.remove('animating');
    void chanceTimerBar.offsetWidth; // Force CSS reflow to restart animation
    chanceTimerBar.classList.add('animating');
  }

  // Show modal
  chanceCardModal.classList.remove('hidden');

  // Auto close after exactly 4 seconds
  if (chanceCardTimer) clearTimeout(chanceCardTimer);
  chanceCardTimer = setTimeout(() => {
    chanceCardModal.classList.add('hidden');
    if (chanceTimerBar) chanceTimerBar.classList.remove('animating');
  }, 4000);
});

// Event: Prompt Purchase (Business Tour Level 0)
socket.on('prompt_purchase', data => {
  if (data.playerId !== myId) return;
  openBusinessTourModal({
    ...data,
    isUpgrade: false
  });
});

// Event: Prompt Upgrade (Business Tour Level 1-4)
socket.on('prompt_upgrade', data => {
  if (data.playerId !== myId) return;
  openBusinessTourModal({
    ...data,
    isUpgrade: true
  });
});

// Close card modal button
if (btnCloseChanceCard) {
  btnCloseChanceCard.addEventListener('click', () => {
    if (chanceCardTimer) clearTimeout(chanceCardTimer);
    chanceCardModal.classList.add('hidden');
    if (chanceTimerBar) chanceTimerBar.classList.remove('animating');
  });
}

// UI Event Listeners
// Color Picker selection
document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    selectedColor = dot.getAttribute('data-color');
  });
});

// Join Lobby
btnJoin.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Jogador';
  socket.emit('join_game', { name, color: selectedColor });
  isJoined = true;
  btnJoin.textContent = '✓ Conectado';
  btnJoin.disabled = true;
  sfx.init();
});

// Add Bot
btnAddBot.addEventListener('click', () => {
  socket.emit('add_bot');
  sfx.init();
});

// Start Game
btnStartGame.addEventListener('click', () => {
  socket.emit('start_game');
  sfx.init();
});

// Roll Dice
btnRollDice.addEventListener('click', () => {
  sfx.init();
  dice1El.classList.add('rolling');
  dice2El.classList.add('rolling');
  btnRollDice.disabled = true;

  setTimeout(() => {
    dice1El.classList.remove('rolling');
    dice2El.classList.remove('rolling');
  }, 600);

  socket.emit('roll_dice');
});

// Buy Property Decisions (Business Tour Level Selection)
btnBuyProperty.addEventListener('click', () => {
  if (!selectedTargetLevel) return;
  sfx.buy();
  buyModal.classList.add('hidden');
  socket.emit('buy_property_decision', { targetLevel: selectedTargetLevel, buy: true });
});

btnPassProperty.addEventListener('click', () => {
  buyModal.classList.add('hidden');
  socket.emit('buy_property_decision', { targetLevel: null, buy: false });
});

// Chat submission
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('send_chat', { message: text });
    chatInput.value = '';
  }
});

// Sound Toggle
btnSoundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  btnSoundToggle.title = soundEnabled ? 'Som Ativado' : 'Som Desativado';
});

// Restart Game
btnRestart.addEventListener('click', () => {
  socket.emit('reset_game');
});

// Play Again button in winner modal
btnPlayAgain.addEventListener('click', () => {
  winnerModal.classList.add('hidden');
  socket.emit('reset_game');
});

// Cleanly enable audio after first user gesture
['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => {
    if (!sfx.userInteracted) {
      sfx.userInteracted = true;
      sfx.init();
    }
  }, { once: true });
});

// Autostart URL support for automated verification & quick testing
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autostart') === '1') {
    setTimeout(() => {
      playerNameInput.value = 'Magnata Alpha';
      btnJoin.click();
      setTimeout(() => {
        btnAddBot.click();
        setTimeout(() => {
          btnStartGame.click();
        }, 300);
      }, 300);
    }, 400);
  }
});
