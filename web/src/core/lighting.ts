import type { LightSource, LightingConfig, Vec2 } from './types';

const DEFAULT_LIGHTING: LightingConfig = {
  ambient: 0.08,
  falloffExponent: 2,
};

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function lightContribution(point: Vec2, source: LightSource, falloffExponent = 2): number {
  const dx = point.x - source.x;
  const dy = point.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance >= source.radius) {
    return 0;
  }

  const ratio = 1 - distance / source.radius;
  return source.intensity * Math.pow(ratio, falloffExponent);
}

export function lightAtPoint(
  point: Vec2,
  sources: LightSource[],
  config: Partial<LightingConfig> = {},
): number {
  const merged: LightingConfig = { ...DEFAULT_LIGHTING, ...config };
  let total = merged.ambient;

  for (const source of sources) {
    total += lightContribution(point, source, merged.falloffExponent);
  }

  return clamp01(total);
}

export function tileShade(lightStrength: number): number {
  const clamped = clamp01(lightStrength);
  return Math.round(255 * clamped);
}
