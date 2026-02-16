import type { Screen } from '../app/gameController';
import type { GameState, TurnEvent } from '../core/types';

export interface CameraRumbleProfile {
  durationMs: number;
  intensity: number;
}

const RUMBLE_BY_EVENT: Partial<Record<TurnEvent, CameraRumbleProfile>> = {
  'turn-processed': {
    durationMs: 95,
    intensity: 0.0026,
  },
  'level-reset': {
    durationMs: 180,
    intensity: 0.0062,
  },
  'level-advanced': {
    durationMs: 150,
    intensity: 0.0038,
  },
  'game-complete': {
    durationMs: 220,
    intensity: 0.007,
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
