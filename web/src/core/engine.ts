import { cloneGrid } from './levelParser';
import type {
  Direction,
  Enemy,
  GameState,
  ParsedLevel,
  Player,
  TurnEvent,
  UpdateInput,
} from './types';

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function clonePlayers(players: Player[]): Player[] {
  return players.map((player) => ({ ...player }));
}

function cloneEnemies(enemies: Enemy[]): Enemy[] {
  return enemies.map((enemy) => ({ ...enemy }));
}

function buildLevelRegistry(levels: ParsedLevel[]): {
  levelIds: string[];
  registry: Record<string, ParsedLevel>;
} {
  if (levels.length === 0) {
    throw new Error('At least one parsed level is required.');
  }

  const levelIds: string[] = [];
  const registry: Record<string, ParsedLevel> = {};

  for (const level of levels) {
    levelIds.push(level.id);
    registry[level.id] = level;
  }

  return { levelIds, registry };
}

function makeEntities(level: ParsedLevel): { players: Player[]; enemies: Enemy[] } {
  const players = level.playerSpawns.map((spawn, id) => ({ id, x: spawn.x, y: spawn.y }));
  const enemies = level.enemySpawns.map((spawn, id) => ({ id, x: spawn.x, y: spawn.y }));
  return { players, enemies };
}

function withActiveLevel(
  state: Pick<GameState, 'levelIds' | 'levels'>,
  levelIndex: number,
  lastEvent: TurnEvent,
): GameState {
  const clampedIndex = Math.max(0, Math.min(levelIndex, state.levelIds.length - 1));
  const levelId = state.levelIds[clampedIndex];
  const parsed = state.levels[levelId];
  const entities = makeEntities(parsed);

  return {
    levelIds: state.levelIds,
    levels: state.levels,
    levelIndex: clampedIndex,
    levelId,
    grid: cloneGrid(parsed.grid),
    players: entities.players,
    enemies: entities.enemies,
    totalPlayers: entities.players.length,
    playersDone: 0,
    moves: 0,
    tick: 0,
    status: 'playing',
    lastEvent,
  };
}

export function createInitialState(levels: ParsedLevel[], startLevelIndex = 0): GameState {
  const { levelIds, registry } = buildLevelRegistry(levels);
  return withActiveLevel({ levelIds, levels: registry }, startLevelIndex, 'none');
}

function resetCurrentLevel(state: GameState): GameState {
  return withActiveLevel(state, state.levelIndex, 'level-reset');
}

export function restartLevel(state: GameState): GameState {
  return resetCurrentLevel(state);
}

export function setLevel(state: GameState, levelIndex: number): GameState {
  return withActiveLevel(state, levelIndex, 'none');
}

function tryAdvanceLevel(state: GameState): GameState {
  const nextLevel = state.levelIndex + 1;
  if (nextLevel >= state.levelIds.length) {
    return {
      ...state,
      players: [],
      enemies: [],
      status: 'game-complete',
      lastEvent: 'game-complete',
    };
  }

  return withActiveLevel(state, nextLevel, 'level-advanced');
}

function isWalkable(tileValue: string): boolean {
  if (tileValue === ' ' || tileValue === 'P') {
    return true;
  }

  const numeric = Number.parseInt(tileValue, 10);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 18;
}

function hasEnemyTouch(state: GameState): boolean {
  return state.players.some((player) =>
    state.enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y),
  );
}

function enemyTick(state: GameState, enemy: Enemy): void {
  const currentRaw = state.grid[enemy.y]?.[enemy.x];
  const parsedCurrent = Number.parseInt(currentRaw, 10);
  if (!Number.isInteger(parsedCurrent)) {
    return;
  }

  let currentValue = parsedCurrent;
  let moved = false;

  for (let row = enemy.y - 1; row <= enemy.y + 1 && !moved; row += 1) {
    for (let col = enemy.x - 1; col <= enemy.x + 1 && !moved; col += 1) {
      const candidate = state.grid[row]?.[col];
      const newValue = Number.parseInt(candidate ?? '', 10);
      if (Number.isInteger(newValue) && newValue - 1 === currentValue) {
        state.grid[enemy.y][enemy.x] = String(18 - currentValue);
        enemy.x = col;
        enemy.y = row;
        moved = true;
      }

      if (currentValue === 17) {
        currentValue = 1;
      }
    }
  }
}

function runEnemyPhase(state: GameState): GameState {
  if (hasEnemyTouch(state)) {
    return resetCurrentLevel(state);
  }

  for (const enemy of state.enemies) {
    enemyTick(state, enemy);
    if (hasEnemyTouch(state)) {
      return resetCurrentLevel(state);
    }
  }

  if (hasEnemyTouch(state)) {
    return resetCurrentLevel(state);
  }

  return state;
}

function playerOccupies(state: GameState, x: number, y: number, ignoreId: number): boolean {
  return state.players.some((player) => player.id !== ignoreId && player.x === x && player.y === y);
}

function runPlayerPhase(state: GameState, direction: Direction): GameState {
  const vector = DIRECTION_VECTORS[direction];

  for (const original of [...state.players]) {
    const playerIndex = state.players.findIndex((player) => player.id === original.id);
    if (playerIndex === -1) {
      continue;
    }

    const player = state.players[playerIndex];
    const targetX = player.x + vector.x;
    const targetY = player.y + vector.y;
    const targetTile = state.grid[targetY]?.[targetX];

    if (targetTile === undefined) {
      state.players.splice(playerIndex, 1);
      continue;
    }

    if (isWalkable(targetTile) && !playerOccupies(state, targetX, targetY, player.id)) {
      player.x = targetX;
      player.y = targetY;
    } else if (targetTile === '!') {
      state.playersDone += 1;
      state.players.splice(playerIndex, 1);

      if (state.playersDone >= state.totalPlayers) {
        return tryAdvanceLevel(state);
      }

      continue;
    } else if (targetTile === 'x') {
      return resetCurrentLevel(state);
    }

    if (state.enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y)) {
      return resetCurrentLevel(state);
    }
  }

  return state;
}

export function update(state: GameState, input: UpdateInput, dtMs: number): GameState {
  void dtMs;
  if (input.restart) {
    return restartLevel(state);
  }

  if (state.status === 'game-complete') {
    return { ...state, lastEvent: 'none' };
  }

  if (!input.direction) {
    return { ...state, lastEvent: 'none' };
  }

  let next: GameState = {
    ...state,
    grid: cloneGrid(state.grid),
    players: clonePlayers(state.players),
    enemies: cloneEnemies(state.enemies),
    moves: state.moves + 1,
    tick: state.tick + 1,
    lastEvent: 'turn-processed',
  };

  next = runEnemyPhase(next);
  if (next.lastEvent === 'level-reset' || next.lastEvent === 'level-advanced' || next.status !== 'playing') {
    return next;
  }

  next = runPlayerPhase(next, input.direction);
  return next;
}

export function getSpawnTileCenter(
  x: number,
  y: number,
  tileSize: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  return {
    x: offsetX + x * tileSize + tileSize / 2,
    y: offsetY + y * tileSize + tileSize / 2,
  };
}
