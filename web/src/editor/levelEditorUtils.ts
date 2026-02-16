import { parseLevelText } from '../core/levelParser';

export const EDITOR_TILE_PALETTE = ['#', ' ', 'P', '!', 'x', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export type EditorTile = (typeof EDITOR_TILE_PALETTE)[number];

export interface GridValidation {
  errors: string[];
  warnings: string[];
}

const VALID_TILE_SET = new Set<string>(EDITOR_TILE_PALETTE);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeDimension(value: number, fallback: number, min = 4, max = 80): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return clamp(Math.round(value), min, max);
}

export function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

export function createGrid(width: number, height: number, fill: EditorTile = ' '): string[][] {
  const safeWidth = sanitizeDimension(width, 25);
  const safeHeight = sanitizeDimension(height, 16);

  return Array.from({ length: safeHeight }, () => Array.from({ length: safeWidth }, () => fill));
}

export function resizeGrid(grid: string[][], width: number, height: number, fill: EditorTile = ' '): string[][] {
  const safeWidth = sanitizeDimension(width, grid[0]?.length ?? 25);
  const safeHeight = sanitizeDimension(height, grid.length || 16);

  const resized: string[][] = [];
  for (let y = 0; y < safeHeight; y += 1) {
    const sourceRow = grid[y] ?? [];
    const row: string[] = [];
    for (let x = 0; x < safeWidth; x += 1) {
      row.push(sourceRow[x] ?? fill);
    }
    resized.push(row);
  }

  return resized;
}

export function serializeGrid(grid: string[][]): string {
  return grid.map((row) => row.join('')).join('\n');
}

export function parseTextToGrid(raw: string): string[][] {
  const normalized = raw.replace(/\r/g, '');
  const lines = normalized.split('\n');

  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    throw new Error('Level text is empty.');
  }

  const width = lines[0].length;
  if (width === 0) {
    throw new Error('Level text has zero width.');
  }

  for (let y = 0; y < lines.length; y += 1) {
    const line = lines[y];
    if (line.length !== width) {
      throw new Error(`Row ${y + 1} width ${line.length} does not match expected width ${width}.`);
    }

    for (let x = 0; x < line.length; x += 1) {
      const tile = line[x];
      if (!VALID_TILE_SET.has(tile)) {
        throw new Error(`Invalid tile '${tile}' at (${x + 1}, ${y + 1}).`);
      }
    }
  }

  return lines.map((line) => line.split(''));
}

export function validateGridForEditor(grid: string[][]): GridValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (grid.length === 0 || (grid[0]?.length ?? 0) === 0) {
    errors.push('Grid must be at least 1x1.');
    return { errors, warnings };
  }

  const width = grid[0].length;
  let players = 0;
  let goals = 0;
  let numeric = 0;
  let ones = 0;

  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (row.length !== width) {
      errors.push(`Row ${y + 1} is not the same width as row 1.`);
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (!VALID_TILE_SET.has(tile)) {
        errors.push(`Tile '${tile}' is invalid at (${x + 1}, ${y + 1}).`);
      }

      if (tile === 'P') {
        players += 1;
      }
      if (tile === '!') {
        goals += 1;
      }
      if (tile >= '1' && tile <= '9') {
        numeric += 1;
      }
      if (tile === '1') {
        ones += 1;
      }
    }
  }

  if (players === 0) {
    errors.push('At least one player spawn (P) is required.');
  }
  if (goals === 0) {
    warnings.push('No goal tile (!): this level cannot be completed.');
  }
  if (numeric > 0 && ones === 0) {
    warnings.push('Enemy path numbers exist but no 1 tile exists, so no enemy will spawn.');
  }

  return { errors, warnings };
}

export function levelIdFromInput(raw: string): string {
  const sanitized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'custom-level';
}

export function ensureParseableLevel(id: string, grid: string[][]): void {
  parseLevelText(id, serializeGrid(grid));
}

export function nextCustomLevelId(existingIds: string[]): string {
  const used = new Set(existingIds);
  for (let i = 1; i <= 9999; i += 1) {
    const candidate = `custom-level-${i}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `custom-level-${Date.now()}`;
}

export function shouldPaintOnHover(isPainting: boolean, mouseButtons: number): boolean {
  return isPainting && (mouseButtons & 1) === 1;
}
