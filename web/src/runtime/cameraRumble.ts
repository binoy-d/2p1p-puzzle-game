import type { Screen } from '../app/gameController';
import type { GameState, TurnEvent } from '../core/types';

export interface CameraRumbleProfile {
  durationMs: number;
  intensity: number;
  minIntervalMs?: number;
}

const RUMBLE_BY_EVENT: Partial<Record<TurnEvent, CameraRumbleProfile>> = {
  'turn-processed': {
    durationMs: 84,
    intensity: 0.0017,
    minIntervalMs: 88,
  },
  'level-reset': {
    durationMs: 160,
    intensity: 0.0048,
  },
  'level-advanced': {
    durationMs: 132,
    intensity: 0.0031,
  },
  'game-complete': {
    durationMs: 190,
    intensity: 0.0056,
  },
};

export function resolveCameraRumble(
  screen: Screen,
  previousState: GameState | null,
  nextState: GameState,
): CameraRumbleProfile | null {
  if (screen !== 'playing') {
    return null;
  }

  if (!previousState || previousState === nextState) {
    return null;
  }

  return RUMBLE_BY_EVENT[nextState.lastEvent] ?? null;
}
