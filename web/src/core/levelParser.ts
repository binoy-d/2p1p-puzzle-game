import type { ParsedLevel, Vec2 } from './types';

const VALID_TILE_RE = /^[# !xP0-9]$/;

function cloneVec(position: Vec2): Vec2 {
  return { x: position.x, y: position.y };
}

export function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

export function parseLevelText(id: string, raw: string): ParsedLevel {
  const normalized = raw.replace(/\r/g, '');
  const lines = normalized.split('\n');

  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    throw new Error(`Level ${id} is empty.`);
  }

  const width = lines[0].length;

  if (width === 0) {
    throw new Error(`Level ${id} has zero width.`);
  }

  const grid: string[][] = [];
  const playerSpawns: Vec2[] = [];
  const enemySpawns: Vec2[] = [];

  lines.forEach((line, y) => {
    if (line.length !== width) {
      throw new Error(
        `Level ${id} is ragged at row ${y}. Expected width ${width}, got ${line.length}.`,
      );
    }

    const row: string[] = [];
    for (let x = 0; x < line.length; x += 1) {
      const tile = line[x];
      if (!VALID_TILE_RE.test(tile)) {
        throw new Error(`Level ${id} contains invalid tile '${tile}' at ${x},${y}.`);
      }

      row.push(tile);
      if (tile === 'P') {
        playerSpawns.push({ x, y });
      }
      if (tile === '1') {
        enemySpawns.push({ x, y });
      }
    }
    grid.push(row);
  });

  if (playerSpawns.length === 0) {
    throw new Error(`Level ${id} has no player spawn.`);
  }

  return {
    id,
    width,
    height: lines.length,
    grid,
    playerSpawns,
    enemySpawns,
  };
}

export function serializeParsedLevel(level: ParsedLevel): string {
  return level.grid.map((row) => row.join('')).join('\n');
}

export function cloneParsedLevel(level: ParsedLevel): ParsedLevel {
  return {
    id: level.id,
    width: level.width,
    height: level.height,
    grid: cloneGrid(level.grid),
    playerSpawns: level.playerSpawns.map(cloneVec),
    enemySpawns: level.enemySpawns.map(cloneVec),
  };
}
