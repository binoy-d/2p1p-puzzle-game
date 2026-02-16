import { describe, expect, it } from 'vitest';
import {
  STEPS_PER_BAR,
  backingTrackStepEvents,
  midiToFrequency,
} from '../../src/runtime/backingTrackPattern';

describe('backing track pattern', () => {
  it('uses a 16-step bar', () => {
    expect(STEPS_PER_BAR).toBe(16);
  });

  it('produces deterministic events across bars and wrapped indices', () => {
    const a = backingTrackStepEvents(0, 0);
    const b = backingTrackStepEvents(16, 4);
    const c = backingTrackStepEvents(-16, -4);
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  it('emits kick/snare pattern on core beats', () => {
    const step0 = backingTrackStepEvents(0, 0);
    const step2 = backingTrackStepEvents(2, 0);
    const step4 = backingTrackStepEvents(4, 0);
    const step12 = backingTrackStepEvents(12, 0);

    expect(step0.kick).toBe(true);
    expect(step2.kick).toBe(false);
    expect(step4.snare).toBe(true);
    expect(step12.snare).toBe(true);
    expect(step4.kick).toBe(true);
  });

  it('maps MIDI note 69 to 440Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(60)).toBeCloseTo(261.625565, 5);
  });
});
