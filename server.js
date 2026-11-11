import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createInitialBoard,
  rollDice,
  calculateNewPosition,
  isGoToJail,
  processRentPayment,
  resetPlayerProperties,
  getNextPlayerIndex,
  createInitialChanceDeck,
  shuffleDeck,
  drawChanceCard,
  applyCardEffect,
  calculateUpgradeCost,
  getPurchaseOptions,
  canUpgradeProperty,
  LEVEL_NAMES,
  LEVEL_ICONS,
  START_MONEY,
  PASS_GO_BONUS,
  JAIL_POSITION
} from './src/gameRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Game State
const gameState = {
  players: [], // { id, socketId, name, color, position, money, inJail, isBankrupt, isBot }
  properties: createInitialBoard(),
  chanceCards: shuffleDeck(createInitialChanceDeck()),
  gameStarted: false,
  currentTurnIndex: 0,
  diceState: { d1: 1, d2: 1, sum: 2, isDouble: false },
  pendingAction: null, // { type: 'buy_prompt', tileId, playerId, price, isDouble }
  chatLogs: [],
  winner: null
};

function addLog(text, type = 'system') {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { id: Date.now() + Math.random(), text, time, type };
  gameState.chatLogs.push(entry);
  if (gameState.chatLogs.length > 80) {
    gameState.chatLogs.shift();
  }
  io.emit('new_log', entry);
}

function broadcastState() {
  io.emit('game_state_update', {
    players: gameState.players,
    properties: gameState.properties,
    gameStarted: gameState.gameStarted,
    currentTurnIndex: gameState.currentTurnIndex,
    diceState: gameState.diceState,
    pendingAction: gameState.pendingAction,
    winner: gameState.winner
  });
}

function checkGameOver() {
  const activePlayers = gameState.players.filter(p => !p.isBankrupt);
  if (gameState.gameStarted && activePlayers.length === 1 && gameState.players.length > 1) {
    gameState.winner = activePlayers[0];
    addLog(`🏆 FIM DE JOGO! ${activePlayers[0].name} venceu a partida e conquistou o monopólio!`, 'system');
    broadcastState();
    return true;
  }
  return false;
}

function advanceTurn(isDouble = false) {
  if (checkGameOver()) return;

  const prevIndex = gameState.currentTurnIndex;
  const nextIndex = getNextPlayerIndex(gameState.players, prevIndex, isDouble);
  gameState.currentTurnIndex = nextIndex;
  gameState.pendingAction = null;

  const currentTurnPlayer = gameState.players[nextIndex];
  if (currentTurnPlayer) {
    if (isDouble && prevIndex === nextIndex) {
      addLog(`🎲 Dados iguais! ${currentTurnPlayer.name} joga novamente!`, 'dice');
    } else {
      addLog(`👉 É a vez de ${currentTurnPlayer.name}.`, 'system');
    }
  }

  broadcastState();

  // If next player is bot, trigger bot logic
  if (currentTurnPlayer && currentTurnPlayer.isBot && !currentTurnPlayer.isBankrupt && gameState.gameStarted) {
    setTimeout(() => {
      handleBotTurn(currentTurnPlayer);
    }, 1500);
  }
}

function handleTileLanding(player, tile, isDouble) {
  addLog(`📍 ${player.name} parou em ${tile.name} (${tile.icon || ''}).`, 'system');

  // Case 1: Vá para a Prisão (Tile 24)
  if (isGoToJail(tile.id)) {
    addLog(`🚨 ${player.name} foi enviado diretamente para a Prisão! Perde a vez!`, 'jail');
    player.position = JAIL_POSITION;
    player.inJail = true;
    broadcastState();
    setTimeout(() => advanceTurn(false), 1200);
    return;
  }

  // Case 2: Terreno
  if (tile.type === 'terreno') {
    // If unowned
    if (!tile.owner || tile.level === 0) {
      const options = getPurchaseOptions(tile, player.laps || 0);
      const minCost = options[0]?.cost || tile.price;

      if (player.money >= minCost && options.length > 0) {
        gameState.pendingAction = {
          type: 'purchase',
          tileId: tile.id,
          playerId: player.id,
          tileName: tile.name,
          tileIcon: tile.icon,
          tileGroup: tile.group,
          currentLevel: 0,
          options,
          isDouble
        };
        broadcastState();
        io.emit('prompt_purchase', {
          tileId: tile.id,
          playerId: player.id,
          tileName: tile.name,
          tileIcon: tile.icon,
          tileGroup: tile.group,
          currentLevel: 0,
          options,
          playerMoney: player.money
        });

        if (player.isBot) {
          setTimeout(() => {
            const affordable = options.filter(opt => player.money >= opt.cost + 100);
            const chosen = affordable.length > 0 ? affordable[affordable.length - 1].level : (player.money >= options[0].cost ? options[0].level : null);
            executePurchase(player.id, tile.id, chosen, isDouble);
          }, 1200);
        }
        return;
      } else {
        addLog(`💰 ${player.name} não tem dinheiro suficiente ($${player.money}) para comprar ${tile.name} (mínimo $${minCost}).`, 'system');
        setTimeout(() => advanceTurn(isDouble), 1200);
        return;
      }
    } else if (tile.owner === player.id) {
      // Landing on own property: upgrade if level < 5
      if (tile.level < 5) {
        const options = getPurchaseOptions(tile, player.laps || 0);
        if (options.length === 0) {
          addLog(`🏠 ${player.name} visitou sua propriedade ${tile.name} (${LEVEL_NAMES[tile.level]}). Limite da primeira volta atingido.`, 'system');
          setTimeout(() => advanceTurn(isDouble), 1200);
          return;
        }

        const minCost = options[0]?.cost || 999999;
        if (player.money < minCost) {
          addLog(`🏠 ${player.name} visitou sua propriedade ${tile.name}, mas não possui saldo para evoluir para ${options[0].name} (custo: $${minCost}).`, 'system');
          setTimeout(() => advanceTurn(isDouble), 1200);
          return;
        }

        gameState.pendingAction = {
          type: 'upgrade',
          tileId: tile.id,
          playerId: player.id,
          tileName: tile.name,
          tileIcon: tile.icon,
          tileGroup: tile.group,
          currentLevel: tile.level,
          options,
          isDouble
        };
        broadcastState();
        io.emit('prompt_upgrade', {
          tileId: tile.id,
          playerId: player.id,
          tileName: tile.name,
          tileIcon: tile.icon,
          tileGroup: tile.group,
          currentLevel: tile.level,
          options,
          playerMoney: player.money
        });

        if (player.isBot) {
          setTimeout(() => {
            const affordable = options.filter(opt => player.money >= opt.cost + 100);
            const chosen = affordable.length > 0 ? affordable[affordable.length - 1].level : null;
            executePurchase(player.id, tile.id, chosen, isDouble);
          }, 1200);
        }
        return;
      } else {
        addLog(`🏨 ${player.name} visitou seu Hotel em ${tile.name}! Propriedade já no nível máximo.`, 'system');
        setTimeout(() => advanceTurn(isDouble), 1200);
        return;
      }
    } else {
      // Owned by another player: pay rent based on tile.level!
      const owner = gameState.players.find(p => p.id === tile.owner);
      const ownerName = owner ? owner.name : 'Outro jogador';
      const currentLevel = tile.level || 1;
      const rent = (tile.rentValues && tile.rentValues[currentLevel] !== undefined)
        ? tile.rentValues[currentLevel]
        : (tile.rent || 50);

      const payment = processRentPayment(player, owner, rent);
      if (payment.bankrupt) {
        addLog(`💥 FALÊNCIA! ${player.name} não pôde pagar o aluguel de $${rent} (${LEVEL_NAMES[currentLevel] || ''}) para ${ownerName} e faliu!`, 'money');
        gameState.properties = resetPlayerProperties(gameState.properties, player.id);
        broadcastState();
        if (!checkGameOver()) {
          setTimeout(() => advanceTurn(false), 1500);
        }
        return;
      } else {
        addLog(`💸 ${player.name} pagou $${rent} de aluguel (${LEVEL_NAMES[currentLevel] || 'Nível ' + currentLevel}) para ${ownerName} por parar em ${tile.name}.`, 'money');
        broadcastState();
        setTimeout(() => advanceTurn(isDouble), 1500);
        return;
      }
    }
  }

  // Case 3: Taxa / Imposto
  if (tile.type === 'taxa') {
    const tax = tile.rent || 100;
    if (player.money < tax) {
      addLog(`💥 FALÊNCIA! ${player.name} não pôde pagar a taxa de $${tax} ao banco e faliu!`, 'money');
      player.money = 0;
      player.isBankrupt = true;
      gameState.properties = resetPlayerProperties(gameState.properties, player.id);
      broadcastState();
      if (!checkGameOver()) {
        setTimeout(() => advanceTurn(false), 1500);
      }
      return;
    } else {
      player.money -= tax;
      addLog(`💸 ${player.name} pagou uma taxa governamental de $${tax}.`, 'money');
      broadcastState();
      setTimeout(() => advanceTurn(isDouble), 1200);
      return;
    }
  }

  // Case 4: Sorte ou Revés / Cofre (type: 'sorte' or 'chance')
  if (tile.type === 'sorte' || tile.type === 'chance') {
    const card = drawChanceCard(gameState.chanceCards);
    if (!card) {
      setTimeout(() => advanceTurn(isDouble), 1200);
      return;
    }

    const effectResult = applyCardEffect(card, player);

    // Broadcast card_drawn event to all clients
    io.emit('card_drawn', {
      playerName: player.name,
      playerColor: player.color,
      card: {
        id: card.id,
        title: card.title,
        text: card.text,
        type: card.type,
        value: card.value,
        delta: card.delta,
        target: card.target,
        icon: card.icon
      }
    });

    addLog(`🎴 Sorte ou Revés: ${player.name} tirou "${card.title}" — ${card.text}`, 'money');

    if (effectResult.passedGo) {
      player.laps = (player.laps || 0) + 1;
      addLog(`🎉 ${player.name} completou a volta ${player.laps} (passou pelo INÍCIO) e recebeu +$${PASS_GO_BONUS}!`, 'money');
    }

    if (effectResult.isBankrupt) {
      addLog(`💥 FALÊNCIA! ${player.name} não suportou os custos da carta e faliu!`, 'money');
      gameState.properties = resetPlayerProperties(gameState.properties, player.id);
      broadcastState();
      if (!checkGameOver()) {
        setTimeout(() => advanceTurn(false), 2000);
      }
      return;
    }

    broadcastState();

    // If the card moved the player, re-trigger landing logic on the new tile!
    if (effectResult.moved) {
      const newLandedTile = gameState.properties[player.position];
      addLog(`✈️ Efeito da carta moveu ${player.name} para ${newLandedTile.name} (Casa ${newLandedTile.id}).`, 'system');
      setTimeout(() => {
        handleTileLanding(player, newLandedTile, isDouble);
      }, 2200);
      return;
    }

    // Money or non-movement card: advance turn after brief modal contemplation
    setTimeout(() => advanceTurn(isDouble), 2200);
    return;
  }

  // Case 5: Início, Prisão (visitante), Resort
  if (tile.type === 'inicio') {
    addLog(`🏁 ${player.name} parou exatamente na casa de Início!`, 'system');
  } else if (tile.type === 'prisao') {
    addLog(`👀 ${player.name} está apenas visitando a prisão.`, 'system');
  } else if (tile.type === 'parada') {
    addLog(`🏖️ ${player.name} está descansando no Resort / Parada Livre!`, 'system');
  }

  setTimeout(() => advanceTurn(isDouble), 1200);
}

function executePurchase(playerId, tileId, targetLevel, isDouble) {
  const player = gameState.players.find(p => p.id === playerId);
  const tile = gameState.properties.find(t => t.id === tileId);

  if (!player || !tile) return;

  if (targetLevel) {
    const targetLvl = Number(targetLevel);
    const check = canUpgradeProperty(tile, player, targetLvl);

    if (check.allowed) {
      player.money -= check.cost;
      const isFirstPurchase = !tile.owner;
      tile.owner = player.id;
      tile.level = targetLvl;
      const newRent = tile.rentValues[targetLvl];
      const lvlName = LEVEL_NAMES[targetLvl] || `Nível ${targetLvl}`;
      const actionVerb = isFirstPurchase ? 'adquiriu' : 'evoluiu';
      addLog(`🏢 ${player.name} ${actionVerb} ${tile.name} para ${lvlName} por $${check.cost}! Novo aluguel: $${newRent}.`, 'money');
    } else {
      addLog(`⚠️ ${player.name} não pôde construir em ${tile.name}: ${check.reason || 'Saldo insuficiente'}.`, 'system');
    }
  } else {
    addLog(`⏭️ ${player.name} decidiu passar e não comprar/evoluir ${tile.name}.`, 'system');
  }

  gameState.pendingAction = null;
  broadcastState();
  setTimeout(() => advanceTurn(isDouble), 1000);
}

function handleBotTurn(botPlayer) {
  if (!gameState.gameStarted || botPlayer.isBankrupt) return;
  const current = gameState.players[gameState.currentTurnIndex];
  if (!current || current.id !== botPlayer.id) return;

  performDiceRoll(botPlayer);
}

function performDiceRoll(player) {
  if (gameState.pendingAction) return;

  const dice = rollDice();
  gameState.diceState = dice;

  const oldPos = player.position;
  const { newPosition, passedGo } = calculateNewPosition(oldPos, dice.sum);

  addLog(`🎲 ${player.name} rolou [${dice.d1}] e [${dice.d2}] (Total: ${dice.sum})${dice.isDouble ? ' — DADOS IGUAIS!' : ''}`, 'dice');

  // Passing Go rule or landing on tile 0 increments laps
  if (passedGo || newPosition === 0) {
    player.laps = (player.laps || 0) + 1;
    player.money += PASS_GO_BONUS;
    addLog(`🎉 ${player.name} completou a volta ${player.laps} (passou pelo INÍCIO) e recebeu +$${PASS_GO_BONUS}!`, 'money');
  }

  player.position = newPosition;
  const landedTile = gameState.properties[newPosition];

  broadcastState();

  setTimeout(() => {
    handleTileLanding(player, landedTile, dice.isDouble);
  }, 900);
}

// Socket.IO Events
io.on('connection', socket => {
  // Send current state and full tile board on connection
  socket.emit('init_data', {
    socketId: socket.id,
    players: gameState.players,
    properties: gameState.properties,
    gameStarted: gameState.gameStarted,
    currentTurnIndex: gameState.currentTurnIndex,
    diceState: gameState.diceState,
    pendingAction: gameState.pendingAction,
    chatLogs: gameState.chatLogs,
    winner: gameState.winner
  });

  // Player joins lobby
  socket.on('join_game', ({ name, color }) => {
    const existing = gameState.players.find(p => p.socketId === socket.id);
    if (existing) {
      existing.name = name || 'Jogador';
      existing.color = color || '#3B82F6';
    } else {
      const newPlayer = {
        id: socket.id,
        socketId: socket.id,
        name: (name || 'Jogador').trim() || `Jogador ${gameState.players.length + 1}`,
        color: color || '#3B82F6',
        position: 0,
        money: START_MONEY,
        laps: 0,
        inJail: false,
        isBankrupt: false,
        isBot: false
      };
      gameState.players.push(newPlayer);
      addLog(`👋 ${newPlayer.name} entrou no jogo.`, 'system');
    }
    broadcastState();
  });

  // Add Bot
  socket.on('add_bot', () => {
    const botColors = ['#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];
    const botNames = ['Bot Neo', 'Bot Stark', 'Bot Wayne', 'Bot Ada', 'Bot Turing'];
    const botCount = gameState.players.filter(p => p.isBot).length;
    const name = botNames[botCount % botNames.length] || `Bot ${botCount + 1}`;
    const color = botColors[gameState.players.length % botColors.length];

    const bot = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      socketId: null,
      name,
      color,
      position: 0,
      money: START_MONEY,
      laps: 0,
      inJail: false,
      isBankrupt: false,
      isBot: true
    };
    gameState.players.push(bot);
    addLog(`🤖 ${bot.name} foi adicionado à partida.`, 'system');
    broadcastState();
  });

  // Remove Bot
  socket.on('remove_bot', ({ botId }) => {
    const idx = gameState.players.findIndex(p => p.id === botId && p.isBot);
    if (idx !== -1) {
      const [removed] = gameState.players.splice(idx, 1);
      addLog(`🤖 ${removed.name} foi removido.`, 'system');
      broadcastState();
    }
  });

  // Start Game
  socket.on('start_game', () => {
    if (gameState.players.length < 1) return;
    gameState.gameStarted = true;
    gameState.winner = null;
    gameState.currentTurnIndex = 0;
    addLog(`🚀 O JOGO COMEÇOU! Todos iniciam com $${START_MONEY}. Boa sorte a todos!`, 'system');
    broadcastState();

    const first = gameState.players[0];
    if (first && first.isBot) {
      setTimeout(() => handleBotTurn(first), 1500);
    }
  });

  // Roll Dice requested by client
  socket.on('roll_dice', () => {
    if (!gameState.gameStarted || gameState.winner || gameState.pendingAction) return;
    const current = gameState.players[gameState.currentTurnIndex];
    if (!current || current.socketId !== socket.id || current.isBankrupt) return;

    performDiceRoll(current);
  });

  // Buy or Upgrade decision
  socket.on('buy_property_decision', ({ buy, targetLevel }) => {
    if (!gameState.pendingAction) return;
    const { playerId, tileId, isDouble } = gameState.pendingAction;
    if (playerId !== socket.id) return;

    let target = targetLevel;
    if (target === undefined) {
      target = buy ? 1 : null;
    }
    executePurchase(playerId, tileId, target, isDouble);
  });

  // Chat message from client
  socket.on('send_chat', ({ message }) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    const sender = player ? player.name : 'Visitante';
    const cleanMsg = (message || '').trim().slice(0, 150);
    if (cleanMsg) {
      addLog(`💬 ${sender}: ${cleanMsg}`, 'chat');
    }
  });

  // Claim seat if reconnected
  socket.on('claim_seat', ({ playerId }) => {
    const player = gameState.players.find(p => p.id === playerId && !p.isBot);
    if (player) {
      player.socketId = socket.id;
      addLog(`🎮 ${player.name} reconectou-se ao jogo!`, 'system');
      broadcastState();
    }
  });

  // Reset Game
  socket.on('reset_game', () => {
    gameState.gameStarted = false;
    gameState.winner = null;
    gameState.properties = createInitialBoard();
    gameState.chanceCards = shuffleDeck(createInitialChanceDeck());
    gameState.currentTurnIndex = 0;
    gameState.diceState = { d1: 1, d2: 1, sum: 2, isDouble: false };
    gameState.pendingAction = null;
    gameState.players = [];
    addLog(`🔄 O jogo foi reiniciado para o Lobby.`, 'system');
    broadcastState();
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const idx = gameState.players.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) {
      const disconnected = gameState.players[idx];
      if (!gameState.gameStarted) {
        gameState.players.splice(idx, 1);
        addLog(`👋 ${disconnected.name} desconectou-se do lobby.`, 'system');
      } else {
        disconnected.socketId = null;
        addLog(`⚠️ ${disconnected.name} desconectou-se da partida.`, 'system');
        const connectedHumans = gameState.players.filter(p => !p.isBot && p.socketId !== null);
        if (connectedHumans.length === 0) {
          gameState.gameStarted = false;
          gameState.players = [];
          gameState.properties = createInitialBoard();
          gameState.winner = null;
          gameState.currentTurnIndex = 0;
          gameState.pendingAction = null;
        }
      }
      broadcastState();
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Business Tour Server] Running on http://0.0.0.0:${PORT}`);
});
