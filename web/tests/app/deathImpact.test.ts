import { describe, expect, it } from 'vitest';
import { createInitialState, parseLevelText, update } from '../../src/core';
import { detectEnemyImpact } from '../../src/app/deathImpact';

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
