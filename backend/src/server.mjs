import { createServer } from 'node:http';
import { URL } from 'node:url';
import { DEFAULT_PORT, DB_PATH } from './config.mjs';
import { createDatabase } from './db.mjs';
import { validateLevelPayload, validateLevelId, validateScorePayload } from './validation.mjs';

const db = createDatabase(DB_PATH);

function withCors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, withCors({ 'Content-Type': 'application/json; charset=utf-8' }));
  res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
  res.writeHead(204, withCors());
  res.end();
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    notFound(res);
    return;
  }

  if (req.method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/levels') {
      sendJson(res, 200, { levels: db.listLevels() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/levels') {
      const body = await readJsonBody(req);
      const payload = validateLevelPayload(body);
      const saved = db.upsertLevel(payload);
      sendJson(res, 200, { level: saved });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/scores/')) {
      const levelId = validateLevelId(pathname.slice('/api/scores/'.length));
      const scores = db.getTopScores(levelId, 10);
      sendJson(res, 200, { levelId, scores });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/scores') {
      const body = await readJsonBody(req);
      const payload = validateScorePayload(body);
      db.insertScore(payload);
      const scores = db.getTopScores(payload.levelId, 10);
      sendJson(res, 201, { levelId: payload.levelId, scores });
      return;
    }

    notFound(res);
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : 'Invalid request',
    });
  }
});

server.listen(DEFAULT_PORT, () => {
  console.log(`Backend listening on http://localhost:${DEFAULT_PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
