import { parseLevelText } from '../core/levelParser';
import type { ParsedLevel } from '../core/types';

const STORAGE_KEY = 'puzzle-game-custom-levels-v1';

export interface StoredCustomLevel {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
}

function isStoredCustomLevel(input: unknown): input is StoredCustomLevel {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const candidate = input as Partial<StoredCustomLevel>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.updatedAt === 'number'
  );
}

export function loadStoredCustomLevels(): StoredCustomLevel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isStoredCustomLevel)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((level) => ({ ...level }));
  } catch {
    return [];
  }
}

function writeStoredCustomLevels(levels: StoredCustomLevel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
}

export function upsertStoredCustomLevel(level: StoredCustomLevel): StoredCustomLevel[] {
  const existing = loadStoredCustomLevels();
  const index = existing.findIndex((item) => item.id === level.id);

  if (index === -1) {
    existing.push(level);
  } else {
    existing[index] = level;
  }

  writeStoredCustomLevels(existing);
  return existing;
}

export function removeStoredCustomLevel(id: string): StoredCustomLevel[] {
  const next = loadStoredCustomLevels().filter((level) => level.id !== id);
  writeStoredCustomLevels(next);
  return next;
}

export function parseStoredCustomLevels(levels: StoredCustomLevel[]): ParsedLevel[] {
  const parsed: ParsedLevel[] = [];

  for (const level of levels) {
    try {
      parsed.push(parseLevelText(level.id, level.text));
    } catch {
      // Skip invalid level payloads and continue loading valid ones.
    }
  }

  return parsed;
}
