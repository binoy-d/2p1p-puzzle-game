export interface BackingTrackStepEvents {
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bassMidi: number | null;
  chordMidi: number[] | null;
  leadMidi: number | null;
}

export const STEPS_PER_BAR = 16;

export type MusicVariant = 0 | 1 | 2 | 3;

const BASS_PATTERNS: Array<Array<number | null>> = [
  [36, null, 36, null, 43, null, 36, null, 36, null, 43, null, 36, null, 38, null],
  [36, null, 36, null, 41, null, 36, null, 36, null, 41, null, 36, null, 38, null],
  [33, null, 33, null, 40, null, 33, null, 33, null, 40, null, 33, null, 36, null],
  [35, null, 35, null, 42, null, 35, null, 35, null, 42, null, 35, null, 38, null],
];

const CHORDS: number[][] = [
  [60, 63, 67],
  [60, 65, 69],
  [57, 60, 64],
  [59, 62, 65],
];

const LEAD_PATTERNS: Array<Array<number | null>> = [
  [null, 72, null, 74, null, 75, null, 74, null, 72, null, 70, null, 69, null, 70],
  [null, 72, null, 74, null, 77, null, 74, null, 72, null, 70, null, 69, null, 70],
  [null, 69, null, 72, null, 74, null, 72, null, 69, null, 67, null, 65, null, 67],
  [null, 71, null, 74, null, 76, null, 74, null, 71, null, 69, null, 67, null, 69],
];

const VARIANT_TRANSPOSE: Record<MusicVariant, number> = {
  0: 0,
  1: 2,
  2: -2,
  3: 5,
};

const VARIANT_HAT_SHIFT: Record<MusicVariant, number> = {
  0: 0,
  1: 1,
  2: 0,
  3: 1,
};

function normalizeStep(step: number): number {
  return ((Math.floor(step) % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
}

function normalizeBar(bar: number): number {
  return ((Math.floor(bar) % 4) + 4) % 4;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function backingTrackStepEvents(
  step: number,
  bar: number,
  variant: MusicVariant = 0,
): BackingTrackStepEvents {
  const normalizedStep = normalizeStep(step);
  const normalizedBar = normalizeBar(bar);
  const bassPattern = BASS_PATTERNS[normalizedBar];
  const leadPattern = LEAD_PATTERNS[normalizedBar];
  const transpose = VARIANT_TRANSPOSE[variant];
  const hatShift = VARIANT_HAT_SHIFT[variant];

  const kick = normalizedStep % 4 === 0 || normalizedStep === 10 || (variant === 2 && normalizedStep === 14);
  const snare = normalizedStep === 4 || normalizedStep === 12;
  const hat = (normalizedStep + hatShift) % 2 === 0 || normalizedStep === 7 || normalizedStep === 15;
  const chordMidi = normalizedStep % 4 === 0 ? CHORDS[normalizedBar].map((note) => note + transpose) : null;
  const bassMidi = bassPattern[normalizedStep] === null ? null : bassPattern[normalizedStep] + transpose;
  const leadMidi = leadPattern[normalizedStep] === null ? null : leadPattern[normalizedStep] + transpose;

  return {
    kick,
    snare,
    hat,
    bassMidi,
    chordMidi,
    leadMidi,
  };
}
