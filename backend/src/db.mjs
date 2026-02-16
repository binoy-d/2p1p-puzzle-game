import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createDatabase(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_levels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      author_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS level_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      moves INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_level_scores_rank
      ON level_scores(level_id, moves ASC, duration_ms ASC, created_at ASC);
  `);

  const listLevelsStmt = db.prepare(`
    SELECT id, name, text, author_name AS authorName, created_at AS createdAt, updated_at AS updatedAt
    FROM user_levels
    ORDER BY updated_at DESC;
  `);

  const upsertLevelStmt = db.prepare(`
    INSERT INTO user_levels(id, name, text, author_name, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      text=excluded.text,
      author_name=excluded.author_name,
      updated_at=excluded.updated_at;
  `);

  const getLevelStmt = db.prepare(`
    SELECT id, name, text, author_name AS authorName, created_at AS createdAt, updated_at AS updatedAt
    FROM user_levels
    WHERE id = ?;
  `);

  const insertScoreStmt = db.prepare(`
    INSERT INTO level_scores(level_id, player_name, moves, duration_ms, created_at)
    VALUES(?, ?, ?, ?, ?);
  `);

  const topScoresStmt = db.prepare(`
    SELECT player_name AS playerName, moves, duration_ms AS durationMs, created_at AS createdAt
    FROM level_scores
    WHERE level_id = ?
    ORDER BY moves ASC, duration_ms ASC, created_at ASC
    LIMIT ?;
  `);

  return {
    listLevels() {
      return listLevelsStmt.all();
    },

    upsertLevel(level) {
      const now = Date.now();
      const existing = getLevelStmt.get(level.id);
      const createdAt = existing?.createdAt ?? now;
      upsertLevelStmt.run(level.id, level.name, level.text, level.authorName, createdAt, now);
      return getLevelStmt.get(level.id);
    },

    insertScore(score) {
      const now = Date.now();
      insertScoreStmt.run(score.levelId, score.playerName, score.moves, score.durationMs, now);
    },

    getTopScores(levelId, limit = 10) {
      return topScoresStmt.all(levelId, limit);
    },
  };
}
