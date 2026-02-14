import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  getSpawnTileCenter,
  restartLevel,
  setLevel,
  update,
} from '../../src/core/engine';
import { parseLevelText } from '../../src/core/levelParser';
import { simulate, stateSnapshot } from '../../src/core/simulation';

function parseLevels(rawLevels: string[]) {
  return rawLevels.map((raw, index) => parseLevelText(`L${index}`, raw));
}

describe('update and state transitions', () => {
  it('throws when no levels are provided', () => {
    expect(() => createInitialState([])).toThrow(/at least one/i);
  });

  it('advances to the next level once all players reach goals', () => {
    const levels = parseLevels([
      ['#####', '#P!##', '#####'].join('\n'),
      ['#####', '#P  #', '#####'].join('\n'),
    ]);

    const initial = createInitialState(levels);
    const next = update(initial, { direction: 'right' }, 16.67);

    expect(next.levelIndex).toBe(1);
    expect(next.levelId).toBe('L1');
    expect(next.lastEvent).toBe('level-advanced');
    expect(next.moves).toBe(0);
  });

  it('marks game complete after final level finishes', () => {
    const levels = parseLevels([['#####', '#P!##', '#####'].join('\n')]);

    const initial = createInitialState(levels);
    const next = update(initial, { direction: 'right' }, 16.67);

    expect(next.status).toBe('game-complete');
    expect(next.lastEvent).toBe('game-complete');
  });

  it('drops players that move out of bounds', () => {
    const levels = parseLevels([['P  '].join('\n')]);

    const initial = createInitialState(levels);
    const step1 = update(initial, { direction: 'left' }, 16.67);

    expect(step1.players).toHaveLength(0);
    expect(step1.lastEvent).toBe('turn-processed');
  });

  it('produces deterministic simulation output for same inputs', () => {
    const levels = parseLevels([
      ['#######', '#P 12 #', '#  !  #', '#######'].join('\n'),
      ['#######', '#P   !#', '#######'].join('\n'),
    ]);

    const initialA = createInitialState(levels);
    const initialB = createInitialState(levels);

    const inputs = [
      { direction: 'right' as const },
      { direction: 'right' as const },
      { direction: 'down' as const },
      { direction: 'right' as const },
      { direction: 'up' as const },
    ];

    const historyA = simulate(initialA, inputs).map(stateSnapshot);
    const historyB = simulate(initialB, inputs).map(stateSnapshot);

    expect(historyA).toEqual(historyB);
  });

  it('supports restart, null input, clamped level selection, and coordinate helper', () => {
    const levels = parseLevels([
      ['#####', '#P !#', '#####'].join('\n'),
      ['#####', '# P #', '#####'].join('\n'),
    ]);

    const initial = createInitialState(levels);
    const nullTick = update(initial, { direction: null }, 16.67);
    expect(nullTick.lastEvent).toBe('none');

    const moved = update(initial, { direction: 'right' }, 16.67);
    const restartedViaInput = update(moved, { direction: null, restart: true }, 16.67);
    const restartedDirect = restartLevel(moved);
    expect(restartedViaInput.players).toEqual(restartedDirect.players);
    expect(restartedViaInput.moves).toBe(0);

    const clamped = setLevel(initial, 999);
    expect(clamped.levelIndex).toBe(1);

    const centered = getSpawnTileCenter(2, 3, 40, 10, 20);
    expect(centered).toEqual({ x: 110, y: 160 });
  });

  it('resets immediately when an enemy already overlaps a player at turn start', () => {
    const levels = parseLevels([['#####', '#P1 #', '#####'].join('\n')]);
    const initial = createInitialState(levels);
    const seededOverlap = {
      ...initial,
      players: [{ ...initial.players[0], x: initial.enemies[0].x, y: initial.enemies[0].y }],
    };

    const next = update(seededOverlap, { direction: 'right' }, 16.67);
    expect(next.lastEvent).toBe('level-reset');
    expect(next.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('returns a passive tick when already game-complete', () => {
    const levels = parseLevels([['#####', '#P!##', '#####'].join('\n')]);
    const complete = update(createInitialState(levels), { direction: 'right' }, 16.67);
    const passive = update(complete, { direction: 'left' }, 16.67);

    expect(passive.status).toBe('game-complete');
    expect(passive.lastEvent).toBe('none');
  });
});
