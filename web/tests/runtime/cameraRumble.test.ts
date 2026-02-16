import { describe, expect, it } from 'vitest';
import { createInitialState, parseLevelText } from '../../src/core';
import { resolveCameraRumble } from '../../src/runtime/cameraRumble';
import type { GameState, TurnEvent } from '../../src/core/types';

function makeState(): GameState {
  const level = parseLevelText('map0', ['#####', '#P !#', '#####'].join('\n'));
  return createInitialState([level], 0);
}

function withEvent(state: GameState, lastEvent: TurnEvent): GameState {
  return {
    ...state,
    lastEvent,
  };
}

describe('camera rumble', () => {
  it('does not rumble outside gameplay screen', () => {
    const base = makeState();
    const next = withEvent(base, 'turn-processed');
    expect(resolveCameraRumble('paused', base, next)).toBeNull();
    expect(resolveCameraRumble('main', base, next)).toBeNull();
  });

  it('does not rumble without state transition', () => {
    const base = makeState();
    expect(resolveCameraRumble('playing', null, base)).toBeNull();
    expect(resolveCameraRumble('playing', base, base)).toBeNull();
  });

  it('maps turn events to rumble profiles', () => {
    const base = makeState();

    expect(resolveCameraRumble('playing', base, withEvent(base, 'turn-processed'))).toEqual({
      durationMs: 84,
      intensity: 0.0017,
      minIntervalMs: 88,
    });
    expect(resolveCameraRumble('playing', base, withEvent(base, 'level-reset'))).toEqual({
      durationMs: 160,
      intensity: 0.0048,
    });
    expect(resolveCameraRumble('playing', base, withEvent(base, 'level-advanced'))).toEqual({
      durationMs: 132,
      intensity: 0.0031,
    });
    expect(resolveCameraRumble('playing', base, withEvent(base, 'game-complete'))).toEqual({
      durationMs: 190,
      intensity: 0.0056,
    });
    expect(resolveCameraRumble('playing', base, withEvent(base, 'none'))).toBeNull();
  });
});
