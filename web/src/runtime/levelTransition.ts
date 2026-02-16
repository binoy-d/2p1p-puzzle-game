import type { Screen } from '../app/gameController';

export interface LevelTransitionDecisionInput {
  previousScreen: Screen | null;
  nextScreen: Screen;
  previousLevelId: string | null;
  nextLevelId: string;
}

export interface LevelTransitionProfile {
  fadeOutMs: number;
  blackHoldMs: number;
  fadeInMs: number;
  zoomFrom: number;
  zoomTo: number;
  zoomMs: number;
  zoomEase: string;
}

export const LEVEL_TRANSITION_PROFILE: LevelTransitionProfile = {
  fadeOutMs: 120,
  blackHoldMs: 34,
  fadeInMs: 170,
  zoomFrom: 1.24,
  zoomTo: 1,
  zoomMs: 260,
  zoomEase: 'Cubic.easeOut',
};

export function shouldTriggerLevelTransition(input: LevelTransitionDecisionInput): boolean {
  if (!input.previousScreen) {
    return false;
  }

  if (input.nextScreen !== 'playing') {
    return false;
  }

  if (input.previousScreen === 'paused') {
    return false;
  }

  if (input.previousScreen !== 'playing') {
    return true;
  }

  return input.previousLevelId !== null && input.previousLevelId !== input.nextLevelId;
}
