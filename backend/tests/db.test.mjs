import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDatabase } from '../src/db.mjs';

function makeTempPath(name) {
  return join(tmpdir(), `puzzle-backend-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
}

test('upserts levels and returns latest level payload', () => {
  const path = makeTempPath('levels');
  const db = createDatabase(path);

  const first = db.upsertLevel({
    id: 'custom-level-1',
    name: 'First',
    text: ['###', '#P#', '###'].join('\n'),
    authorName: 'Ava',
  });

  const second = db.upsertLevel({
    id: 'custom-level-1',
    name: 'First Updated',
    text: ['#####', '#P !#', '#####'].join('\n'),
    authorName: 'Ava',
  });

  assert.equal(first.id, 'custom-level-1');
  assert.equal(second.name, 'First Updated');
  assert.equal(db.listLevels().length, 1);

  rmSync(path, { force: true });
});

test('returns top 10 scores ordered by moves then duration then time', () => {
  const path = makeTempPath('scores');
  const db = createDatabase(path);

  for (let i = 0; i < 12; i += 1) {
    db.insertScore({
      levelId: 'map1',
      playerName: `P${i}`,
      moves: i % 3 === 0 ? 10 : 12 + i,
      durationMs: 10000 + i,
    });
  }

  db.insertScore({ levelId: 'map1', playerName: 'Fast', moves: 9, durationMs: 12000 });
  db.insertScore({ levelId: 'map1', playerName: 'Slow', moves: 20, durationMs: 9000 });

  const top = db.getTopScores('map1', 10);
  assert.equal(top.length, 10);
  assert.equal(top[0].playerName, 'Fast');
  assert.ok(top.every((score) => score.levelId === undefined));

  for (let i = 1; i < top.length; i += 1) {
    const prev = top[i - 1];
    const current = top[i];
    const prevRank = prev.moves * 100000000 + prev.durationMs;
    const currentRank = current.moves * 100000000 + current.durationMs;
    assert.ok(prevRank <= currentRank);
  }

  rmSync(path, { force: true });
});
