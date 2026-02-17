import { describe, expect, it } from 'vitest';
import { createInitialState, parseLevelText, update } from '../../src/core';
import { detectEnemyImpact, detectGoalFinishImpact, detectLavaImpact } from '../../src/app/deathImpact';

function makeState(raw: string) {
  const level = parseLevelText('impact', raw);
  return createInitialState([level], 0);
}

describe('enemy impact detection', () => {
  it('detects player stepping onto an enemy tile', () => {
    const initial = makeState(['######', '#P12 #', '######'].join('\n'));
    const afterFirstMove = update(initial, { direction: 'right' }, 16.67);

    const impact = detectEnemyImpact(afterFirstMove, 'right');
    expect(impact).toEqual({
      playerId: 0,
      enemyId: 0,
      intersection: { x: 3, y: 1 },
      playerFrom: { x: 2, y: 1 },
      enemyFrom: { x: 3, y: 1 },
    });
  });

  it('detects enemy moving onto a player before player movement', () => {
    const base = makeState(['#######', '#P 12 #', '#######'].join('\n'));
    const seeded = {
      ...base,
      players: [{ ...base.players[0], x: 4, y: 1 }],
    };

    const impact = detectEnemyImpact(seeded, 'left');
    expect(impact).toEqual({
      playerId: 0,
      enemyId: 0,
      intersection: { x: 4, y: 1 },
      playerFrom: { x: 4, y: 1 },
      enemyFrom: { x: 3, y: 1 },
    });
  });

  it('returns null when reset cause is not enemy contact', () => {
    const lava = makeState(['#####', '#Px #', '#####'].join('\n'));
    const impact = detectEnemyImpact(lava, 'right');
    expect(impact).toBeNull();
  });
});

describe('lava impact detection', () => {
  it('detects player stepping into lava tile', () => {
    const state = makeState(['######', '#Px  #', '######'].join('\n'));
    const impact = detectLavaImpact(state, 'right');

    expect(impact).toEqual({
      playerId: 0,
      intersection: { x: 2, y: 1 },
      playerFrom: { x: 1, y: 1 },
    });
  });

  it('returns null when enemy touch causes the reset', () => {
    const initial = makeState(['######', '#P12 #', '######'].join('\n'));
    const afterFirstMove = update(initial, { direction: 'right' }, 16.67);

    const impact = detectLavaImpact(afterFirstMove, 'right');
    expect(impact).toBeNull();
  });
});

describe('goal finish impact detection', () => {
  it('detects the final player entering the goal tile', () => {
    const state = makeState(['#####', '#P! #', '#####'].join('\n'));
    const impact = detectGoalFinishImpact(state, 'right');

    expect(impact).toEqual({
      playerId: 0,
      portal: { x: 2, y: 1 },
      playerFrom: { x: 1, y: 1 },
    });
  });

  it('returns null when move does not complete the level', () => {
    const state = makeState(['######', '#P ! #', '######'].join('\n'));
    const impact = detectGoalFinishImpact(state, 'right');
    expect(impact).toBeNull();
  });
});
