import { describe, expect, it } from 'vitest';
import { INTRO_DURATION_MS, introPhaseAt, sampleIntroVisualState } from '../../src/ui/introTimeline';

describe('intro timeline', () => {
  it('stays below 20 seconds', () => {
    expect(INTRO_DURATION_MS).toBeLessThan(20000);
  });

  it('switches through expected phases', () => {
    expect(introPhaseAt(0)).toBe('drift');
    expect(introPhaseAt(5199)).toBe('drift');
    expect(introPhaseAt(5200)).toBe('fracture');
    expect(introPhaseAt(7400)).toBe('binding');
    expect(introPhaseAt(9800)).toBe('lockstep');
    expect(introPhaseAt(13200)).toBe('resolve');
    expect(introPhaseAt(INTRO_DURATION_MS + 5000)).toBe('resolve');
  });

  it('ramps lockstep amount and exposes lore beats', () => {
    const early = sampleIntroVisualState(2200, 1280, 720);
    const bind = sampleIntroVisualState(7600, 1280, 720);
    const late = sampleIntroVisualState(14500, 1280, 720);

    expect(early.lockstepAmount).toBeLessThan(bind.lockstepAmount);
    expect(bind.lockstepAmount).toBeLessThan(late.lockstepAmount);
    expect(early.line).toMatch(/Light-Core fractured/i);
    expect(bind.line).toMatch(/tethered/i);
    expect(late.line).toMatch(/moves all bodies/i);
  });

  it('returns deterministic explorer positions inside sane bounds', () => {
    const samples = [
      sampleIntroVisualState(0, 1600, 900),
      sampleIntroVisualState(5100, 1600, 900),
      sampleIntroVisualState(9800, 1600, 900),
      sampleIntroVisualState(15900, 1600, 900),
    ];

    for (const sample of samples) {
      expect(sample.explorers).toHaveLength(4);
      for (const explorer of sample.explorers) {
        expect(Number.isFinite(explorer.x)).toBe(true);
        expect(Number.isFinite(explorer.y)).toBe(true);
        expect(explorer.x).toBeGreaterThan(-400);
        expect(explorer.x).toBeLessThan(2000);
        expect(explorer.y).toBeGreaterThan(-300);
        expect(explorer.y).toBeLessThan(1300);
      }
    }
  });
});
