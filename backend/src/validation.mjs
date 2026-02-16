const LEVEL_ID_RE = /^[a-z0-9_-]{3,64}$/;
const TILE_RE = /^[# !xP1-9]$/;

function sanitizeName(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function validatePlayerName(input) {
  const value = sanitizeName(input);
  if (value.length < 2) {
    throw new Error('Player name must be at least 2 characters.');
  }

  return value;
}

export function validateLevelId(input) {
  if (typeof input !== 'string') {
    throw new Error('Level id must be a string.');
  }

  const trimmed = input.trim().toLowerCase();
  if (!LEVEL_ID_RE.test(trimmed)) {
    throw new Error('Level id must use lowercase letters, numbers, underscore, or dash (3-64 chars).');
  }

  return trimmed;
}

export function validateLevelText(input) {
  if (typeof input !== 'string') {
    throw new Error('Level text must be a string.');
  }

  const normalized = input.replace(/\r/g, '');
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    throw new Error('Level text is empty.');
  }

  const width = lines[0].length;
  if (width < 3) {
    throw new Error('Level width must be at least 3.');
  }

  let players = 0;
  for (let y = 0; y < lines.length; y += 1) {
    const line = lines[y];
    if (line.length !== width) {
      throw new Error(`Level row ${y + 1} width mismatch.`);
    }

    for (let x = 0; x < line.length; x += 1) {
      const tile = line[x];
      if (!TILE_RE.test(tile)) {
        throw new Error(`Invalid tile '${tile}' at ${x + 1},${y + 1}.`);
      }
      if (tile === 'P') {
        players += 1;
      }
    }
  }

  if (players === 0) {
    throw new Error('Level needs at least one player spawn (P).');
  }

  return lines.join('\n');
}

export function validateLevelPayload(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Level payload must be an object.');
  }

  return {
    id: validateLevelId(input.id),
    name: sanitizeName(input.name || input.id).slice(0, 64) || validateLevelId(input.id),
    text: validateLevelText(input.text),
    authorName: validatePlayerName(input.authorName),
  };
}

export function validateScorePayload(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Score payload must be an object.');
  }

  const levelId = validateLevelId(input.levelId);
  const playerName = validatePlayerName(input.playerName);
  const moves = Number.parseInt(String(input.moves), 10);
  const durationMs = Number.parseInt(String(input.durationMs), 10);

  if (!Number.isInteger(moves) || moves < 0 || moves > 1000000) {
    throw new Error('Moves must be a non-negative integer.');
  }

  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > 86400000) {
    throw new Error('Duration must be between 0 and 86400000 ms.');
  }

  return {
    levelId,
    playerName,
    moves,
    durationMs,
  };
}
