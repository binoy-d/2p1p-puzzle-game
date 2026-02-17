import type { Direction, Enemy, GameState, Player } from '../core';

export interface EnemyImpact {
  playerId: number;
  enemyId: number;
  intersection: {
    x: number;
    y: number;
  };
  playerFrom: {
    x: number;
    y: number;
  };
  enemyFrom: {
    x: number;
    y: number;
  };
}

export interface LavaImpact {
  playerId: number;
  intersection: {
    x: number;
    y: number;
  };
  playerFrom: {
    x: number;
    y: number;
  };
}

export interface GoalFinishImpact {
  playerId: number;
  portal: {
    x: number;
    y: number;
  };
  playerFrom: {
    x: number;
    y: number;
  };
}

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

function clonePlayers(players: Player[]): Player[] {
  return players.map((player) => ({ ...player }));
}

function cloneEnemies(enemies: Enemy[]): Enemy[] {
  return enemies.map((enemy) => ({ ...enemy }));
}

function isWalkable(tileValue: string): boolean {
  if (tileValue === ' ' || tileValue === 'P') {
    return true;
  }

  const numeric = Number.parseInt(tileValue, 10);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 18;
}

function playerOccupies(players: Player[], x: number, y: number, ignoreId: number): boolean {
  return players.some((player) => player.id !== ignoreId && player.x === x && player.y === y);
}

function findEnemyTouch(players: Player[], enemies: Enemy[]): { player: Player; enemy: Enemy } | null {
  for (const player of players) {
    for (const enemy of enemies) {
      if (player.x === enemy.x && player.y === enemy.y) {
        return { player, enemy };
      }
    }
  }

  return null;
}

function enemyTick(grid: string[][], enemy: Enemy): void {
  const currentRaw = grid[enemy.y]?.[enemy.x];
  const parsedCurrent = Number.parseInt(currentRaw, 10);
  if (!Number.isInteger(parsedCurrent)) {
    return;
  }

  let currentValue = parsedCurrent;
  let moved = false;

  for (let row = enemy.y - 1; row <= enemy.y + 1 && !moved; row += 1) {
    for (let col = enemy.x - 1; col <= enemy.x + 1 && !moved; col += 1) {
      const candidate = grid[row]?.[col];
      const newValue = Number.parseInt(candidate ?? '', 10);
      if (Number.isInteger(newValue) && newValue - 1 === currentValue) {
        grid[enemy.y][enemy.x] = String(18 - currentValue);
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

function toMapById<T extends { id: number; x: number; y: number }>(values: T[]): Map<number, { x: number; y: number }> {
  return new Map(values.map((value) => [value.id, { x: value.x, y: value.y }]));
}

function buildImpact(
  touch: { player: Player; enemy: Enemy },
  playerFromMap: Map<number, { x: number; y: number }>,
  enemyFromMap: Map<number, { x: number; y: number }>,
): EnemyImpact {
  return {
    playerId: touch.player.id,
    enemyId: touch.enemy.id,
    intersection: {
      x: touch.player.x,
      y: touch.player.y,
    },
    playerFrom: playerFromMap.get(touch.player.id) ?? { x: touch.player.x, y: touch.player.y },
    enemyFrom: enemyFromMap.get(touch.enemy.id) ?? { x: touch.enemy.x, y: touch.enemy.y },
  };
}

export function detectEnemyImpact(previousState: GameState, direction: Direction): EnemyImpact | null {
  const grid = cloneGrid(previousState.grid);
  const players = clonePlayers(previousState.players);
  const enemies = cloneEnemies(previousState.enemies);
  const vector = DIRECTION_VECTORS[direction];
  const playerFromMap = toMapById(players);
  const enemyFromMap = toMapById(enemies);

  const initialTouch = findEnemyTouch(players, enemies);
  if (initialTouch) {
    return buildImpact(initialTouch, playerFromMap, enemyFromMap);
  }

  for (const enemy of enemies) {
    enemyTick(grid, enemy);
    const touch = findEnemyTouch(players, enemies);
    if (touch) {
      return buildImpact(touch, playerFromMap, enemyFromMap);
    }
  }

  for (const original of [...players]) {
    const playerIndex = players.findIndex((player) => player.id === original.id);
    if (playerIndex === -1) {
      continue;
    }

    const player = players[playerIndex];
    const targetX = player.x + vector.x;
    const targetY = player.y + vector.y;
    const targetTile = grid[targetY]?.[targetX];

    if (targetTile === undefined) {
      players.splice(playerIndex, 1);
      continue;
    }

    if (isWalkable(targetTile) && !playerOccupies(players, targetX, targetY, player.id)) {
      player.x = targetX;
      player.y = targetY;
    } else if (targetTile === '!') {
      players.splice(playerIndex, 1);
      continue;
    } else if (targetTile === 'x') {
      return null;
    }

    const touch = enemies.find((enemy) => enemy.x === player.x && enemy.y === player.y);
    if (touch) {
      return buildImpact({ player, enemy: touch }, playerFromMap, enemyFromMap);
    }
  }

  return null;
}

export function detectLavaImpact(previousState: GameState, direction: Direction): LavaImpact | null {
  const grid = cloneGrid(previousState.grid);
  const players = clonePlayers(previousState.players);
  const enemies = cloneEnemies(previousState.enemies);
  const vector = DIRECTION_VECTORS[direction];
  const playerFromMap = toMapById(players);

  const initialTouch = findEnemyTouch(players, enemies);
  if (initialTouch) {
    return null;
  }

  for (const enemy of enemies) {
    enemyTick(grid, enemy);
    const touch = findEnemyTouch(players, enemies);
    if (touch) {
      return null;
    }
  }

  for (const original of [...players]) {
    const playerIndex = players.findIndex((player) => player.id === original.id);
    if (playerIndex === -1) {
      continue;
    }

    const player = players[playerIndex];
    const targetX = player.x + vector.x;
    const targetY = player.y + vector.y;
    const targetTile = grid[targetY]?.[targetX];

    if (targetTile === undefined) {
      players.splice(playerIndex, 1);
      continue;
    }

    if (isWalkable(targetTile) && !playerOccupies(players, targetX, targetY, player.id)) {
      player.x = targetX;
      player.y = targetY;
    } else if (targetTile === '!') {
      players.splice(playerIndex, 1);
      continue;
    } else if (targetTile === 'x') {
      return {
        playerId: player.id,
        intersection: { x: targetX, y: targetY },
        playerFrom: playerFromMap.get(player.id) ?? { x: player.x, y: player.y },
      };
    }

    const enemyTouch = enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y);
    if (enemyTouch) {
      return null;
    }
  }

  return null;
}

export function detectGoalFinishImpact(previousState: GameState, direction: Direction): GoalFinishImpact | null {
  const grid = cloneGrid(previousState.grid);
  const players = clonePlayers(previousState.players);
  const enemies = cloneEnemies(previousState.enemies);
  const vector = DIRECTION_VECTORS[direction];
  const playerFromMap = toMapById(players);
  let playersDone = previousState.playersDone;

  const initialTouch = findEnemyTouch(players, enemies);
  if (initialTouch) {
    return null;
  }

  for (const enemy of enemies) {
    enemyTick(grid, enemy);
    const touch = findEnemyTouch(players, enemies);
    if (touch) {
      return null;
    }
  }

  for (const original of [...players]) {
    const playerIndex = players.findIndex((player) => player.id === original.id);
    if (playerIndex === -1) {
      continue;
    }

    const player = players[playerIndex];
    const targetX = player.x + vector.x;
    const targetY = player.y + vector.y;
    const targetTile = grid[targetY]?.[targetX];

    if (targetTile === undefined) {
      players.splice(playerIndex, 1);
      continue;
    }

    if (isWalkable(targetTile) && !playerOccupies(players, targetX, targetY, player.id)) {
      player.x = targetX;
      player.y = targetY;
    } else if (targetTile === '!') {
      playersDone += 1;
      players.splice(playerIndex, 1);
      if (playersDone >= previousState.totalPlayers) {
        return {
          playerId: player.id,
          portal: { x: targetX, y: targetY },
          playerFrom: playerFromMap.get(player.id) ?? { x: player.x, y: player.y },
        };
      }
      continue;
    } else if (targetTile === 'x') {
      return null;
    }

    const enemyTouch = enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y);
    if (enemyTouch) {
      return null;
    }
  }

  return null;
}
