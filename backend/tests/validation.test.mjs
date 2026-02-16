import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateLevelId,
  validateLevelPayload,
  validatePlayerName,
  validateScorePayload,
} from '../src/validation.mjs';

test('validates and normalizes level id and player name', () => {
  assert.equal(validateLevelId('custom-level_1'), 'custom-level_1');
  assert.equal(validatePlayerName('  Ava   Lane  '), 'Ava Lane');
});

test('rejects invalid level payloads', () => {
  assert.throws(
    () =>
      validateLevelPayload({
        id: 'bad id',
        name: 'Bad',
        text: '#',
        authorName: 'Ava',
      }),
    /level id/i,
  );

  assert.throws(
    () =>
      validateLevelPayload({
        id: 'custom-level-1',
        name: 'Bad',
        text: ['###', '# #', '###'].join('\n'),
        authorName: 'Ava',
      }),
    /player spawn/i,
  );
});

test('validates score payload constraints', () => {
  const score = validateScorePayload({
    levelId: 'map1',
    playerName: 'Binoy',
    moves: 22,
    durationMs: 45000,
  });

  assert.equal(score.moves, 22);
  assert.equal(score.durationMs, 45000);

  assert.throws(
    () =>
      validateScorePayload({
        levelId: 'map1',
        playerName: 'X',
        moves: -1,
        durationMs: 10,
      }),
    /player name|moves/i,
  );
});
