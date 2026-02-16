import { INTRO_DURATION_MS, sampleIntroVisualState } from './introTimeline';

interface IntroCinematicElements {
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
  title: HTMLElement;
  line: HTMLElement;
  skipHint: HTMLElement;
}

interface IntroCinematicOptions {
  elements: IntroCinematicElements;
  onComplete: () => void;
}

interface AudioPulseEventDetail {
  kind: 'kick' | 'snare';
  strength: number;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function fract(value: number): number {
  return value - Math.floor(value);
}

export class LockstepIntroCinematic {
  private readonly panel: HTMLElement;

  private readonly canvas: HTMLCanvasElement;

  private readonly titleElement: HTMLElement;

  private readonly lineElement: HTMLElement;

  private readonly skipHintElement: HTMLElement;

  private readonly onComplete: () => void;

  private readonly context: CanvasRenderingContext2D;

  private running = false;

  private startedAtMs = 0;

  private rafId: number | null = null;

  private width = 1;

  private height = 1;

  private completionIssued = false;

  private kickPulse = 0;

  private snarePulse = 0;

  public constructor(options: IntroCinematicOptions) {
    this.panel = options.elements.panel;
    this.canvas = options.elements.canvas;
    this.titleElement = options.elements.title;
    this.lineElement = options.elements.line;
    this.skipHintElement = options.elements.skipHint;
    this.onComplete = options.onComplete;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context is required for intro cinematic.');
    }

    this.context = context;
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.completionIssued = false;
    this.startedAtMs = performance.now();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('lockstep-audio-pulse', this.handleAudioPulse as EventListener);
    this.resize();
    this.renderFrame(this.startedAtMs);
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('lockstep-audio-pulse', this.handleAudioPulse as EventListener);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public skip(): void {
    if (!this.running) {
      if (!this.completionIssued) {
        this.completionIssued = true;
        this.onComplete();
      }
      return;
    }

    this.complete();
  }

  private handleResize = (): void => {
    this.resize();
  };

  private readonly handleAudioPulse = (event: Event): void => {
    const custom = event as CustomEvent<AudioPulseEventDetail>;
    const detail = custom.detail;
    if (!detail) {
      return;
    }

    if (detail.kind === 'kick') {
      this.kickPulse = Math.max(this.kickPulse, detail.strength);
      return;
    }

    if (detail.kind === 'snare') {
      this.snarePulse = Math.max(this.snarePulse, detail.strength);
    }
  };

  private renderFrame = (timestampMs: number): void => {
    if (!this.running) {
      return;
    }

    const elapsedMs = Math.max(0, timestampMs - this.startedAtMs);
    this.kickPulse *= 0.82;
    this.snarePulse *= 0.86;
    const visual = sampleIntroVisualState(elapsedMs, this.width, this.height);
    this.drawScene(visual, elapsedMs);
    this.rafId = requestAnimationFrame(this.renderFrame);
  };

  private complete(): void {
    if (this.completionIssued) {
      return;
    }

    this.completionIssued = true;
    this.stop();
    this.onComplete();
  }

  private resize(): void {
    const rect = this.panel.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = width;
    this.height = height;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.imageSmoothingEnabled = false;
  }

  private drawScene(
    visual: ReturnType<typeof sampleIntroVisualState>,
    elapsedMs: number,
  ): void {
    const ctx = this.context;
    const width = this.width;
    const height = this.height;

    ctx.clearRect(0, 0, width, height);

    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#050c14');
    bgGradient.addColorStop(0.42, '#0c1f3f');
    bgGradient.addColorStop(0.68, '#1a1f49');
    bgGradient.addColorStop(1, '#130d22');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    this.drawNebulaClouds(width, height, elapsedMs);
    this.drawParallaxStars(width, height, elapsedMs);
    this.drawGrid(width, height, visual.gridDrift, 0.13 + visual.lockstepAmount * 0.18);
    this.drawCore(width * 0.5, height * 0.52, visual.corePulse, visual.fractureFlash, this.kickPulse);

    if (visual.lockstepAmount > 0.02) {
      this.drawLinks(width * 0.5, height * 0.52, visual.explorers, visual.lockstepAmount, this.snarePulse);
    }

    this.drawExplorers(visual.explorers);
    this.drawScanlines(width, height);

    if (visual.fractureFlash > 0.02) {
      ctx.fillStyle = `rgba(220, 255, 242, ${visual.fractureFlash * 0.42})`;
      ctx.fillRect(0, 0, width, height);
    }

    this.titleElement.textContent = visual.title;
    this.titleElement.style.opacity = visual.titleAlpha.toFixed(3);
    this.lineElement.textContent = visual.line;
    this.lineElement.style.opacity = visual.lineAlpha.toFixed(3);
    this.skipHintElement.textContent =
      elapsedMs >= INTRO_DURATION_MS ? 'Ready: press Start' : 'Press Start anytime to skip';
    this.skipHintElement.style.opacity = clamp01(elapsedMs / 900).toFixed(3);
  }

  private drawGrid(width: number, height: number, drift: number, alpha: number): void {
    const ctx = this.context;
    const spacing = 36;
    const offset = drift % spacing;

    ctx.strokeStyle = `rgba(99, 169, 255, ${alpha})`;
    ctx.lineWidth = 1;

    for (let x = -spacing + offset; x <= width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = -spacing + offset; y <= height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private drawCore(centerX: number, centerY: number, pulse: number, flash: number, kickPulse: number): void {
    const ctx = this.context;
    const base = 42;
    const pulseScale = 0.88 + pulse * 0.35 + kickPulse * 0.28;
    const glowSize = base * 3.4 * (0.9 + pulse * 0.2 + flash * 0.55 + kickPulse * 0.35);
    const coreSize = base * pulseScale;

    ctx.fillStyle = `rgba(55, 255, 196, ${0.17 + flash * 0.33 + kickPulse * 0.22})`;
    ctx.fillRect(centerX - glowSize / 2, centerY - glowSize / 2, glowSize, glowSize);

    ctx.fillStyle = '#37f8c2';
    ctx.fillRect(centerX - coreSize / 2, centerY - coreSize / 2, coreSize, coreSize);
    ctx.fillStyle = '#d8fff3';
    ctx.fillRect(centerX - coreSize * 0.28, centerY - coreSize * 0.28, coreSize * 0.56, coreSize * 0.56);

    const ringSize = coreSize * 2.8 * (0.85 + pulse * 0.35 + kickPulse * 0.2);
    ctx.strokeStyle = `rgba(108, 255, 227, ${0.26 + pulse * 0.24 + kickPulse * 0.25})`;
    ctx.lineWidth = 2 + kickPulse * 1.6;
    ctx.strokeRect(centerX - ringSize / 2, centerY - ringSize / 2, ringSize, ringSize);
  }

  private drawLinks(
    centerX: number,
    centerY: number,
    explorers: ReturnType<typeof sampleIntroVisualState>['explorers'],
    lockstepAmount: number,
    snarePulse: number,
  ): void {
    const ctx = this.context;
    ctx.strokeStyle = `rgba(104, 238, 255, ${0.15 + lockstepAmount * 0.65 + snarePulse * 0.22})`;
    ctx.lineWidth = 2 + lockstepAmount * 2.4 + snarePulse * 1.5;

    for (const explorer of explorers) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(explorer.x, explorer.y);
      ctx.stroke();
    }
  }

  private drawExplorers(explorers: ReturnType<typeof sampleIntroVisualState>['explorers']): void {
    const ctx = this.context;
    for (const explorer of explorers) {
      const glowSize = explorer.size * 1.9;
      const glowInset = (glowSize - explorer.size) / 2;
      ctx.fillStyle = `rgba(121, 205, 255, ${explorer.opacity * 0.28})`;
      ctx.fillRect(explorer.x - explorer.size / 2 - glowInset, explorer.y - explorer.size / 2 - glowInset, glowSize, glowSize);

      ctx.fillStyle = `rgba(255, 255, 255, ${explorer.opacity})`;
      ctx.fillRect(explorer.x - explorer.size / 2, explorer.y - explorer.size / 2, explorer.size, explorer.size);

      ctx.fillStyle = `rgba(198, 235, 255, ${explorer.opacity})`;
      ctx.fillRect(
        explorer.x - explorer.size * 0.2,
        explorer.y - explorer.size * 0.2,
        explorer.size * 0.4,
        explorer.size * 0.4,
      );
    }
  }

  private drawScanlines(width: number, height: number): void {
    const ctx = this.context;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }

    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.12,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.62,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.46)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  private drawNebulaClouds(width: number, height: number, elapsedMs: number): void {
    const ctx = this.context;
    const shiftA = Math.sin(elapsedMs / 5200) * width * 0.05;
    const shiftB = Math.cos(elapsedMs / 6100) * width * 0.07;

    const cloudA = ctx.createRadialGradient(
      width * 0.26 + shiftA,
      height * 0.28,
      width * 0.05,
      width * 0.26 + shiftA,
      height * 0.28,
      width * 0.42,
    );
    cloudA.addColorStop(0, 'rgba(72, 171, 255, 0.24)');
    cloudA.addColorStop(1, 'rgba(72, 171, 255, 0)');
    ctx.fillStyle = cloudA;
    ctx.fillRect(0, 0, width, height);

    const cloudB = ctx.createRadialGradient(
      width * 0.76 + shiftB,
      height * 0.72,
      width * 0.04,
      width * 0.76 + shiftB,
      height * 0.72,
      width * 0.45,
    );
    cloudB.addColorStop(0, 'rgba(190, 118, 255, 0.18)');
    cloudB.addColorStop(1, 'rgba(190, 118, 255, 0)');
    ctx.fillStyle = cloudB;
    ctx.fillRect(0, 0, width, height);
  }

  private drawParallaxStars(width: number, height: number, elapsedMs: number): void {
    const ctx = this.context;
    const layers = [
      { count: 56, speed: 0.0045, size: 1.3, alpha: 0.26, tint: 210 },
      { count: 40, speed: 0.0082, size: 1.8, alpha: 0.34, tint: 190 },
      { count: 24, speed: 0.0125, size: 2.4, alpha: 0.43, tint: 350 },
    ];

    for (const layer of layers) {
      for (let i = 0; i < layer.count; i += 1) {
        const seed = i * 67.891 + layer.size * 23.7;
        const baseX = fract(Math.sin(seed * 12.97) * 43758.5453) * width;
        const baseY = fract(Math.sin(seed * 7.31) * 24634.6345) * height;
        const x = (baseX + elapsedMs * layer.speed * (1 + (i % 3) * 0.18)) % (width + 40) - 20;
        const y = (baseY + Math.sin(elapsedMs / 1200 + i * 0.77) * 12 + height) % height;
        const twinkle = 0.5 + 0.5 * Math.sin(elapsedMs / 260 + i * 1.71);
        const alpha = layer.alpha * (0.45 + twinkle * 0.55);
        const hue = layer.tint + (i % 5) * 6;
        ctx.fillStyle = `hsla(${hue} 85% 78% / ${alpha})`;
        ctx.fillRect(x, y, layer.size, layer.size);
      }
    }
  }
}
