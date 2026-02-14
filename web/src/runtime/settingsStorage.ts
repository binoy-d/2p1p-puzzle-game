export interface GameSettings {
  volume: number;
  lightingEnabled: boolean;
}

const STORAGE_KEY = 'puzzle-game-settings-v1';

const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.6,
  lightingEnabled: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      volume:
        typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : DEFAULT_SETTINGS.volume,
      lightingEnabled:
        typeof parsed.lightingEnabled === 'boolean'
          ? parsed.lightingEnabled
          : DEFAULT_SETTINGS.lightingEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getDefaultSettings(): GameSettings {
  return { ...DEFAULT_SETTINGS };
}
