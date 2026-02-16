export type MusicVariant = 0 | 1 | 2 | 3;

const BUILT_IN_LEVEL_NAMES: Record<string, string> = {
  map0: 'Relay Threshold',
  map1: 'Mirror Lift',
  map2: 'Furnace Bend',
  map3: 'Twin Ramps',
  map4: 'Split Current',
  map5: 'Lattice Vault',
  map6: 'Signal Choke',
  map7: 'Crosswind Loop',
  map8: 'Pulse Gallery',
  map9: 'Ash Corridor',
  map10: 'Echo Grid',
  map11: 'Fracture Gate',
  map12: 'Core Finale',
};

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getLevelName(levelId: string, levelIndex: number): string {
  return BUILT_IN_LEVEL_NAMES[levelId] ?? `Custom Circuit ${levelIndex + 1}`;
}

export function getLevelLabel(levelId: string, levelIndex: number): string {
  return `Level ${levelIndex + 1}: ${getLevelName(levelId, levelIndex)}`;
}

export function getMusicVariant(levelId: string, levelIndex: number): MusicVariant {
  const knownOrder: MusicVariant[] = [0, 1, 2, 3, 1, 2, 0, 3, 2, 1, 0, 3, 2];
  if (levelId.startsWith('map')) {
    const numeric = Number.parseInt(levelId.slice(3), 10);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < knownOrder.length) {
      return knownOrder[numeric];
    }
  }

  const fallback = (stableHash(levelId) + levelIndex) % 4;
  return fallback as MusicVariant;
}
