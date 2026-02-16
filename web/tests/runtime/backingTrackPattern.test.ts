import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR, backingTrackStepEvents, midiToFrequency } from '../../src/runtime/backingTrackPattern';

describe('backing track pattern', () => {
  it('uses a 16-step bar', () => {
    expect(STEPS_PER_BAR).toBe(16);
  });

  it('is deterministic for the same seed/step/bar', () => {
    const a = backingTrackStepEvents(3, 7, 123456);
    const b = backingTrackStepEvents(3, 7, 123456);
    expect(a).toEqual(b);
  });

  it('wraps step indices by bar length', () => {
    const a = backingTrackStepEvents(1, 2, 42);
    const b = backingTrackStepEvents(17, 2, 42);
    expect(a).toEqual(b);
  });

  it('produces distinct musical output for different seeds', () => {
    const renderWindow = (seed: number): string => {
      const events: string[] = [];
      for (let bar = 0; bar < 4; bar += 1) {
        for (let step = 0; step < 16; step += 1) {
          const e = backingTrackStepEvents(step, bar, seed);
          events.push(
            `${Number(e.kick)}${Number(e.snare)}${Number(e.hat)}:${e.bassMidi ?? 'n'}:${e.leadMidi ?? 'n'}:${e.chordMidi?.join('-') ?? 'n'}`,
          );
        }
      }
      return events.join('|');
    };

    const seedA = renderWindow(1111);
    const seedB = renderWindow(99999991);
    expect(seedA).not.toEqual(seedB);
  });

  it('maps MIDI note 69 to 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(60)).toBeCloseTo(261.625565, 5);
  });
});
