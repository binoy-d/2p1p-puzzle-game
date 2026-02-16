import { describe, expect, it } from 'vitest';
import {
  collectEnemyPathTargets,
  computePathDotOpacity,
  computePathDotScale,
  pathDistanceFromNextHit,
  predictEnemyNextTile,
} from '../../src/runtime/enemyPathVisuals';

describe('enemy path visuals', () => {
  it('predicts next tile from enemy numeric path rules', () => {
    const grid = [
      ['#', '#', '#', '#', '#'],
      ['#', '1', '2', '3', '#'],
      ['#', '#', '#', '#', '#'],
    ];

    const target = predictEnemyNextTile({ x: 1, y: 1 }, grid);
    expect(target).toEqual({ x: 2, y: 1 });
  });

  it('returns null when enemy is not on a numeric path tile', () => {
    const grid = [
      ['#', '#', '#'],
      ['#', 'P', '#'],
      ['#', '#', '#'],
    ];

    const target = predictEnemyNextTile({ x: 1, y: 1 }, grid);
    expect(target).toBeNull();
  });

  it('collects target coordinates and values for multiple enemies', () => {
    const grid = [
      ['#', '#', '#', '#', '#'],
      ['#', '1', '2', '3', '#'],
      ['#', '1', '2', '3', '#'],
      ['#', '#', '#', '#', '#'],
    ];

    const targets = collectEnemyPathTargets(
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      grid,
    );

    expect(targets).toEqual([
      { x: 2, y: 1, value: 2 },
      { x: 2, y: 1, value: 2 },
    ]);
  });

  it('computes wrap-aware distance from next hit', () => {
    expect(pathDistanceFromNextHit(2, [2])).toBe(0);
    expect(pathDistanceFromNextHit(5, [2])).toBe(3);
    expect(pathDistanceFromNextHit(1, [17])).toBe(1);
    expect(pathDistanceFromNextHit(17, [1])).toBe(16);
    expect(pathDistanceFromNextHit(9, [])).toBeNull();
  });

  it('makes immediate target fully opaque and distant dots less opaque', () => {
    const targetOpacity = computePathDotOpacity(0);
    const midOpacity = computePathDotOpacity(4);
    const farOpacity = computePathDotOpacity(12);

    expect(targetOpacity).toBe(1);
    expect(midOpacity).toBeLessThan(targetOpacity);
    expect(farOpacity).toBeLessThan(midOpacity);
    expect(farOpacity).toBeGreaterThanOrEqual(0.16);
  });

  it('uses larger pulsing scale for imminent hit dot', () => {
    const nearA = computePathDotScale(0, 150, 0.1);
    const nearB = computePathDotScale(0, 890, 0.1);
    const far = computePathDotScale(8, 150, 0.1);

    expect(nearA).toBeGreaterThan(far);
    expect(nearB).toBeGreaterThan(far);
    expect(Math.abs(nearA - nearB)).toBeGreaterThan(0.01);
  });
});
