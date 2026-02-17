export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  lightingEnabled: boolean;
}

const STORAGE_KEY = 'puzzle-game-settings-v1';

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.85,
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
    const parsedWithLegacy = parsed as Partial<GameSettings> & { volume?: number };
    const musicVolume =
      typeof parsedWithLegacy.musicVolume === 'number'
        ? clamp(parsedWithLegacy.musicVolume, 0, 1)
        : typeof parsedWithLegacy.volume === 'number'
          ? clamp(parsedWithLegacy.volume, 0, 1)
          : DEFAULT_SETTINGS.musicVolume;

    const sfxVolume =
      typeof parsedWithLegacy.sfxVolume === 'number'
        ? clamp(parsedWithLegacy.sfxVolume, 0, 1)
        : DEFAULT_SETTINGS.sfxVolume;

    return {
      musicVolume,
      sfxVolume,
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
