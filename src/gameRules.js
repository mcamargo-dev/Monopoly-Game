// Game Rules and Logic for Business Tour / Monopoly (32 Tiles)

export const START_MONEY = 1000;
export const PASS_GO_BONUS = 200;
export const JAIL_POSITION = 8;
export const GO_TO_JAIL_POSITION = 24;

export const COLOR_GROUPS = {
  BROWN: '#8B5A2B',
  CYAN: '#00BCD4',
  PINK: '#E91E63',
  ORANGE: '#FF9800',
  RED: '#F44336',
  YELLOW: '#FFEB3B',
  GREEN: '#4CAF50',
  BLUE: '#2196F3',
  STATION: '#607D8B',
  SPECIAL: '#9E9E9E'
};

export const LEVEL_NAMES = {
  0: 'Vazio',
  1: 'Terreno',
  2: 'Casa 1',
  3: 'Casa 2',
  4: 'Casa 3',
  5: 'Hotel'
};

export const LEVEL_ICONS = {
  0: '⬜',
  1: '🏛️',
  2: '🏠',
  3: '🏡',
  4: '🏘️',
  5: '🏨'
};

export function createInitialBoard() {
  const rawTiles = [
    { id: 0, name: 'Início', type: 'inicio', price: 0, rent: 0, group: 'SPECIAL', icon: '🏁' },
    { id: 1, name: 'Atenas', type: 'terreno', price: 60, rent: 20, group: 'BROWN', icon: '🏛️' },
    { id: 2, name: 'Sorte', type: 'sorte', price: 0, rent: 0, group: 'SPECIAL', icon: '❓' },
    { id: 3, name: 'Roma', type: 'terreno', price: 80, rent: 30, group: 'BROWN', icon: '🏟️' },
    { id: 4, name: 'Imposto', type: 'taxa', price: 0, rent: 100, group: 'SPECIAL', icon: '💸' },
    { id: 5, name: 'Cairo', type: 'terreno', price: 100, rent: 40, group: 'CYAN', icon: '🐪' },
    { id: 6, name: 'Istambul', type: 'terreno', price: 120, rent: 50, group: 'CYAN', icon: '🕌' },
    { id: 7, name: 'Dubai', type: 'terreno', price: 140, rent: 60, group: 'CYAN', icon: '🏙️' },
    { id: 8, name: 'Prisão', type: 'prisao', price: 0, rent: 0, group: 'SPECIAL', icon: '⛓️' },
    { id: 9, name: 'Berlim', type: 'terreno', price: 160, rent: 70, group: 'PINK', icon: '🥨' },
    { id: 10, name: 'Aeroporto O.', type: 'terreno', price: 200, rent: 80, group: 'STATION', icon: '✈️' },
    { id: 11, name: 'Viena', type: 'terreno', price: 180, rent: 80, group: 'PINK', icon: '🎻' },
    { id: 12, name: 'Madrid', type: 'terreno', price: 200, rent: 90, group: 'PINK', icon: '🐂' },
    { id: 13, name: 'Cofre', type: 'sorte', price: 0, rent: 0, group: 'SPECIAL', icon: '🎁' },
    { id: 14, name: 'Londres', type: 'terreno', price: 220, rent: 100, group: 'ORANGE', icon: '🎡' },
    { id: 15, name: 'Paris', type: 'terreno', price: 240, rent: 110, group: 'ORANGE', icon: '🗼' },
    { id: 16, name: 'Resort', type: 'parada', price: 0, rent: 0, group: 'SPECIAL', icon: '🏖️' },
    { id: 17, name: 'Amsterdã', type: 'terreno', price: 260, rent: 120, group: 'RED', icon: '🚲' },
    { id: 18, name: 'Sorte', type: 'sorte', price: 0, rent: 0, group: 'SPECIAL', icon: '❓' },
    { id: 19, name: 'Bruxelas', type: 'terreno', price: 280, rent: 130, group: 'RED', icon: '🍫' },
    { id: 20, name: 'Aeroporto L.', type: 'terreno', price: 200, rent: 80, group: 'STATION', icon: '🛫' },
    { id: 21, name: 'Tóquio', type: 'terreno', price: 300, rent: 140, group: 'YELLOW', icon: '⛩️' },
    { id: 22, name: 'Seul', type: 'terreno', price: 320, rent: 150, group: 'YELLOW', icon: '🏯' },
    { id: 23, name: 'Pequim', type: 'terreno', price: 340, rent: 160, group: 'YELLOW', icon: '🐉' },
    { id: 24, name: 'Vá p/ Prisão', type: 'va_prisao', price: 0, rent: 0, group: 'SPECIAL', icon: '👮‍♂️' },
    { id: 25, name: 'Sydney', type: 'terreno', price: 360, rent: 170, group: 'GREEN', icon: '🦘' },
    { id: 26, name: 'Toronto', type: 'terreno', price: 380, rent: 180, group: 'GREEN', icon: '🍁' },
    { id: 27, name: 'Cofre', type: 'sorte', price: 0, rent: 0, group: 'SPECIAL', icon: '🎁' },
    { id: 28, name: 'Nova York', type: 'terreno', price: 400, rent: 190, group: 'GREEN', icon: '🗽' },
    { id: 29, name: 'Taxa Luxo', type: 'taxa', price: 0, rent: 150, group: 'SPECIAL', icon: '💎' },
    { id: 30, name: 'Rio', type: 'terreno', price: 450, rent: 220, group: 'BLUE', icon: '🌴' },
    { id: 31, name: 'São Paulo', type: 'terreno', price: 500, rent: 250, group: 'BLUE', icon: '🌆' }
  ];

  return rawTiles.map(tile => {
    if (tile.type === 'terreno') {
      const P = tile.price;
      const R = tile.rent;
      const houseStep = Math.round(P * 0.5);
      return {
        ...tile,
        level: 0, // 0 = Vazio, 1 = Land, 2 = House 1, 3 = House 2, 4 = House 3, 5 = Hotel
        owner: null,
        buildCosts: [0, P, houseStep, houseStep, houseStep, P],
        rentValues: [0, R, Math.round(R * 2.5), Math.round(R * 4.5), Math.round(R * 7), Math.round(R * 11)]
      };
    }
    return {
      ...tile,
      level: 0,
      owner: null,
      buildCosts: [0, 0, 0, 0, 0, 0],
      rentValues: [0, tile.rent, tile.rent, tile.rent, tile.rent, tile.rent]
    };
  });
}

export function calculateUpgradeCost(tile, fromLevel, targetLevel) {
  if (!tile.buildCosts || targetLevel <= fromLevel) return 0;
  let total = 0;
  for (let lvl = fromLevel + 1; lvl <= targetLevel; lvl++) {
    total += tile.buildCosts[lvl] || 0;
  }
  return total;
}

export function getPurchaseOptions(tile, playerLaps) {
  if (tile.type !== 'terreno') return [];
  const currentLvl = tile.level || 0;
  const maxLvl = playerLaps === 0 ? 2 : 5;
  if (currentLvl >= maxLvl) return [];

  const options = [];
  for (let targetLvl = currentLvl + 1; targetLvl <= maxLvl; targetLvl++) {
    options.push({
      level: targetLvl,
      name: LEVEL_NAMES[targetLvl],
      icon: LEVEL_ICONS[targetLvl],
      stepCost: tile.buildCosts[targetLvl],
      cost: calculateUpgradeCost(tile, currentLvl, targetLvl),
      rent: tile.rentValues[targetLvl]
    });
  }
  return options;
}

export function canUpgradeProperty(tile, player, targetLevel) {
  if (tile.type !== 'terreno') {
    return { allowed: false, cost: 0, reason: 'Apenas terrenos podem ser construídos' };
  }
  const currentLvl = tile.level || 0;
  if (targetLevel <= currentLvl || targetLevel > 5) {
    return { allowed: false, cost: 0, reason: 'Nível de construção inválido' };
  }
  const maxLvl = (player.laps || 0) === 0 ? 2 : 5;
  if (targetLevel > maxLvl) {
    return { allowed: false, cost: 0, reason: 'Na primeira volta, só é permitida a compra até Casa 1 (Nível 2)' };
  }
  if (currentLvl > 0 && tile.owner !== player.id) {
    return { allowed: false, cost: 0, reason: 'Você não é o dono desta propriedade' };
  }
  const cost = calculateUpgradeCost(tile, currentLvl, targetLevel);
  if (player.money < cost) {
    return { allowed: false, cost, reason: 'Saldo insuficiente' };
  }
  return { allowed: true, cost, reason: null };
}

export function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return {
    d1,
    d2,
    sum: d1 + d2,
    isDouble: d1 === d2
  };
}

export function calculateNewPosition(currentPos, diceSum) {
  const rawTarget = currentPos + diceSum;
  const newPosition = rawTarget % 32;
  const passedGo = rawTarget >= 32;
  return {
    newPosition,
    passedGo
  };
}

export function isGoToJail(position) {
  return position === GO_TO_JAIL_POSITION;
}

export function processRentPayment(payer, owner, rent) {
  if (payer.money < rent) {
    const bankruptAmount = payer.money;
    payer.money = 0;
    payer.isBankrupt = true;
    if (owner) {
      owner.money += bankruptAmount;
    }
    return {
      success: false,
      bankrupt: true,
      amountPaid: bankruptAmount
    };
  }

  payer.money -= rent;
  if (owner) {
    owner.money += rent;
  }
  return {
    success: true,
    bankrupt: false,
    amountPaid: rent
  };
}

export function resetPlayerProperties(properties, playerId) {
  return properties.map(tile => {
    if (tile.owner === playerId) {
      return { ...tile, owner: null, level: 0 };
    }
    return tile;
  });
}

export function getNextPlayerIndex(players, currentIndex, isDouble = false) {
  const activePlayers = players.filter(p => !p.isBankrupt);
  if (activePlayers.length <= 1) {
    return currentIndex; // Game over or only 1 player
  }

  // If double rolled and current player is not bankrupt, they roll again!
  const currentPlayer = players[currentIndex];
  if (isDouble && currentPlayer && !currentPlayer.isBankrupt && !currentPlayer.inJail) {
    return currentIndex;
  }

  let nextIdx = (currentIndex + 1) % players.length;
  let safetyLoop = 0;
  while (players[nextIdx]?.isBankrupt && safetyLoop < players.length) {
    nextIdx = (nextIdx + 1) % players.length;
    safetyLoop++;
  }
  return nextIdx;
}

export function createInitialChanceDeck() {
  return [
    {
      id: 'card_lottery',
      title: 'Prêmio da Loteria',
      type: 'money',
      value: 200,
      icon: '🎰',
      text: 'Você acertou os números da sorte na loteria internacional! Receba +$200 do banco.'
    },
    {
      id: 'card_maintenance',
      title: 'Reforma Predial',
      type: 'money',
      value: -100,
      icon: '🛠️',
      text: 'Vistoria técnica constatou reparos na rede hidráulica. Pague -$100 ao banco.'
    },
    {
      id: 'card_dividends',
      title: 'Dividendos Globais',
      type: 'money',
      value: 150,
      icon: '📈',
      text: 'Suas ações em tecnologia valorizaram no mercado! Receba +$150 de lucros.'
    },
    {
      id: 'card_speeding',
      title: 'Multa de Trânsito',
      type: 'money',
      value: -80,
      icon: '🚓',
      text: 'Excesso de velocidade com sua frota corporativa. Pague -$80 de multa.'
    },
    {
      id: 'card_go_start',
      title: 'Voo Direto ao Início',
      type: 'move_to',
      target: 0,
      icon: '🏁',
      passGoBonus: true,
      text: 'Acelere seus negócios! Avance diretamente para o INÍCIO e receba +$200.'
    },
    {
      id: 'card_go_jail',
      title: 'Mandado Judicial',
      type: 'move_to',
      target: JAIL_POSITION,
      icon: '⛓️',
      inJail: true,
      passGoBonus: false,
      text: 'Investigação fiscal confirmada! Vá diretamente para a Prisão sem passar pelo Início.'
    },
    {
      id: 'card_advance_3',
      title: 'Voo Executivo',
      type: 'move_relative',
      delta: 3,
      icon: '🛫',
      text: 'Condições climáticas favoráveis! Avance 3 casas à frente no tabuleiro.'
    },
    {
      id: 'card_back_3',
      title: 'Engarrafamento Global',
      type: 'move_relative',
      delta: -3,
      icon: '🚧',
      text: 'Obras na avenida principal: recue 3 casas para trás no tabuleiro.'
    }
  ];
}

export function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function drawChanceCard(deck) {
  if (!deck || deck.length === 0) return null;
  const card = deck.shift();
  deck.push(card);
  return card;
}

export function applyCardEffect(card, player) {
  let passedGo = false;
  let newPosition = player.position;
  let moved = false;

  if (card.type === 'money') {
    if (card.value < 0 && player.money < Math.abs(card.value)) {
      player.money = 0;
      player.isBankrupt = true;
    } else {
      player.money += card.value;
    }
  } else if (card.type === 'move_to') {
    const oldPos = player.position;
    newPosition = card.target;
    moved = true;
    if (card.passGoBonus && (newPosition === 0 || newPosition < oldPos)) {
      passedGo = true;
      player.money += PASS_GO_BONUS;
    }
    if (card.inJail) {
      player.inJail = true;
    }
    player.position = newPosition;
  } else if (card.type === 'move_relative') {
    const oldPos = player.position;
    const rawPos = oldPos + card.delta;
    newPosition = (rawPos % 32 + 32) % 32;
    moved = true;
    if (card.delta > 0 && rawPos >= 32) {
      passedGo = true;
      player.money += PASS_GO_BONUS;
    }
    player.position = newPosition;
  }

  return {
    card,
    moved,
    passedGo,
    newPosition,
    isBankrupt: player.isBankrupt
  };
}
