import { describe, expect, it } from 'vitest';
import { parseLevelText } from '../../src/core/levelParser';
import { GameController } from '../../src/app/gameController';

function makeController() {
  const levels = [
    parseLevelText('map0', ['#####', '#P!##', '#####'].join('\n')),
    parseLevelText('map1', ['#####', '#P ##', '#####'].join('\n')),
  ];

  return new GameController(levels, {
    volume: 0.5,
    lightingEnabled: true,
  });
}

describe('game controller', () => {
  it('switches to editor screen', () => {
    const controller = makeController();
    controller.openEditor();
    expect(controller.getSnapshot().screen).toBe('editor');
  });

  it('upserts level and rebuilds playable state', () => {
    const controller = makeController();
    const custom = parseLevelText('custom-level-1', ['#####', '#P !#', '#####'].join('\n'));

    const index = controller.upsertLevel(custom);
    const snapshot = controller.getSnapshot();

    expect(index).toBe(2);
    expect(snapshot.levels).toHaveLength(3);
    expect(snapshot.selectedLevelIndex).toBe(2);
    expect(snapshot.gameState.levelId).toBe('custom-level-1');

    controller.setPlayerName('Tester');
    controller.startLevel(index);
    expect(controller.getSnapshot().screen).toBe('playing');
    expect(controller.getSnapshot().gameState.levelId).toBe('custom-level-1');
  });

  it('updates existing level by id', () => {
    const controller = makeController();
    const replacement = parseLevelText('map1', ['#####', '#P!##', '#####'].join('\n'));

    const index = controller.upsertLevel(replacement);
    expect(index).toBe(1);
    expect(controller.getSnapshot().levels[1].grid[1][2]).toBe('!');
  });

  it('requires a player name before starting gameplay', () => {
    const controller = makeController();

    controller.startSelectedLevel();
    expect(controller.getSnapshot().screen).toBe('main');
    expect(controller.getSnapshot().statusMessage).toMatch(/player name/i);

    controller.setPlayerName('Ava');
    controller.startSelectedLevel();
    expect(controller.getSnapshot().screen).toBe('playing');
  });
});
