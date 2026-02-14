import { update } from './engine';
import type { GameState, UpdateInput } from './types';

export function simulate(
  initialState: GameState,
  inputs: UpdateInput[],
  dtMs = 16.6667,
): GameState[] {
  const history: GameState[] = [initialState];
  let current = initialState;

  for (const input of inputs) {
    current = update(current, input, dtMs);
    history.push(current);
  }

  return history;
}

export function stateSnapshot(state: GameState): Record<string, unknown> {
  return {
    levelId: state.levelId,
    levelIndex: state.levelIndex,
    status: state.status,
    players: state.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
    enemies: state.enemies.map((enemy) => ({ id: enemy.id, x: enemy.x, y: enemy.y })),
    playersDone: state.playersDone,
    totalPlayers: state.totalPlayers,
    moves: state.moves,
    tick: state.tick,
    lastEvent: state.lastEvent,
    grid: state.grid,
  };
}
