export interface EnemyPosition {
  x: number;
  y: number;
}

export interface EnemyPathTarget {
  x: number;
  y: number;
  value: number;
}

const PATH_DOMAIN = 17;

function normalizePathValue(raw: number): number | null {
  if (!Number.isInteger(raw) || raw <= 0) {
    return null;
  }

  return ((raw - 1) % PATH_DOMAIN) + 1;
}

export function predictEnemyNextTile(enemy: EnemyPosition, grid: string[][]): EnemyPosition | null {
  const currentRaw = grid[enemy.y]?.[enemy.x];
  const parsedCurrent = Number.parseInt(currentRaw, 10);
  const normalizedCurrent = normalizePathValue(parsedCurrent);
  if (normalizedCurrent === null) {
    return null;
  }

  let currentValue = normalizedCurrent;
  for (let row = enemy.y - 1; row <= enemy.y + 1; row += 1) {
    for (let col = enemy.x - 1; col <= enemy.x + 1; col += 1) {
      const candidateRaw = grid[row]?.[col];
      const candidateValue = normalizePathValue(Number.parseInt(candidateRaw ?? '', 10));
      if (candidateValue !== null && candidateValue - 1 === currentValue) {
        return { x: col, y: row };
      }

      if (currentValue === PATH_DOMAIN) {
        currentValue = 1;
      }
    }
  }

  return null;
}

export function collectEnemyPathTargets(enemies: EnemyPosition[], grid: string[][]): EnemyPathTarget[] {
  const targets: EnemyPathTarget[] = [];

  for (const enemy of enemies) {
    const next = predictEnemyNextTile(enemy, grid);
    if (!next) {
      continue;
    }

    const rawTargetValue = Number.parseInt(grid[next.y]?.[next.x] ?? '', 10);
    const normalizedValue = normalizePathValue(rawTargetValue);
    if (normalizedValue === null) {
      continue;
    }

    targets.push({
      ...next,
      value: normalizedValue,
    });
  }

  return targets;
}

export function pathDistanceFromNextHit(tileValue: number, targetValues: number[]): number | null {
  const normalizedTile = normalizePathValue(tileValue);
  if (normalizedTile === null || targetValues.length === 0) {
    return null;
  }

  let nearest = PATH_DOMAIN;
  for (const target of targetValues) {
    const normalizedTarget = normalizePathValue(target);
    if (normalizedTarget === null) {
      continue;
    }

    const distance = (normalizedTile - normalizedTarget + PATH_DOMAIN) % PATH_DOMAIN;
    if (distance < nearest) {
      nearest = distance;
    }
  }

  return nearest;
}

export function computePathDotOpacity(distanceFromNext: number | null): number {
  if (distanceFromNext === null) {
    return 0.22;
  }

  if (distanceFromNext === 0) {
    return 1;
  }

  return Math.max(0.16, 0.92 * Math.pow(0.82, distanceFromNext));
}

export function computePathDotScale(distanceFromNext: number | null, timeMs: number, phaseSeed: number): number {
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 170 + phaseSeed);

  if (distanceFromNext === null) {
    return 0.18 + pulse * 0.015;
  }

  if (distanceFromNext === 0) {
    return 0.34 + pulse * 0.09;
  }

  const proximity = 1 - Math.min(distanceFromNext, 10) / 10;
  return 0.2 + proximity * 0.12 + pulse * 0.03;
}
