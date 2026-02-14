import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cloneParsedLevel, parseLevelText, serializeParsedLevel } from '../../src/core/levelParser';

describe('level parser', () => {
  it('parses player and enemy spawns', () => {
    const raw = ['#####', '#P1!#', '# x #', '#####'].join('\n');
    const level = parseLevelText('sample', raw);

    expect(level.width).toBe(5);
    expect(level.height).toBe(4);
    expect(level.playerSpawns).toEqual([{ x: 1, y: 1 }]);
    expect(level.enemySpawns).toEqual([{ x: 2, y: 1 }]);
    expect(level.grid[1][3]).toBe('!');
  });

  it('rejects ragged levels', () => {
    const raw = ['#####', '#P #', '#####'].join('\n');
    expect(() => parseLevelText('ragged', raw)).toThrow(/ragged/i);
  });

  it('rejects unknown characters', () => {
    const raw = ['#####', '#P@ #', '#####'].join('\n');
    expect(() => parseLevelText('invalid', raw)).toThrow(/invalid tile/i);
  });

  it('rejects levels without a player spawn', () => {
    const raw = ['#####', '# 1 #', '#####'].join('\n');
    expect(() => parseLevelText('no-player', raw)).toThrow(/no player spawn/i);
  });

  it('rejects empty and zero-width levels', () => {
    expect(() => parseLevelText('empty', '')).toThrow(/empty/i);
    expect(() => parseLevelText('zero-width', '\n\n')).toThrow(/zero width/i);
  });

  it('deep-clones parsed levels', () => {
    const parsed = parseLevelText('clone', ['#####', '#P1 #', '#####'].join('\n'));
    const cloned = cloneParsedLevel(parsed);

    cloned.grid[1][1] = 'x';
    cloned.playerSpawns[0].x = 99;
    cloned.enemySpawns[0].y = 99;

    expect(parsed.grid[1][1]).toBe('P');
    expect(parsed.playerSpawns[0].x).toBe(1);
    expect(parsed.enemySpawns[0].y).toBe(1);
  });

  it('roundtrips valid generated levels', () => {
    const tileArb = fc.constantFrom(
      '#',
      ' ',
      '!',
      'x',
      'P',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    );

    const generated = fc
      .record({
        width: fc.integer({ min: 2, max: 8 }),
        height: fc.integer({ min: 2, max: 8 }),
      })
      .chain(({ width, height }) =>
        fc.array(fc.array(tileArb, { minLength: width, maxLength: width }), {
          minLength: height,
          maxLength: height,
        }),
      )
      .map((rows) => {
        rows[0][0] = 'P';
        return rows.map((row) => row.join('')).join('\n');
      });

    fc.assert(
      fc.property(generated, (raw) => {
        const parsed = parseLevelText('generated', raw);
        const serialized = serializeParsedLevel(parsed);
        expect(serialized).toEqual(raw);
      }),
      { numRuns: 80 },
    );
  });
});
