import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBoard,
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
  JAIL_POSITION,
  GO_TO_JAIL_POSITION
} from '../src/gameRules.js';

test('Board initialization creates exactly 32 tiles with valid properties and Business Tour levels', () => {
  const board = createInitialBoard();
  assert.equal(board.length, 32);
  assert.equal(board[0].type, 'inicio');
  assert.equal(board[8].type, 'prisao');
  assert.equal(board[24].type, 'va_prisao');
  assert.equal(board[1].owner, null);
  assert.equal(board[1].level, 0);
  assert.equal(board[1].buildCosts.length, 6);
  assert.equal(board[1].rentValues.length, 6);
});

test('Movement calculation wraps around 32 and detects passing Go', () => {
  // Move within board
  const step1 = calculateNewPosition(0, 7);
  assert.equal(step1.newPosition, 7);
  assert.equal(step1.passedGo, false);

  // Move past board (e.g. 28 + 6 = 34 -> index 2, passed Go!)
  const step2 = calculateNewPosition(28, 6);
  assert.equal(step2.newPosition, 2);
  assert.equal(step2.passedGo, true);

  // Exact landing on Go (index 0)
  const step3 = calculateNewPosition(26, 6);
  assert.equal(step3.newPosition, 0);
  assert.equal(step3.passedGo, true);
});

test('Special tiles detection for Go to Jail', () => {
  assert.equal(isGoToJail(GO_TO_JAIL_POSITION), true);
  assert.equal(isGoToJail(JAIL_POSITION), false);
  assert.equal(isGoToJail(0), false);
});

test('Rent payment handles normal transfer correctly', () => {
  const playerA = { id: 'p1', money: 500, isBankrupt: false };
  const playerB = { id: 'p2', money: 300, isBankrupt: false };

  const result = processRentPayment(playerA, playerB, 100);
  assert.equal(result.success, true);
  assert.equal(result.bankrupt, false);
  assert.equal(playerA.money, 400);
  assert.equal(playerB.money, 400);
});

test('Rent payment declares bankruptcy when player cannot afford rent', () => {
  const playerA = { id: 'p1', money: 50, isBankrupt: false };
  const playerB = { id: 'p2', money: 300, isBankrupt: false };

  const result = processRentPayment(playerA, playerB, 100);
  assert.equal(result.success, false);
  assert.equal(result.bankrupt, true);
  assert.equal(playerA.money, 0);
  assert.equal(playerA.isBankrupt, true);
  assert.equal(playerB.money, 350); // gets all remaining money
});

test('Reset player properties when bankrupt frees up tiles', () => {
  let board = createInitialBoard();
  board[1].owner = 'p1';
  board[3].owner = 'p1';
  board[5].owner = 'p2';

  board = resetPlayerProperties(board, 'p1');
  assert.equal(board[1].owner, null);
  assert.equal(board[3].owner, null);
  assert.equal(board[5].owner, 'p2');
});

test('Turn progression: advances to next non-bankrupt player, or keeps turn on doubles', () => {
  const players = [
    { id: 'p1', isBankrupt: false, inJail: false },
    { id: 'p2', isBankrupt: true, inJail: false },
    { id: 'p3', isBankrupt: false, inJail: false }
  ];

  // Normal turn passes from 0 to 2 (skips bankrupt 1)
  const nextIdx = getNextPlayerIndex(players, 0, false);
  assert.equal(nextIdx, 2);

  // Double rolled: player 0 gets another turn
  const doubleIdx = getNextPlayerIndex(players, 0, true);
  assert.equal(doubleIdx, 0);
});

test('Chance Deck initialization creates >= 6 cards and operates as circular queue', () => {
  const deck = createInitialChanceDeck();
  assert.ok(deck.length >= 6);
  const firstCard = deck[0];
  const secondCard = deck[1];

  // Draw card: shifts from front and pushes to end
  const drawn = drawChanceCard(deck);
  assert.equal(drawn.id, firstCard.id);
  assert.equal(deck[0].id, secondCard.id);
  assert.equal(deck[deck.length - 1].id, firstCard.id);
});

test('Chance Card effect: money card adjusts balance or declares bankruptcy', () => {
  const player = { id: 'p1', money: 500, position: 2, isBankrupt: false };
  const winCard = { type: 'money', value: 200 };
  applyCardEffect(winCard, player);
  assert.equal(player.money, 700);

  const loseCard = { type: 'money', value: -800 };
  applyCardEffect(loseCard, player);
  assert.equal(player.money, 0);
  assert.equal(player.isBankrupt, true);
});

test('Chance Card effect: move_to changes position and awards passGo bonus when applicable', () => {
  const player = { id: 'p1', money: 500, position: 18, isBankrupt: false };
  const cardStart = { type: 'move_to', target: 0, passGoBonus: true };
  const res1 = applyCardEffect(cardStart, player);
  assert.equal(res1.moved, true);
  assert.equal(res1.newPosition, 0);
  assert.equal(player.position, 0);
  assert.equal(player.money, 700); // 500 + 200

  const cardJail = { type: 'move_to', target: JAIL_POSITION, inJail: true, passGoBonus: false };
  const res2 = applyCardEffect(cardJail, player);
  assert.equal(res2.newPosition, JAIL_POSITION);
  assert.equal(player.inJail, true);
});

test('Chance Card effect: move_relative moves player forward/backward with wrapping', () => {
  const player = { id: 'p1', money: 500, position: 30, isBankrupt: false };
  // Move forward 3 tiles: 30 + 3 = 33 -> index 1, passes Go (+200)
  const cardFwd = { type: 'move_relative', delta: 3 };
  const resFwd = applyCardEffect(cardFwd, player);
  assert.equal(resFwd.moved, true);
  assert.equal(resFwd.newPosition, 1);
  assert.equal(resFwd.passedGo, true);
  assert.equal(player.money, 700);

  // Move backward 3 tiles: 1 - 3 -> index 30
  const cardBack = { type: 'move_relative', delta: -3 };
  const resBack = applyCardEffect(cardBack, player);
  assert.equal(resBack.moved, true);
  assert.equal(resBack.newPosition, 30);
});

test('Business Tour: Lap 0 limits initial purchase up to Level 2 (House 1)', () => {
  const board = createInitialBoard();
  const tile = board[1]; // Atenas (price 60, houseStep 30)
  
  // Lap 0: only options for Level 1 (Land) and Level 2 (House 1)
  const optionsLap0 = getPurchaseOptions(tile, 0);
  assert.equal(optionsLap0.length, 2);
  assert.equal(optionsLap0[0].level, 1);
  assert.equal(optionsLap0[0].cost, 60);
  assert.equal(optionsLap0[1].level, 2);
  assert.equal(optionsLap0[1].cost, 60 + 30); // 90 cumulative

  // Lap > 0: options for levels 1, 2, 3, 4, 5
  const optionsLap1 = getPurchaseOptions(tile, 1);
  assert.equal(optionsLap1.length, 5);
  assert.equal(optionsLap1[4].level, 5); // Hotel
});

test('Business Tour: Cumulative upgrade cost from level 2 to level 4 or 5', () => {
  const board = createInitialBoard();
  const tile = board[1]; // price 60, step 30, hotel 60
  tile.level = 2; // already has House 1
  
  // Upgrade from 2 to 3 = buildCosts[3] = 30
  const cost2to3 = calculateUpgradeCost(tile, 2, 3);
  assert.equal(cost2to3, 30);

  // Upgrade from 2 to 4 = buildCosts[3] (30) + buildCosts[4] (30) = 60
  const cost2to4 = calculateUpgradeCost(tile, 2, 4);
  assert.equal(cost2to4, 60);

  // Upgrade from 2 to 5 = 30 + 30 + 60 = 120
  const cost2to5 = calculateUpgradeCost(tile, 2, 5);
  assert.equal(cost2to5, 120);
});

test('Business Tour: canUpgradeProperty enforces laps rule and balance', () => {
  const board = createInitialBoard();
  const tile = board[1]; // Atenas
  const player = { id: 'p1', money: 1000, laps: 0 };

  // Lap 0: Level 2 is allowed, Level 3 is blocked
  const checkLvl2 = canUpgradeProperty(tile, player, 2);
  assert.equal(checkLvl2.allowed, true);

  const checkLvl3 = canUpgradeProperty(tile, player, 3);
  assert.equal(checkLvl3.allowed, false);

  // Lap 1: Level 3 is allowed
  player.laps = 1;
  const checkLvl3Lap1 = canUpgradeProperty(tile, player, 3);
  assert.equal(checkLvl3Lap1.allowed, true);

  // Insufficient funds
  player.money = 10;
  const checkBroke = canUpgradeProperty(tile, player, 1);
  assert.equal(checkBroke.allowed, false);
});
