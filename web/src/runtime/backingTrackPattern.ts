export interface BackingTrackStepEvents {
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bassMidi: number | null;
  chordMidi: number[] | null;
  leadMidi: number | null;
}

export const STEPS_PER_BAR = 16;

interface SeedMusicProfile {
  rootBassMidi: number;
  chordRootMidi: number;
  scale: number[];
  phraseBars: number;
  chordDegrees: number[];
  hatShift: number;
  kickFillStep: number;
  leadDensity: number;
  bassDensity: number;
  hatDensity: number;
  melodicOffset: number;
}

const SCALE_LIBRARY: number[][] = [
  [0, 3, 5, 7, 10], // minor pentatonic
  [0, 2, 3, 5, 7, 10], // dorian-ish
  [0, 3, 5, 7, 8, 10], // aeolian-ish
  [0, 2, 5, 7, 9, 10], // suspended house color
];

const ROOT_BASS_LIBRARY = [33, 35, 36, 38, 40, 41];
const KICK_FILL_STEPS = [10, 14];
const ARP_OFFSETS = [0, 2, 4, 6, 4, 2, 1, 3];
const profileCache = new Map<number, SeedMusicProfile>();

function toUint32(value: number): number {
  return value >>> 0;
}

function hash32(value: number): number {
  let x = toUint32(value);
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return toUint32(x);
}

function createRng(seed: number): () => number {
  let state = toUint32(seed) || 1;
  return () => {
    state = toUint32(Math.imul(state, 1664525) + 1013904223);
    return state / 0x100000000;
  };
}

function seededFloat(seed: number, bar: number, step: number, salt: number): number {
  const mixed = hash32(
    toUint32(seed) ^
      toUint32(Math.imul(bar + 0x9e3779b9, 0x85ebca6b)) ^
      toUint32(Math.imul(step + 0xc2b2ae35, 0x27d4eb2f)) ^
      toUint32(salt),
  );
  return mixed / 0x100000000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSeedProfile(musicSeed: number): SeedMusicProfile {
  const normalizedSeed = toUint32(musicSeed) || 1;
  const cached = profileCache.get(normalizedSeed);
  if (cached) {
    return cached;
  }

  const rng = createRng(normalizedSeed);
  const rootBassMidi = ROOT_BASS_LIBRARY[Math.floor(rng() * ROOT_BASS_LIBRARY.length)];
  const chordRootMidi = rootBassMidi + 24;
  const scale = SCALE_LIBRARY[Math.floor(rng() * SCALE_LIBRARY.length)];
  const phraseBars = [12, 16, 20][Math.floor(rng() * 3)];
  const hatShift = rng() < 0.5 ? 0 : 1;
  const kickFillStep = KICK_FILL_STEPS[Math.floor(rng() * KICK_FILL_STEPS.length)];
  const leadDensity = 0.36 + rng() * 0.26;
  const bassDensity = 0.34 + rng() * 0.28;
  const hatDensity = 0.1 + rng() * 0.24;
  const melodicOffset = Math.floor(rng() * ARP_OFFSETS.length);

  const anchorDegrees = [0, 2, 3, 4, 5, 6];
  const chordDegrees: number[] = [];
  let currentDegree = 0;
  for (let bar = 0; bar < phraseBars; bar += 1) {
    if (bar === 0) {
      currentDegree = 0;
    } else if (bar % 4 === 0) {
      currentDegree = anchorDegrees[Math.floor(rng() * anchorDegrees.length)];
    } else {
      const step = [-1, 0, 1][Math.floor(rng() * 3)];
      currentDegree = clamp(currentDegree + step, 0, 8);
    }
    chordDegrees.push(currentDegree);
  }
  chordDegrees[chordDegrees.length - 1] = 0;

  const profile: SeedMusicProfile = {
    rootBassMidi,
    chordRootMidi,
    scale,
    phraseBars,
    chordDegrees,
    hatShift,
    kickFillStep,
    leadDensity,
    bassDensity,
    hatDensity,
    melodicOffset,
  };
  profileCache.set(normalizedSeed, profile);
  return profile;
}

function degreeToMidi(rootMidi: number, scale: number[], degree: number): number {
  const scaleLength = scale.length;
  const octave = Math.floor(degree / scaleLength);
  const normalizedDegree = ((degree % scaleLength) + scaleLength) % scaleLength;
  return rootMidi + scale[normalizedDegree] + octave * 12;
}

function normalizeStep(step: number): number {
  return ((Math.floor(step) % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function backingTrackStepEvents(
  step: number,
  bar: number,
  musicSeed = 1,
): BackingTrackStepEvents {
  const profile = getSeedProfile(musicSeed);
  const normalizedStep = normalizeStep(step);
  const phraseBar = ((Math.floor(bar) % profile.phraseBars) + profile.phraseBars) % profile.phraseBars;
  const progressionDegree = profile.chordDegrees[phraseBar];
  const nextDegree = profile.chordDegrees[(phraseBar + 1) % profile.phraseBars];
  const stepRandom = seededFloat(musicSeed, bar, normalizedStep, 0x91e10da5);

  const kickFillChance = phraseBar % 4 === 3 ? 0.44 : 0.18;
  const kick =
    normalizedStep % 4 === 0 ||
    (normalizedStep === profile.kickFillStep && stepRandom < kickFillChance);
  const snare = normalizedStep === 4 || normalizedStep === 12;
  const hat =
    (normalizedStep + profile.hatShift) % 2 === 0 ||
    normalizedStep === 7 ||
    normalizedStep === 15 ||
    stepRandom < profile.hatDensity;

  const chordHit = normalizedStep % 4 === 0 || (normalizedStep === 8 && stepRandom < 0.3);
  const chordMidi = chordHit
    ? [
        degreeToMidi(profile.chordRootMidi, profile.scale, progressionDegree),
        degreeToMidi(profile.chordRootMidi, profile.scale, progressionDegree + 2),
        degreeToMidi(profile.chordRootMidi, profile.scale, progressionDegree + 4),
      ]
    : null;

  const bassMovement =
    normalizedStep === 14
      ? -1
      : normalizedStep === 6 && stepRandom < 0.5
        ? 2
        : 0;
  const bassHit =
    normalizedStep % 4 === 0 ||
    (normalizedStep % 2 === 0 && stepRandom < profile.bassDensity * 0.45) ||
    (normalizedStep === 15 && stepRandom < 0.24);
  const bassMidi = bassHit
    ? degreeToMidi(profile.rootBassMidi, profile.scale, progressionDegree + bassMovement)
    : null;

  const leadHit =
    normalizedStep % 2 === 1 &&
    (stepRandom < profile.leadDensity || (normalizedStep === 15 && stepRandom < profile.leadDensity + 0.22));
  const arpIndex = (normalizedStep + phraseBar * 2 + profile.melodicOffset) % ARP_OFFSETS.length;
  const leadDegreeBase = normalizedStep === 15 && stepRandom > 0.62 ? nextDegree + 2 : progressionDegree;
  const leadMidi = leadHit
    ? degreeToMidi(profile.chordRootMidi + 12, profile.scale, leadDegreeBase + ARP_OFFSETS[arpIndex])
    : null;

  return {
    kick,
    snare,
    hat,
    bassMidi,
    chordMidi,
    leadMidi,
  };
}
