import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/engine';
import { parseLevelText } from '../../src/core/levelParser';
import { simulate } from '../../src/core/simulation';
import type { GameState, UpdateInput } from '../../src/core/types';

function checksum(grid: string[][]): number {
  let hash = 17;
  for (const row of grid) {
    for (const tile of row) {
      for (let i = 0; i < tile.length; i += 1) {
        hash = (hash * 31 + tile.charCodeAt(i)) >>> 0;
      }
      hash = (hash * 31 + 7) >>> 0;
    }
  }
  return hash;
}

function digest(state: GameState): Record<string, unknown> {
  return {
    levelId: state.levelId,
    levelIndex: state.levelIndex,
    status: state.status,
    moves: state.moves,
    tick: state.tick,
    playersDone: state.playersDone,
    players: state.players,
    enemies: state.enemies,
    gridChecksum: checksum(state.grid),
    lastEvent: state.lastEvent,
  };
}

function loadFixture(name: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, '..', 'fixtures', name), 'utf8');
}

describe('golden deterministic level simulations', () => {
  it('map0 sequence remains stable', () => {
    const map0 = parseLevelText('map0', loadFixture('map0.txt'));
    const initial = createInitialState([map0]);

    const inputs: UpdateInput[] = [
      { direction: 'right' },
      { direction: 'right' },
      { direction: 'down' },
      { direction: 'down' },
      { direction: 'left' },
      { direction: 'up' },
      { direction: 'right' },
      { direction: 'down' },
    ];

    const history = simulate(initial, inputs);
    expect(digest(history[history.length - 1])).toMatchSnapshot();
  });

  it('map1 sequence remains stable', () => {
    const map1 = parseLevelText('map1', loadFixture('map1.txt'));
    const initial = createInitialState([map1]);

    const inputs: UpdateInput[] = [
      { direction: 'up' },
      { direction: 'left' },
      { direction: 'left' },
      { direction: 'up' },
      { direction: 'right' },
      { direction: 'down' },
      { direction: 'down' },
      { direction: 'right' },
      { direction: 'right' },
    ];

    const history = simulate(initial, inputs);
    expect(digest(history[history.length - 1])).toMatchSnapshot();
  });
});
