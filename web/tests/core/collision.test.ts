import { describe, expect, it } from 'vitest';
import { createInitialState, update } from '../../src/core/engine';
import { parseLevelText } from '../../src/core/levelParser';

function buildState(raw: string) {
  const level = parseLevelText('test', raw);
  return createInitialState([level]);
}

describe('collision and movement rules', () => {
  it('blocks movement into walls', () => {
    const state = buildState(['#####', '#P###', '#####'].join('\n'));
    const next = update(state, { direction: 'right' }, 16.67);

    expect(next.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('applies sequential player movement and blocking', () => {
    const state = buildState(['######', '#PP  #', '######'].join('\n'));
    const next = update(state, { direction: 'right' }, 16.67);

    expect(next.players).toEqual([
      { id: 0, x: 1, y: 1 },
      { id: 1, x: 3, y: 1 },
    ]);
  });

  it('resets level on lava touch', () => {
    const state = buildState(['#####', '#Px #', '#####'].join('\n'));
    const next = update(state, { direction: 'right' }, 16.67);

    expect(next.lastEvent).toBe('level-reset');
    expect(next.moves).toBe(0);
    expect(next.players[0]).toMatchObject({ x: 1, y: 1 });
  });

  it('resets level when player ends turn on enemy tile', () => {
    const state = buildState(['######', '#P12 #', '######'].join('\n'));

    const step1 = update(state, { direction: 'right' }, 16.67);
    const step2 = update(step1, { direction: 'right' }, 16.67);

    expect(step2.lastEvent).toBe('level-reset');
    expect(step2.moves).toBe(0);
    expect(step2.players[0]).toMatchObject({ x: 1, y: 1 });
  });
});
