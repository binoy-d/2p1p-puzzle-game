import { createInitialState, restartLevel, setLevel, update } from '../core';
import type { Direction, GameState, ParsedLevel } from '../core';
import { submitScore } from '../runtime/backendApi';
import { saveSettings, type GameSettings } from '../runtime/settingsStorage';
import {
  detectEnemyImpact,
  detectGoalFinishImpact,
  detectLavaImpact,
  type EnemyImpact,
  type LavaImpact,
} from './deathImpact';

export type Screen = 'intro' | 'main' | 'level-select' | 'settings' | 'editor' | 'playing' | 'paused';

const DEATH_ANIMATION_MS = 620;
const WIN_TRANSITION_MS = 980;

export interface EnemyDeathAnimationSnapshot extends EnemyImpact {
  kind: 'enemy';
  sequence: number;
  startedAtMs: number;
  durationMs: number;
}

export interface LavaDeathAnimationSnapshot extends LavaImpact {
  kind: 'lava';
  sequence: number;
  startedAtMs: number;
  durationMs: number;
}

export type DeathAnimationSnapshot = EnemyDeathAnimationSnapshot | LavaDeathAnimationSnapshot;

export interface WinTransitionSnapshot {
  sequence: number;
  startedAtMs: number;
  durationMs: number;
  sourceLevelId: string;
  sourceLevelWidth: number;
  sourceLevelHeight: number;
  portal: {
    x: number;
    y: number;
  };
  playerId: number;
}

export interface ControllerSnapshot {
  screen: Screen;
  gameState: GameState;
  levels: ParsedLevel[];
  settings: GameSettings;
  selectedLevelIndex: number;
  playerName: string;
  statusMessage: string | null;
  deathAnimation: DeathAnimationSnapshot | null;
  winTransition: WinTransitionSnapshot | null;
}

type Subscriber = (snapshot: ControllerSnapshot) => void;

export class GameController {
  private levels: ParsedLevel[];

  private gameState: GameState;

  private settings: GameSettings;

  private screen: Screen = 'intro';

  private selectedLevelIndex = 0;

  private statusMessage: string | null = null;

  private readonly inputQueue: Direction[] = [];

  private readonly subscribers = new Set<Subscriber>();

  private settingsReturnScreen: Screen = 'main';

  private levelSelectReturnScreen: Screen = 'main';

  private playerName = '';

  private levelStartedAtMs = Date.now();

  private pendingResetState: GameState | null = null;

  private pendingResetDeadlineMs = 0;

  private deathAnimation: DeathAnimationSnapshot | null = null;

  private deathAnimationSequence = 0;

  private winTransition: WinTransitionSnapshot | null = null;

  private winTransitionSequence = 0;

  public constructor(levels: ParsedLevel[], settings: GameSettings) {
    if (levels.length === 0) {
      throw new Error('Cannot initialize controller without levels.');
    }

    this.levels = levels.slice();
    this.settings = settings;
    this.gameState = createInitialState(this.levels, 0);
  }

  public subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getSnapshot());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getSnapshot(): ControllerSnapshot {
    return {
      screen: this.screen,
      gameState: this.gameState,
      levels: this.levels,
      settings: this.settings,
      selectedLevelIndex: this.selectedLevelIndex,
      playerName: this.playerName,
      statusMessage: this.statusMessage,
      deathAnimation: this.deathAnimation,
      winTransition: this.winTransition,
    };
  }

  public startSelectedLevel(): void {
    this.startLevel(this.selectedLevelIndex);
  }

  public startLevel(levelIndex: number): void {
    if (!this.playerName) {
      this.statusMessage = 'Enter a player name before playing.';
      this.emit();
      return;
    }

    const clamped = Math.max(0, Math.min(levelIndex, this.levels.length - 1));
    this.selectedLevelIndex = clamped;
    this.gameState = setLevel(this.gameState, clamped);
    this.screen = 'playing';
    this.statusMessage = null;
    this.inputQueue.length = 0;
    this.levelStartedAtMs = Date.now();
    this.clearTransientEffects();
    this.emit();
  }

  public openMainMenu(): void {
    this.screen = 'intro';
    this.inputQueue.length = 0;
    this.clearTransientEffects();
    this.emit();
  }

  public finishIntro(): void {
    if (this.screen !== 'intro') {
      return;
    }

    this.screen = 'main';
    this.emit();
  }

  public openEditor(): void {
    this.screen = 'editor';
    this.inputQueue.length = 0;
    this.clearTransientEffects();
    this.emit();
  }

  public openLevelSelect(): void {
    if (this.screen !== 'paused' && this.screen !== 'intro') {
      return;
    }

    this.levelSelectReturnScreen = this.screen;
    this.screen = 'level-select';
    this.emit();
  }

  public closeLevelSelect(): void {
    if (this.screen !== 'level-select') {
      return;
    }

    this.screen = this.levelSelectReturnScreen;
    this.emit();
  }

  public openSettings(): void {
    this.settingsReturnScreen = this.screen;
    this.screen = 'settings';
    this.emit();
  }

  public closeSettings(): void {
    this.screen = this.settingsReturnScreen;
    this.emit();
  }

  public togglePause(): void {
    if (this.screen === 'playing') {
      this.screen = 'paused';
      this.emit();
      return;
    }

    if (this.screen === 'paused') {
      this.screen = 'playing';
      this.emit();
    }
  }

  public openPauseMenu(): void {
    if (this.screen !== 'playing') {
      return;
    }

    this.screen = 'paused';
    this.emit();
  }

  public restartCurrentLevel(): void {
    this.gameState = restartLevel(this.gameState);
    this.screen = 'playing';
    this.statusMessage = null;
    this.inputQueue.length = 0;
    this.levelStartedAtMs = Date.now();
    this.clearTransientEffects();
    this.emit();
  }

  public queueDirection(direction: Direction): void {
    if (this.screen !== 'playing') {
      return;
    }

    if (this.pendingResetState) {
      return;
    }

    if (this.inputQueue.length >= 4) {
      return;
    }

    this.inputQueue.push(direction);
  }

  public fixedUpdate(dtMs: number): void {
    if (this.screen !== 'playing') {
      return;
    }

    const nowMs = Date.now();
    if (this.winTransition && nowMs >= this.winTransition.startedAtMs + this.winTransition.durationMs) {
      this.winTransition = null;
    }

    if (this.pendingResetState) {
      if (nowMs >= this.pendingResetDeadlineMs) {
        this.gameState = this.pendingResetState;
        this.levelStartedAtMs = nowMs;
        this.clearTransientEffects();
        this.emit();
      }
      return;
    }

    const direction = this.inputQueue.shift() ?? null;
    if (!direction) {
      return;
    }

    const previous = this.gameState;
    const completedLevelId = previous.levelId;
    const completedMoves = previous.moves + 1;

    const next = update(previous, { direction }, dtMs);
    if (next.lastEvent === 'level-reset') {
      const enemyImpact = detectEnemyImpact(previous, direction);
      if (enemyImpact) {
        this.queueDeathReset(next, nowMs, {
          kind: 'enemy',
          ...enemyImpact,
        });
        this.statusMessage = `Player ${enemyImpact.playerId + 1} hit enemy ${enemyImpact.enemyId + 1}.`;
        this.emit();
        return;
      }

      const lavaImpact = detectLavaImpact(previous, direction);
      if (lavaImpact) {
        this.queueDeathReset(next, nowMs, {
          kind: 'lava',
          ...lavaImpact,
        });
        this.statusMessage = `Player ${lavaImpact.playerId + 1} fell into lava.`;
        this.emit();
        return;
      }
    }

    this.gameState = next;
    this.deathAnimation = null;

    if (next.lastEvent === 'level-advanced') {
      const finishImpact = detectGoalFinishImpact(previous, direction);
      const sourceLevel = previous.levels[previous.levelId];
      if (sourceLevel) {
        const fallbackPortal =
          sourceLevel.grid
            .flatMap((row, y) => row.map((tile, x) => ({ tile, x, y })))
            .find((cell) => cell.tile === '!') ?? null;

        const portal = finishImpact?.portal ?? (fallbackPortal ? { x: fallbackPortal.x, y: fallbackPortal.y } : null);
        if (portal) {
          this.winTransitionSequence += 1;
          this.winTransition = {
            sequence: this.winTransitionSequence,
            startedAtMs: nowMs,
            durationMs: WIN_TRANSITION_MS,
            sourceLevelId: previous.levelId,
            sourceLevelWidth: sourceLevel.width,
            sourceLevelHeight: sourceLevel.height,
            portal,
            playerId: finishImpact?.playerId ?? 0,
          };
        }
      }

      this.selectedLevelIndex = next.levelIndex;
      this.statusMessage = `Level ${next.levelIndex + 1}`;
      const durationMs = Math.max(0, nowMs - this.levelStartedAtMs);
      this.levelStartedAtMs = nowMs;
      void this.submitCompletedScore(completedLevelId, completedMoves, durationMs);
    } else if (next.lastEvent === 'level-reset') {
      this.levelStartedAtMs = nowMs;
    }

    if (next.status === 'game-complete') {
      const finalMoves = next.lastEvent === 'game-complete' ? next.moves : completedMoves;
      const durationMs = Math.max(0, nowMs - this.levelStartedAtMs);
      void this.submitCompletedScore(completedLevelId, finalMoves, durationMs);
      this.screen = 'main';
      this.statusMessage = 'All levels complete.';
      this.selectedLevelIndex = this.levels.length - 1;
      this.inputQueue.length = 0;
      this.levelStartedAtMs = nowMs;
      this.clearTransientEffects();
    }

    this.emit();
  }

  public setSelectedLevel(levelIndex: number): void {
    const clamped = Math.max(0, Math.min(levelIndex, this.levels.length - 1));
    this.selectedLevelIndex = clamped;
    this.emit();
  }

  public setPlayerName(name: string): void {
    this.playerName = name.trim().slice(0, 32);
    this.emit();
  }

  public getPlayerName(): string {
    return this.playerName;
  }

  public upsertLevel(level: ParsedLevel): number {
    const existingIndex = this.levels.findIndex((entry) => entry.id === level.id);
    if (existingIndex === -1) {
      this.levels.push(level);
    } else {
      this.levels[existingIndex] = level;
    }

    const levelIndex = existingIndex === -1 ? this.levels.length - 1 : existingIndex;
    this.selectedLevelIndex = levelIndex;
    this.gameState = createInitialState(this.levels, levelIndex);
    this.statusMessage = `Saved level ${level.id}`;
    this.levelStartedAtMs = Date.now();
    this.clearTransientEffects();
    this.emit();
    return levelIndex;
  }

  public setMusicVolume(volume: number): void {
    this.settings = {
      ...this.settings,
      musicVolume: Math.min(1, Math.max(0, volume)),
    };
    saveSettings(this.settings);
    this.emit();
  }

  public setSfxVolume(volume: number): void {
    this.settings = {
      ...this.settings,
      sfxVolume: Math.min(1, Math.max(0, volume)),
    };
    saveSettings(this.settings);
    this.emit();
  }

  public setLightingEnabled(enabled: boolean): void {
    this.settings = {
      ...this.settings,
      lightingEnabled: enabled,
    };
    saveSettings(this.settings);
    this.emit();
  }

  public isPlaying(): boolean {
    return this.screen === 'playing';
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private clearTransientEffects(): void {
    this.pendingResetState = null;
    this.pendingResetDeadlineMs = 0;
    this.deathAnimation = null;
    this.winTransition = null;
  }

  private queueDeathReset(
    pendingResetState: GameState,
    nowMs: number,
    deathAnimation:
      | Omit<EnemyDeathAnimationSnapshot, 'sequence' | 'startedAtMs' | 'durationMs'>
      | Omit<LavaDeathAnimationSnapshot, 'sequence' | 'startedAtMs' | 'durationMs'>,
  ): void {
    this.pendingResetState = pendingResetState;
    this.pendingResetDeadlineMs = nowMs + DEATH_ANIMATION_MS;
    this.deathAnimationSequence += 1;
    this.deathAnimation = {
      ...deathAnimation,
      sequence: this.deathAnimationSequence,
      startedAtMs: nowMs,
      durationMs: DEATH_ANIMATION_MS,
    };
    this.inputQueue.length = 0;
  }

  private async submitCompletedScore(levelId: string, moves: number, durationMs: number): Promise<void> {
    if (!this.playerName) {
      return;
    }

    try {
      await submitScore({
        levelId,
        playerName: this.playerName,
        moves,
        durationMs,
      });
    } catch {
      // Non-fatal: keep gameplay responsive if backend is unavailable.
    }
  }
}
