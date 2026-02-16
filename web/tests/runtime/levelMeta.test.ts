import { describe, expect, it } from 'vitest';
import { getLevelLabel, getLevelMusicSeed, getLevelName } from '../../src/runtime/levelMeta';

describe('level metadata helpers', () => {
  it('returns named labels for built-in maps', () => {
    expect(getLevelName('map0', 0)).toBe('Relay Threshold');
    expect(getLevelLabel('map12', 12)).toMatch(/Core Finale/);
  });

  it('returns fallback naming for custom levels', () => {
    expect(getLevelName('custom-grid-1', 5)).toBe('Custom Circuit 6');
  });

  it('returns stable non-zero music seeds', () => {
    const a = getLevelMusicSeed('custom-grid-1', 5);
    const b = getLevelMusicSeed('custom-grid-1', 5);
    const c = getLevelMusicSeed('custom-grid-2', 5);
    const builtIn = getLevelMusicSeed('map0', 0);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThan(0);
    expect(builtIn).toBeGreaterThan(0);
  });
});
