import type { GameController } from '../app/gameController';
import { STEPS_PER_BAR, backingTrackStepEvents, midiToFrequency } from './backingTrackPattern';

const BPM = 124;
const STEP_DURATION_SECONDS = 60 / BPM / 4;
const SCHEDULE_AHEAD_SECONDS = 0.22;
const SCHEDULER_INTERVAL_MS = 36;

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

  private masterGain: GainNode | null = null;

  private drumBus: GainNode | null = null;

  private synthBus: GainNode | null = null;

  private delaySend: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimerId: number | null = null;

  private nextStepTime = 0;

  private stepInBar = 0;

  private barIndex = 0;

  private started = false;

  private desiredVolume = 0.6;

  public constructor(controller: GameController) {
    this.unsubscribeFromController = controller.subscribe((snapshot) => {
      this.setVolume(snapshot.settings.volume);
    });

    this.bindUnlockListeners();
  }

  public destroy(): void {
    this.stopScheduler();
    this.unbindUnlockListeners();
    this.unsubscribeFromController();
    const context = this.audioContext;
    this.audioContext = null;
    this.masterGain = null;
    this.drumBus = null;
    this.synthBus = null;
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
    this.applyVolume();
    this.startScheduler();
    this.unbindUnlockListeners();
  }

  private setVolume(volume: number): void {
    this.desiredVolume = clamp(volume, 0, 1);
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const gain = Math.pow(this.desiredVolume, 1.2) * 0.24;
    this.masterGain.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.04);
  }

  private buildAudioGraph(context: AudioContext): void {
    const masterGain = context.createGain();
    masterGain.gain.value = 0;

    const drumBus = context.createGain();
    drumBus.gain.value = 0.9;
    drumBus.connect(masterGain);

    const synthBus = context.createGain();
    synthBus.gain.value = 0.78;
    synthBus.connect(masterGain);

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
    wet.connect(masterGain);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 2.8;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.22;
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    this.masterGain = masterGain;
    this.drumBus = drumBus;
    this.synthBus = synthBus;
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

    while (this.nextStepTime < this.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleStep(this.nextStepTime, this.stepInBar, this.barIndex);
      this.nextStepTime += STEP_DURATION_SECONDS;
      this.stepInBar += 1;
      if (this.stepInBar >= STEPS_PER_BAR) {
        this.stepInBar = 0;
        this.barIndex = (this.barIndex + 1) % 4;
      }
    }
  }

  private scheduleStep(time: number, step: number, bar: number): void {
    const events = backingTrackStepEvents(step, bar);

    if (events.kick) {
      this.scheduleKick(time);
    }
    if (events.snare) {
      this.scheduleSnare(time);
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
