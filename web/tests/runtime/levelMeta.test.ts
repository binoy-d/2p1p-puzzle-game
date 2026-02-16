import { describe, expect, it } from 'vitest';
import { getLevelLabel, getLevelName, getMusicVariant } from '../../src/runtime/levelMeta';

describe('level metadata helpers', () => {
  it('returns named labels for built-in maps', () => {
    expect(getLevelName('map0', 0)).toBe('Relay Threshold');
    expect(getLevelLabel('map12', 12)).toMatch(/Core Finale/);
  });

  it('returns fallback naming for custom levels', () => {
    expect(getLevelName('custom-grid-1', 5)).toBe('Custom Circuit 6');
  });

  it('returns stable music variants for custom levels', () => {
    const a = getMusicVariant('custom-grid-1', 5);
    const b = getMusicVariant('custom-grid-1', 5);
    const c = getMusicVariant('custom-grid-2', 5);
    expect(a).toBe(b);
    expect([0, 1, 2, 3]).toContain(a);
    expect([0, 1, 2, 3]).toContain(c);
  });
});
