const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export interface BackendLevelRecord {
  id: string;
  name: string;
  text: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
}

export interface LevelScoreRecord {
  playerName: string;
  moves: number;
  durationMs: number;
  createdAt: number;
}

interface ErrorPayload {
  error?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const error = (await response.json()) as ErrorPayload;
      if (error?.error) {
        detail = error.error;
      }
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function fetchCustomLevels(): Promise<BackendLevelRecord[]> {
  const payload = await requestJson<{ levels: BackendLevelRecord[] }>('/levels');
  return payload.levels;
}

export async function saveCustomLevel(input: {
  id: string;
  name: string;
  text: string;
  authorName: string;
}): Promise<BackendLevelRecord> {
  const payload = await requestJson<{ level: BackendLevelRecord }>('/levels', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return payload.level;
}

export async function fetchTopScores(levelId: string): Promise<LevelScoreRecord[]> {
  const payload = await requestJson<{ levelId: string; scores: LevelScoreRecord[] }>(
    `/scores/${encodeURIComponent(levelId)}`,
  );
  return payload.scores;
}

export async function submitScore(input: {
  levelId: string;
  playerName: string;
  moves: number;
  durationMs: number;
}): Promise<LevelScoreRecord[]> {
  const payload = await requestJson<{ levelId: string; scores: LevelScoreRecord[] }>('/scores', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return payload.scores;
}
