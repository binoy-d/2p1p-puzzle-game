import type { GameController } from '../app/gameController';
import { getLevelMusicSeed } from './levelMeta';
import { STEPS_PER_BAR, backingTrackStepEvents, midiToFrequency } from './backingTrackPattern';

const BPM = 124;
const STEP_DURATION_SECONDS = 60 / BPM / 4;
const SCHEDULE_AHEAD_SECONDS = 0.22;
const SCHEDULER_INTERVAL_MS = 36;
const MOVE_TEMPO_BOOST_MAX = 0.18;
const MOVE_TEMPO_BOOST_PER_MOVE = 0.055;
const MOVE_TEMPO_DECAY_PER_SECOND = 0.42;
const MOVE_SFX_MIN_INTERVAL_MS = 60;

function resolveAudioContextCtor(): typeof AudioContext | null {
  const withWebkit = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class ProceduralBackingTrack {
  private readonly unsubscribeFromController: () => void;

  private audioContext: AudioContext | null = null;

  private musicGain: GainNode | null = null;

  private sfxGain: GainNode | null = null;

  private drumBus: GainNode | null = null;

  private synthBus: GainNode | null = null;

  private sfxBus: GainNode | null = null;

  private delaySend: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimerId: number | null = null;

  private nextStepTime = 0;

  private stepInBar = 0;

  private barIndex = 0;

  private started = false;

  private desiredMusicVolume = 0.6;

  private desiredSfxVolume = 0.85;

  private currentSeed = 1;

  private lastDeathAnimationSequence = 0;

  private lastWinTransitionSequence = 0;

  private lastMoveSignature = '';

  private moveTempoBoost = 0;

  private lastTempoDecayTime = 0;

  private lastMoveSfxAtMs = 0;

  private readonly pulseTimeouts = new Set<number>();

  public constructor(controller: GameController) {
    this.unsubscribeFromController = controller.subscribe((snapshot) => {
      this.setMusicVolume(snapshot.settings.musicVolume);
      this.setSfxVolume(snapshot.settings.sfxVolume);
      const sourceLevelIndex =
        snapshot.screen === 'playing' || snapshot.screen === 'paused'
          ? snapshot.gameState.levelIndex
          : snapshot.selectedLevelIndex;
      const sourceLevelId =
        snapshot.screen === 'playing' || snapshot.screen === 'paused'
          ? snapshot.gameState.levelId
          : snapshot.levels[sourceLevelIndex]?.id ?? snapshot.gameState.levelId;
      this.currentSeed = getLevelMusicSeed(sourceLevelId, sourceLevelIndex);

      const deathAnimation = snapshot.deathAnimation;
      if (deathAnimation && deathAnimation.sequence !== this.lastDeathAnimationSequence) {
        this.lastDeathAnimationSequence = deathAnimation.sequence;
        void this.playDeathSfx(deathAnimation.kind);
      }

      const winTransition = snapshot.winTransition;
      if (winTransition && winTransition.sequence !== this.lastWinTransitionSequence) {
        this.lastWinTransitionSequence = winTransition.sequence;
        void this.playWinTransitionSfx(winTransition.durationMs);
      }

      if (snapshot.screen === 'playing' && snapshot.gameState.lastEvent === 'turn-processed') {
        const moveSignature = `${snapshot.gameState.levelId}:${snapshot.gameState.tick}:${snapshot.gameState.moves}`;
        if (moveSignature !== this.lastMoveSignature) {
          this.lastMoveSignature = moveSignature;
          this.applyMovePulse();
        }
      } else {
        this.lastMoveSignature = '';
      }
    });

    this.bindUnlockListeners();
    this.bindFocusListeners();
  }

  public destroy(): void {
    this.stopScheduler();
    this.unbindUnlockListeners();
    this.unbindFocusListeners();
    this.clearPulseTimeouts();
    this.unsubscribeFromController();
    const context = this.audioContext;
    this.audioContext = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.drumBus = null;
    this.synthBus = null;
    this.sfxBus = null;
    this.delaySend = null;
    this.noiseBuffer = null;
    this.started = false;
    if (context) {
      void context.close();
    }
  }

  private readonly handleUnlockGesture = (): void => {
    void this.ensureStarted();
  };

  private bindUnlockListeners(): void {
    window.addEventListener('pointerdown', this.handleUnlockGesture, { passive: true });
    window.addEventListener('touchstart', this.handleUnlockGesture, { passive: true });
    window.addEventListener('keydown', this.handleUnlockGesture);
  }

  private unbindUnlockListeners(): void {
    window.removeEventListener('pointerdown', this.handleUnlockGesture);
    window.removeEventListener('touchstart', this.handleUnlockGesture);
    window.removeEventListener('keydown', this.handleUnlockGesture);
  }

  private bindFocusListeners(): void {
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private unbindFocusListeners(): void {
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private readonly handleWindowBlur = (): void => {
    void this.suspendPlayback();
  };

  private readonly handleWindowFocus = (): void => {
    void this.resumePlayback();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      void this.suspendPlayback();
      return;
    }

    void this.resumePlayback();
  };

  private async ensureStarted(): Promise<void> {
    if (!this.audioContext) {
      const AudioContextCtor = resolveAudioContextCtor();
      if (!AudioContextCtor) {
        return;
      }

      this.audioContext = new AudioContextCtor();
      this.buildAudioGraph(this.audioContext);
    }

    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume();
    }

    if (this.started) {
      this.applyVolume();
      return;
    }

    this.started = true;
    this.nextStepTime = this.audioContext.currentTime + 0.08;
    this.stepInBar = 0;
    this.barIndex = 0;
    this.lastTempoDecayTime = this.audioContext.currentTime;
    this.applyVolume();
    this.startScheduler();
    this.unbindUnlockListeners();
  }

  private async suspendPlayback(): Promise<void> {
    if (!this.audioContext || !this.started) {
      return;
    }

    if (this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }
    this.clearPulseTimeouts();
  }

  private async resumePlayback(): Promise<void> {
    if (!this.audioContext || !this.started) {
      return;
    }

    if (document.hidden || !document.hasFocus()) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private setMusicVolume(volume: number): void {
    this.desiredMusicVolume = clamp(volume, 0, 1);
    this.applyVolume();
  }

  private setSfxVolume(volume: number): void {
    this.desiredSfxVolume = clamp(volume, 0, 1);
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.audioContext || !this.musicGain || !this.sfxGain) {
      return;
    }

    const musicGain = Math.pow(this.desiredMusicVolume, 1.2) * 0.24;
    const sfxGain = Math.pow(this.desiredSfxVolume, 1.05) * 0.36;
    this.musicGain.gain.setTargetAtTime(musicGain, this.audioContext.currentTime, 0.04);
    this.sfxGain.gain.setTargetAtTime(sfxGain, this.audioContext.currentTime, 0.03);
  }

  private buildAudioGraph(context: AudioContext): void {
    const mixGain = context.createGain();
    mixGain.gain.value = 1;

    const musicGain = context.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(mixGain);

    const sfxGain = context.createGain();
    sfxGain.gain.value = 0;
    sfxGain.connect(mixGain);

    const drumBus = context.createGain();
    drumBus.gain.value = 0.9;
    drumBus.connect(musicGain);

    const synthBus = context.createGain();
    synthBus.gain.value = 0.78;
    synthBus.connect(musicGain);

    const sfxBus = context.createGain();
    sfxBus.gain.value = 0.82;
    sfxBus.connect(sfxGain);

    const delaySend = context.createGain();
    delaySend.gain.value = 0.21;
    synthBus.connect(delaySend);

    const delay = context.createDelay(0.8);
    delay.delayTime.value = 0.29;
    delaySend.connect(delay);

    const feedback = context.createGain();
    feedback.gain.value = 0.34;
    delay.connect(feedback);
    feedback.connect(delay);

    const wet = context.createGain();
    wet.gain.value = 0.3;
    delay.connect(wet);
    wet.connect(musicGain);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 2.8;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.22;
    mixGain.connect(compressor);
    compressor.connect(context.destination);

    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    this.drumBus = drumBus;
    this.synthBus = synthBus;
    this.sfxBus = sfxBus;
    this.delaySend = delaySend;
  }

  private startScheduler(): void {
    if (this.schedulerTimerId !== null) {
      window.clearInterval(this.schedulerTimerId);
    }

    this.schedulerTimerId = window.setInterval(() => {
      this.schedulePendingSteps();
    }, SCHEDULER_INTERVAL_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerTimerId !== null) {
      window.clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  private schedulePendingSteps(): void {
    if (!this.audioContext || !this.started) {
      return;
    }
    if (this.audioContext.state !== 'running') {
      return;
    }

    this.decayMoveTempo(this.audioContext.currentTime);
    while (this.nextStepTime < this.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleStep(this.nextStepTime, this.stepInBar, this.barIndex);
      const tempoFactor = 1 + this.moveTempoBoost;
      this.nextStepTime += STEP_DURATION_SECONDS / tempoFactor;
      this.stepInBar += 1;
      if (this.stepInBar >= STEPS_PER_BAR) {
        this.stepInBar = 0;
        this.barIndex = (this.barIndex + 1) % 4;
      }
    }
  }

  private decayMoveTempo(currentTime: number): void {
    if (this.lastTempoDecayTime <= 0) {
      this.lastTempoDecayTime = currentTime;
      return;
    }

    const elapsed = Math.max(0, currentTime - this.lastTempoDecayTime);
    this.lastTempoDecayTime = currentTime;
    if (elapsed <= 0 || this.moveTempoBoost <= 0) {
      return;
    }

    this.moveTempoBoost = Math.max(0, this.moveTempoBoost - elapsed * MOVE_TEMPO_DECAY_PER_SECOND);
  }

  private applyMovePulse(): void {
    this.moveTempoBoost = clamp(
      this.moveTempoBoost + MOVE_TEMPO_BOOST_PER_MOVE,
      0,
      MOVE_TEMPO_BOOST_MAX,
    );
    this.playMoveSfx();
  }

  private scheduleStep(time: number, step: number, bar: number): void {
    const events = backingTrackStepEvents(step, bar, this.currentSeed);

    if (events.kick) {
      this.scheduleKick(time);
      this.schedulePulseEvent('kick', time);
    }
    if (events.snare) {
      this.scheduleSnare(time);
      this.schedulePulseEvent('snare', time);
    }
    if (events.hat) {
      this.scheduleHat(time);
    }
    if (events.bassMidi !== null) {
      this.scheduleBass(time, events.bassMidi);
    }
    if (events.chordMidi) {
      this.scheduleChord(time, events.chordMidi);
    }
    if (events.leadMidi !== null) {
      this.scheduleLead(time, events.leadMidi);
    }
  }

  private scheduleKick(time: number): void {
    const context = this.audioContext;
    const drumBus = this.drumBus;
    if (!context || !drumBus) {
      return;
    }

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(162, time);
    oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.18);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.95, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    oscillator.connect(gain);
    gain.connect(drumBus);
    oscillator.start(time);
    oscillator.stop(time + 0.22);
  }

  private scheduleSnare(time: number): void {
    const context = this.audioContext;
    const drumBus = this.drumBus;
    if (!context || !drumBus) {
      return;
    }

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer(context);

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1800;

    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.33, time + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(drumBus);
    noiseSource.start(time);
    noiseSource.stop(time + 0.16);

    const snapOsc = context.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(250, time);
    snapOsc.frequency.exponentialRampToValueAtTime(120, time + 0.08);

    const snapGain = context.createGain();
    snapGain.gain.setValueAtTime(0.0001, time);
    snapGain.gain.exponentialRampToValueAtTime(0.24, time + 0.005);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);

    snapOsc.connect(snapGain);
    snapGain.connect(drumBus);
    snapOsc.start(time);
    snapOsc.stop(time + 0.12);
  }

  private scheduleHat(time: number): void {
    const context = this.audioContext;
    const drumBus = this.drumBus;
    if (!context || !drumBus) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer(context);

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6800;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.16, time + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(drumBus);
    source.start(time);
    source.stop(time + 0.06);
  }

  private scheduleBass(time: number, midi: number): void {
    const context = this.audioContext;
    const synthBus = this.synthBus;
    if (!context || !synthBus) {
      return;
    }

    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(midiToFrequency(midi), time);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, time);
    filter.Q.value = 0.6;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.2, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(synthBus);
    oscillator.start(time);
    oscillator.stop(time + 0.24);
  }

  private scheduleChord(time: number, chord: number[]): void {
    const context = this.audioContext;
    const synthBus = this.synthBus;
    const delaySend = this.delaySend;
    if (!context || !synthBus || !delaySend) {
      return;
    }

    for (const midi of chord) {
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(midiToFrequency(midi), time);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.09, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
      filter.Q.value = 0.4;

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(synthBus);
      gain.connect(delaySend);
      oscillator.start(time);
      oscillator.stop(time + 0.5);
    }
  }

  private scheduleLead(time: number, midi: number): void {
    const context = this.audioContext;
    const synthBus = this.synthBus;
    const delaySend = this.delaySend;
    if (!context || !synthBus || !delaySend) {
      return;
    }

    const oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(midiToFrequency(midi), time);

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1700;
    filter.Q.value = 1.2;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.065, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(synthBus);
    gain.connect(delaySend);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
  }

  private schedulePulseEvent(kind: 'kick' | 'snare', scheduledTime: number): void {
    const context = this.audioContext;
    if (!context) {
      return;
    }

    const msUntil = Math.max(0, (scheduledTime - context.currentTime) * 1000);
    const timerId = window.setTimeout(() => {
      this.pulseTimeouts.delete(timerId);
      window.dispatchEvent(
        new CustomEvent('lockstep-audio-pulse', {
          detail: {
            kind,
            strength: kind === 'kick' ? 1 : 0.7,
          },
        }),
      );
    }, msUntil);
    this.pulseTimeouts.add(timerId);
  }

  private clearPulseTimeouts(): void {
    for (const timerId of this.pulseTimeouts) {
      window.clearTimeout(timerId);
    }
    this.pulseTimeouts.clear();
  }

  private playMoveSfx(): void {
    const context = this.audioContext;
    const sfxBus = this.sfxBus;
    if (!context || !sfxBus || context.state !== 'running') {
      return;
    }

    const nowMs = performance.now();
    if (nowMs - this.lastMoveSfxAtMs < MOVE_SFX_MIN_INTERVAL_MS) {
      return;
    }
    this.lastMoveSfxAtMs = nowMs;

    const time = context.currentTime + 0.003;
    const tickOsc = context.createOscillator();
    tickOsc.type = 'triangle';
    tickOsc.frequency.setValueAtTime(560, time);
    tickOsc.frequency.exponentialRampToValueAtTime(820, time + 0.028);

    const tickGain = context.createGain();
    tickGain.gain.setValueAtTime(0.0001, time);
    tickGain.gain.exponentialRampToValueAtTime(0.06, time + 0.003);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    tickOsc.connect(tickGain);
    tickGain.connect(sfxBus);
    tickOsc.start(time);
    tickOsc.stop(time + 0.06);

    const clickSource = context.createBufferSource();
    clickSource.buffer = this.getNoiseBuffer(context);
    const clickFilter = context.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 4200;
    const clickGain = context.createGain();
    clickGain.gain.setValueAtTime(0.0001, time);
    clickGain.gain.exponentialRampToValueAtTime(0.035, time + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    clickSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(sfxBus);
    clickSource.start(time);
    clickSource.stop(time + 0.035);
  }

  private async playDeathSfx(kind: 'enemy' | 'lava'): Promise<void> {
    await this.ensureStarted();
    const context = this.audioContext;
    if (!context || context.state !== 'running') {
      return;
    }

    const time = context.currentTime + 0.01;
    if (kind === 'enemy') {
      this.scheduleEnemyDeathSfx(time);
      return;
    }

    this.scheduleLavaDeathSfx(time);
  }

  private async playWinTransitionSfx(durationMs: number): Promise<void> {
    await this.ensureStarted();
    const context = this.audioContext;
    const sfxBus = this.sfxBus;
    if (!context || !sfxBus || context.state !== 'running') {
      return;
    }

    const time = context.currentTime + 0.015;
    const durationSec = clamp(durationMs / 1000, 0.6, 1.5);

    const bedOsc = context.createOscillator();
    bedOsc.type = 'triangle';
    bedOsc.frequency.setValueAtTime(178, time);
    bedOsc.frequency.exponentialRampToValueAtTime(288, time + durationSec * 0.55);
    bedOsc.frequency.exponentialRampToValueAtTime(372, time + durationSec * 0.95);
    const bedGain = context.createGain();
    bedGain.gain.setValueAtTime(0.0001, time);
    bedGain.gain.exponentialRampToValueAtTime(0.2, time + durationSec * 0.14);
    bedGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSec);
    const bedFilter = context.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.setValueAtTime(1300, time);
    bedFilter.frequency.exponentialRampToValueAtTime(4600, time + durationSec * 0.72);
    bedOsc.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(sfxBus);
    bedOsc.start(time);
    bedOsc.stop(time + durationSec + 0.03);

    const subRiseOsc = context.createOscillator();
    subRiseOsc.type = 'sine';
    subRiseOsc.frequency.setValueAtTime(58, time);
    subRiseOsc.frequency.exponentialRampToValueAtTime(104, time + durationSec * 0.82);
    const subRiseGain = context.createGain();
    subRiseGain.gain.setValueAtTime(0.0001, time);
    subRiseGain.gain.exponentialRampToValueAtTime(0.12, time + durationSec * 0.2);
    subRiseGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSec * 0.96);
    subRiseOsc.connect(subRiseGain);
    subRiseGain.connect(sfxBus);
    subRiseOsc.start(time);
    subRiseOsc.stop(time + durationSec);

    const whoosh = context.createBufferSource();
    whoosh.buffer = this.getNoiseBuffer(context);
    const whooshFilter = context.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(360, time);
    whooshFilter.frequency.exponentialRampToValueAtTime(3100, time + durationSec * 0.82);
    whooshFilter.Q.value = 0.76;
    const whooshGain = context.createGain();
    whooshGain.gain.setValueAtTime(0.0001, time);
    whooshGain.gain.exponentialRampToValueAtTime(0.2, time + durationSec * 0.18);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSec * 0.96);
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(sfxBus);
    whoosh.start(time);
    whoosh.stop(time + durationSec);

    const shimmer = context.createBufferSource();
    shimmer.buffer = this.getNoiseBuffer(context);
    const shimmerFilter = context.createBiquadFilter();
    shimmerFilter.type = 'highpass';
    shimmerFilter.frequency.value = 4200;
    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, time);
    shimmerGain.gain.exponentialRampToValueAtTime(0.1, time + durationSec * 0.32);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSec * 0.94);
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(sfxBus);
    shimmer.start(time + durationSec * 0.16);
    shimmer.stop(time + durationSec);

    const arpeggio = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < arpeggio.length; i += 1) {
      const noteTime = time + (durationSec * 0.68 * i) / (arpeggio.length - 1);
      const midi = 69 + arpeggio[i];
      const osc = context.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(midiToFrequency(midi), noteTime);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.14 - i * 0.013, noteTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + durationSec * 0.2);
      osc.connect(gain);
      gain.connect(sfxBus);
      osc.start(noteTime);
      osc.stop(noteTime + durationSec * 0.22);
    }

    const liftChord = [76, 79, 83];
    for (let i = 0; i < liftChord.length; i += 1) {
      const startTime = time + durationSec * 0.62;
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFrequency(liftChord[i]), startTime);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 0.24);
      osc.connect(gain);
      gain.connect(sfxBus);
      osc.start(startTime);
      osc.stop(startTime + durationSec * 0.26);
    }

    const tailOsc = context.createOscillator();
    tailOsc.type = 'square';
    tailOsc.frequency.setValueAtTime(midiToFrequency(84), time + durationSec * 0.72);
    tailOsc.frequency.exponentialRampToValueAtTime(midiToFrequency(93), time + durationSec * 0.96);
    const tailGain = context.createGain();
    tailGain.gain.setValueAtTime(0.0001, time + durationSec * 0.72);
    tailGain.gain.exponentialRampToValueAtTime(0.11, time + durationSec * 0.76);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, time + durationSec);
    tailOsc.connect(tailGain);
    tailGain.connect(sfxBus);
    tailOsc.start(time + durationSec * 0.72);
    tailOsc.stop(time + durationSec + 0.02);
  }

  private scheduleEnemyDeathSfx(time: number): void {
    const context = this.audioContext;
    const sfxBus = this.sfxBus;
    if (!context || !sfxBus) {
      return;
    }

    const impactOsc = context.createOscillator();
    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(260, time);
    impactOsc.frequency.exponentialRampToValueAtTime(78, time + 0.19);

    const impactFilter = context.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.setValueAtTime(2100, time);
    impactFilter.frequency.exponentialRampToValueAtTime(520, time + 0.18);
    impactFilter.Q.value = 1.25;

    const impactGain = context.createGain();
    impactGain.gain.setValueAtTime(0.0001, time);
    impactGain.gain.exponentialRampToValueAtTime(0.28, time + 0.007);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    impactOsc.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(sfxBus);
    impactOsc.start(time);
    impactOsc.stop(time + 0.23);

    const harmonicOsc = context.createOscillator();
    harmonicOsc.type = 'square';
    harmonicOsc.frequency.setValueAtTime(430, time + 0.004);
    harmonicOsc.frequency.exponentialRampToValueAtTime(145, time + 0.12);

    const harmonicGain = context.createGain();
    harmonicGain.gain.setValueAtTime(0.0001, time + 0.004);
    harmonicGain.gain.exponentialRampToValueAtTime(0.1, time + 0.012);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);

    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(sfxBus);
    harmonicOsc.start(time + 0.004);
    harmonicOsc.stop(time + 0.14);

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer(context);
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2200, time);
    noiseFilter.frequency.exponentialRampToValueAtTime(1100, time + 0.08);
    noiseFilter.Q.value = 0.9;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.21, time + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(sfxBus);
    noiseSource.start(time);
    noiseSource.stop(time + 0.11);
  }

  private scheduleLavaDeathSfx(time: number): void {
    const context = this.audioContext;
    const sfxBus = this.sfxBus;
    if (!context || !sfxBus) {
      return;
    }

    const whooshNoise = context.createBufferSource();
    whooshNoise.buffer = this.getNoiseBuffer(context);
    const whooshFilter = context.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(420, time);
    whooshFilter.frequency.exponentialRampToValueAtTime(2400, time + 0.2);
    whooshFilter.Q.value = 0.78;
    const whooshGain = context.createGain();
    whooshGain.gain.setValueAtTime(0.0001, time);
    whooshGain.gain.exponentialRampToValueAtTime(0.24, time + 0.01);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    whooshNoise.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(sfxBus);
    whooshNoise.start(time);
    whooshNoise.stop(time + 0.26);

    const fizzOsc = context.createOscillator();
    fizzOsc.type = 'sawtooth';
    fizzOsc.frequency.setValueAtTime(165, time);
    fizzOsc.frequency.exponentialRampToValueAtTime(68, time + 0.21);
    const fizzGain = context.createGain();
    fizzGain.gain.setValueAtTime(0.0001, time);
    fizzGain.gain.exponentialRampToValueAtTime(0.15, time + 0.01);
    fizzGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.23);
    fizzOsc.connect(fizzGain);
    fizzGain.connect(sfxBus);
    fizzOsc.start(time);
    fizzOsc.stop(time + 0.24);

    const popDelays = [0.04, 0.095, 0.15];
    const popFrequencies = [430, 510, 620];
    for (let i = 0; i < popDelays.length; i += 1) {
      const popTime = time + popDelays[i];
      const popOsc = context.createOscillator();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(popFrequencies[i], popTime);
      popOsc.frequency.exponentialRampToValueAtTime(popFrequencies[i] * 0.52, popTime + 0.03);

      const popGain = context.createGain();
      popGain.gain.setValueAtTime(0.0001, popTime);
      popGain.gain.exponentialRampToValueAtTime(0.1 - i * 0.015, popTime + 0.005);
      popGain.gain.exponentialRampToValueAtTime(0.0001, popTime + 0.045);

      popOsc.connect(popGain);
      popGain.connect(sfxBus);
      popOsc.start(popTime);
      popOsc.stop(popTime + 0.05);
    }
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) {
      return this.noiseBuffer;
    }

    const durationSeconds = 0.24;
    const sampleCount = Math.floor(context.sampleRate * durationSeconds);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x8e5f31c2;
    for (let i = 0; i < sampleCount; i += 1) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }
}
