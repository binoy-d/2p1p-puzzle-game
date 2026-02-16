import { describe, expect, it } from 'vitest';
import {
  LEVEL_TRANSITION_PROFILE,
  shouldTriggerLevelTransition,
} from '../../src/runtime/levelTransition';

describe('level transition decision', () => {
  it('uses a quick fade + zoom profile', () => {
    expect(LEVEL_TRANSITION_PROFILE.fadeOutMs).toBeGreaterThan(0);
    expect(LEVEL_TRANSITION_PROFILE.fadeOutMs).toBeLessThan(200);
    expect(LEVEL_TRANSITION_PROFILE.fadeInMs).toBeLessThan(240);
    expect(LEVEL_TRANSITION_PROFILE.zoomFrom).toBeGreaterThan(1);
    expect(LEVEL_TRANSITION_PROFILE.zoomTo).toBe(1);
  });

  it('triggers when entering gameplay from a menu-like screen', () => {
    expect(
      shouldTriggerLevelTransition({
        previousScreen: 'main',
        nextScreen: 'playing',
        previousLevelId: 'map0',
        nextLevelId: 'map0',
      }),
    ).toBe(true);
  });

  it('triggers when level id changes during gameplay', () => {
    expect(
      shouldTriggerLevelTransition({
        previousScreen: 'playing',
        nextScreen: 'playing',
        previousLevelId: 'map0',
        nextLevelId: 'map1',
      }),
    ).toBe(true);
  });

  it('does not trigger on resume from pause or non-playing screens', () => {
    expect(
      shouldTriggerLevelTransition({
        previousScreen: 'paused',
        nextScreen: 'playing',
        previousLevelId: 'map0',
        nextLevelId: 'map0',
      }),
    ).toBe(false);

    expect(
      shouldTriggerLevelTransition({
        previousScreen: 'playing',
        nextScreen: 'paused',
        previousLevelId: 'map0',
        nextLevelId: 'map1',
      }),
    ).toBe(false);

    expect(
      shouldTriggerLevelTransition({
        previousScreen: null,
        nextScreen: 'playing',
        previousLevelId: null,
        nextLevelId: 'map0',
      }),
    ).toBe(false);
  });
});
