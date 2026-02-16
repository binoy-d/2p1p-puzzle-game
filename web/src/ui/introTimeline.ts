export const INTRO_DURATION_MS = 16000;

export type IntroPhase = 'drift' | 'fracture' | 'binding' | 'lockstep' | 'resolve';

export interface IntroExplorer {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

export interface IntroVisualState {
  phase: IntroPhase;
  progress: number;
  lockstepAmount: number;
  fractureFlash: number;
  corePulse: number;
  gridDrift: number;
  title: string;
  titleAlpha: number;
  line: string;
  lineAlpha: number;
  explorers: IntroExplorer[];
}

const FINAL_LORE_LINE = 'Every step moves them together.';

interface LoreBeat {
  startMs: number;
  endMs: number;
  line: string;
}

const LORE_BEATS: LoreBeat[] = [
  {
    startMs: 800,
    endMs: 4800,
    line: 'Deep beneath the ruins, the Light-Core fractured.',
  },
  {
    startMs: 4300,
    endMs: 8600,
    line: 'Its pulse tethered every explorer to one command field.',
  },
  {
    startMs: 8200,
    endMs: 12200,
    line: 'Different minds. Shared motion.',
  },
  {
    startMs: 11600,
    endMs: 15800,
    line: FINAL_LORE_LINE,
  },
];

const EXPLORER_ANCHORS = [
  { x: -0.18, y: -0.16 },
  { x: 0.2, y: -0.12 },
  { x: -0.22, y: 0.2 },
  { x: 0.24, y: 0.16 },
];

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function pulseCenter(elapsedMs: number, centerMs: number, widthMs: number): number {
  const normalized = (elapsedMs - centerMs) / widthMs;
  return Math.exp(-(normalized * normalized));
}

function segmentAlpha(elapsedMs: number, startMs: number, endMs: number): number {
  if (elapsedMs < startMs || elapsedMs > endMs) {
    return 0;
  }

  const fadeMs = Math.min(500, (endMs - startMs) / 3);
  if (elapsedMs <= startMs + fadeMs) {
    return clamp01((elapsedMs - startMs) / fadeMs);
  }

  if (elapsedMs >= endMs - fadeMs) {
    return clamp01((endMs - elapsedMs) / fadeMs);
  }

  return 1;
}

function lockstepPath(elapsedMs: number): { x: number; y: number } {
  const cycle = ((elapsedMs / 1700) % 4 + 4) % 4;
  if (cycle < 1) {
    return { x: -1 + cycle * 2, y: -1 };
  }

  if (cycle < 2) {
    return { x: 1, y: -1 + (cycle - 1) * 2 };
  }

  if (cycle < 3) {
    return { x: 1 - (cycle - 2) * 2, y: 1 };
  }

  return { x: -1, y: 1 - (cycle - 3) * 2 };
}

function clampPhaseElapsed(elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }

  if (elapsedMs >= INTRO_DURATION_MS) {
    return INTRO_DURATION_MS;
  }

  return elapsedMs;
}

export function introPhaseAt(elapsedMs: number): IntroPhase {
  const clamped = clampPhaseElapsed(elapsedMs);
  if (clamped < 5200) {
    return 'drift';
  }

  if (clamped < 7400) {
    return 'fracture';
  }

  if (clamped < 9800) {
    return 'binding';
  }

  if (clamped < 13200) {
    return 'lockstep';
  }

  return 'resolve';
}

export function sampleIntroVisualState(elapsedMs: number, width: number, height: number): IntroVisualState {
  const phaseElapsed = clampPhaseElapsed(elapsedMs);
  const phase = introPhaseAt(phaseElapsed);
  const progress = clamp01(phaseElapsed / INTRO_DURATION_MS);
  const lockstepAmount = clamp01((phaseElapsed - 6500) / 2900);
  const fractureFlash = pulseCenter(phaseElapsed, 6200, 620);
  const corePulse = 0.5 + 0.5 * Math.sin(elapsedMs / 165);
  const gridDrift = (elapsedMs * 0.028) % 36;

  let activeLine = '';
  let activeLineAlpha = 0;
  if (phaseElapsed >= 11800) {
    activeLine = FINAL_LORE_LINE;
    activeLineAlpha = 1;
  } else {
    for (const beat of LORE_BEATS) {
      const alpha = segmentAlpha(phaseElapsed, beat.startMs, beat.endMs);
      if (alpha > activeLineAlpha) {
        activeLine = beat.line;
        activeLineAlpha = alpha;
      }
    }
  }

  const titleAlpha = phase === 'resolve' ? 1 : clamp01(0.55 + lockstepAmount * 0.45);
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const path = lockstepPath(elapsedMs - 9800);
  const baseSize = Math.max(14, Math.min(width, height) * 0.028);

  const explorers: IntroExplorer[] = EXPLORER_ANCHORS.map((anchor, index) => {
    const independentX =
      centerX +
      anchor.x * width +
      Math.sin(elapsedMs * 0.00115 * (index + 1) + index * 1.7) * width * 0.09;
    const independentY =
      centerY +
      anchor.y * height +
      Math.cos(elapsedMs * 0.00103 * (index + 2) + index * 2.2) * height * 0.085;

    const lockstepX = centerX + path.x * width * 0.18 + anchor.x * width * 0.06;
    const lockstepY = centerY + path.y * height * 0.14 + anchor.y * height * 0.06;

    const x = lerp(independentX, lockstepX, lockstepAmount);
    const y = lerp(independentY, lockstepY, lockstepAmount);
    const size = baseSize * (0.9 + 0.18 * (0.5 + 0.5 * Math.sin(elapsedMs / 210 + index * 0.9)));
    const opacity = lerp(0.68, 1, lockstepAmount);

    return { x, y, size, opacity };
  });

  return {
    phase,
    progress,
    lockstepAmount,
    fractureFlash,
    corePulse,
    gridDrift,
    title: 'LOCKSTEP',
    titleAlpha,
    line: activeLine,
    lineAlpha: activeLineAlpha,
    explorers,
  };
}
