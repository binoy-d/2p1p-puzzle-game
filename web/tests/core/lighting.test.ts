import { describe, expect, it } from 'vitest';
import { lightAtPoint, lightContribution, tileShade } from '../../src/core/lighting';

describe('lighting math', () => {
  it('returns full contribution at source center', () => {
    const contribution = lightContribution({ x: 5, y: 5 }, { x: 5, y: 5, radius: 4, intensity: 1 }, 2);
    expect(contribution).toBeCloseTo(1, 5);
  });

  it('returns zero outside radius', () => {
    const contribution = lightContribution({ x: 10, y: 10 }, { x: 5, y: 5, radius: 3, intensity: 1 }, 2);
    expect(contribution).toBe(0);
  });

  it('aggregates multiple lights with ambient clamp', () => {
    const strength = lightAtPoint(
      { x: 0, y: 0 },
      [
        { x: 0, y: 0, radius: 4, intensity: 0.8 },
        { x: 1, y: 1, radius: 4, intensity: 0.8 },
      ],
      { ambient: 0.1, falloffExponent: 2 },
    );

    expect(strength).toBeLessThanOrEqual(1);
    expect(strength).toBeGreaterThan(0.8);
    expect(tileShade(strength)).toBeGreaterThan(200);
  });
});
