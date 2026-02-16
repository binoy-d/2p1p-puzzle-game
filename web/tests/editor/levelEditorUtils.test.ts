import { describe, expect, it } from 'vitest';
import {
  createGrid,
  ensureParseableLevel,
  levelIdFromInput,
  nextCustomLevelId,
  parseTextToGrid,
  resizeGrid,
  serializeGrid,
  shouldPaintOnHover,
  validateGridForEditor,
} from '../../src/editor/levelEditorUtils';

describe('level editor utils', () => {
  it('creates and resizes grids while preserving existing cells', () => {
    const grid = createGrid(5, 4, '#');
    grid[1][1] = 'P';

    const resized = resizeGrid(grid, 7, 5, ' ');

    expect(resized).toHaveLength(5);
    expect(resized[0]).toHaveLength(7);
    expect(resized[1][1]).toBe('P');
    expect(resized[4][6]).toBe(' ');
  });

  it('parses and serializes level text', () => {
    const text = ['#####', '#P !#', '# 1 #', '#####'].join('\n');
    const grid = parseTextToGrid(text);

    expect(serializeGrid(grid)).toBe(text);
    expect(grid[2][2]).toBe('1');
  });

  it('rejects invalid level text in parser', () => {
    expect(() => parseTextToGrid('')).toThrow(/empty/i);
    expect(() => parseTextToGrid('##\n###')).toThrow(/width/i);
    expect(() => parseTextToGrid('##\n#@')).toThrow(/invalid tile/i);
  });

  it('validates required gameplay tiles', () => {
    const invalid = parseTextToGrid(['#####', '#   #', '#####'].join('\n'));
    const missingPlayer = validateGridForEditor(invalid);
    expect(missingPlayer.errors).toContain('At least one player spawn (P) is required.');

    const warnOnly = parseTextToGrid(['#####', '#P22#', '#####'].join('\n'));
    const result = validateGridForEditor(warnOnly);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/cannot be completed/i);
    expect(result.warnings.join(' ')).toMatch(/no 1 tile/i);
  });

  it('ensures parser compatibility before save', () => {
    const grid = parseTextToGrid(['#####', '#P !#', '#####'].join('\n'));
    expect(() => ensureParseableLevel('custom-level-7', grid)).not.toThrow();
  });

  it('normalizes level ids and picks next custom id', () => {
    expect(levelIdFromInput(' My Cool Level!! ')).toBe('my-cool-level');
    expect(levelIdFromInput('***')).toBe('custom-level');

    const next = nextCustomLevelId(['custom-level-1', 'custom-level-2']);
    expect(next).toBe('custom-level-3');
  });

  it('only continues paint while left mouse button is held', () => {
    expect(shouldPaintOnHover(false, 1)).toBe(false);
    expect(shouldPaintOnHover(true, 0)).toBe(false);
    expect(shouldPaintOnHover(true, 1)).toBe(true);
    expect(shouldPaintOnHover(true, 2)).toBe(false);
    expect(shouldPaintOnHover(true, 3)).toBe(true);
  });
});
