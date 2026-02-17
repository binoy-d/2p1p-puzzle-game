import type { ControllerSnapshot, GameController } from '../app/gameController';
import { parseLevelText } from '../core/levelParser';
import type { ParsedLevel } from '../core/types';
import {
  EDITOR_TILE_PALETTE,
  cloneGrid,
  createGrid,
  ensureParseableLevel,
  levelIdFromInput,
  nextCustomLevelId,
  resizeGrid,
  sanitizeDimension,
  serializeGrid,
  validateGridForEditor,
} from '../editor/levelEditorUtils';
import { fetchTopScores, saveCustomLevel, type LevelScoreRecord } from '../runtime/backendApi';
import { isTextInputFocused } from '../runtime/inputFocus';
import { getLevelLabel } from '../runtime/levelMeta';
import { LockstepIntroCinematic } from './introCinematic';

function asElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required selector: ${selector}`);
  }

  return element as T;
}

function describeTile(tile: string): string {
  if (tile === '#') {
    return 'Wall (#)';
  }
  if (tile === ' ') {
    return 'Floor (space)';
  }
  if (tile === 'P') {
    return 'Player spawn (P)';
  }
  if (tile === '!') {
    return 'Goal (!)';
  }
  if (tile === 'x') {
    return 'Lava (x)';
  }

  return `Enemy path (${tile})`;
}

function tileClass(tile: string): string {
  if (tile === '#') {
    return 'tile-wall';
  }
  if (tile === ' ') {
    return 'tile-floor';
  }
  if (tile === 'P') {
    return 'tile-player';
  }
  if (tile === '!') {
    return 'tile-goal';
  }
  if (tile === 'x') {
    return 'tile-lava';
  }

  return 'tile-path';
}

function levelPreviewTileClass(tile: string): string {
  if (tile === '#') {
    return 'level-card-cell-wall';
  }
  if (tile === ' ') {
    return 'level-card-cell-floor';
  }
  if (tile === 'P') {
    return 'level-card-cell-player';
  }
  if (tile === '!') {
    return 'level-card-cell-goal';
  }
  if (tile === 'x') {
    return 'level-card-cell-lava';
  }

  return 'level-card-cell-path';
}

function isIntroStartKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}

export class OverlayUI {
  private readonly root: HTMLElement;

  private readonly controller: GameController;

  private readonly levelSelect: HTMLSelectElement;

  private readonly levelSelectGrid: HTMLElement;

  private readonly levelSelectCurrentText: HTMLElement;

  private readonly statusText: HTMLElement;

  private readonly playerNameInput: HTMLInputElement;

  private readonly playButton: HTMLButtonElement;

  private readonly levelStartButton: HTMLButtonElement;

  private readonly mainCurrentLevelText: HTMLElement;

  private readonly musicVolumeSlider: HTMLInputElement;

  private readonly sfxVolumeSlider: HTMLInputElement;

  private readonly lightingToggle: HTMLInputElement;

  private readonly panels: Record<string, HTMLElement>;

  private readonly introPanel: HTMLElement;

  private readonly introStartButton: HTMLButtonElement;

  private readonly introPlayerNameInput: HTMLInputElement;

  private readonly introCurrentLevelText: HTMLElement;

  private readonly introSettingsPanel: HTMLElement;

  private readonly introSettingsButton: HTMLButtonElement;

  private readonly introSettingsCloseButton: HTMLButtonElement;

  private readonly introMusicVolumeSlider: HTMLInputElement;

  private readonly introSfxVolumeSlider: HTMLInputElement;

  private readonly introLightingToggle: HTMLInputElement;

  private readonly introCinematic: LockstepIntroCinematic;

  private readonly scoreList: HTMLOListElement;

  private readonly scoreStatus: HTMLElement;

  private readonly hudScoreboard: HTMLElement;

  private readonly hudScoreList: HTMLOListElement;

  private readonly hudScoreStatus: HTMLElement;

  private readonly editorSourceSelect: HTMLSelectElement;

  private readonly editorIdInput: HTMLInputElement;

  private readonly editorWidthInput: HTMLInputElement;

  private readonly editorHeightInput: HTMLInputElement;

  private readonly editorPlayerNameInput: HTMLInputElement;

  private readonly editorGridRoot: HTMLElement;

  private readonly editorFeedback: HTMLElement;

  private readonly editorSelectedTile: HTMLElement;

  private readonly editorPaletteRoot: HTMLElement;

  private readonly editorSaveButton: HTMLButtonElement;

  private readonly editorSavePlayButton: HTMLButtonElement;

  private editorPaletteButtons = new Map<string, HTMLButtonElement>();

  private editorGrid: string[][] = this.createBlankGrid(25, 16);

  private editorTile = '#';

  private lastSnapshot: ControllerSnapshot | null = null;

  private readonly scoreCache = new Map<string, LevelScoreRecord[]>();

  private scoreRequestNonce = 0;

  private inFlightScoreLevelId: string | null = null;

  private lastRenderedScreen: ControllerSnapshot['screen'] | null = null;

  private lastRenderedHudLevelId: string | null = null;

  private levelSelectCardButtons = new Map<number, HTMLButtonElement>();

  public constructor(root: HTMLElement, controller: GameController) {
    this.root = root;
    this.controller = controller;

    this.root.innerHTML = this.buildMarkup();

    this.panels = {
      intro: asElement<HTMLElement>(this.root, '[data-panel="intro"]'),
      main: asElement<HTMLElement>(this.root, '[data-panel="main"]'),
      levelSelect: asElement<HTMLElement>(this.root, '[data-panel="level-select"]'),
      settings: asElement<HTMLElement>(this.root, '[data-panel="settings"]'),
      editor: asElement<HTMLElement>(this.root, '[data-panel="editor"]'),
      pause: asElement<HTMLElement>(this.root, '[data-panel="pause"]'),
    };

    this.introPanel = asElement<HTMLElement>(this.root, '[data-panel="intro"]');
    this.introStartButton = asElement<HTMLButtonElement>(this.root, '#btn-intro-start');
    this.introPlayerNameInput = asElement<HTMLInputElement>(this.root, '#intro-player-name-input');
    this.introCurrentLevelText = asElement<HTMLElement>(this.root, '#intro-current-level');
    this.introSettingsPanel = asElement<HTMLElement>(this.root, '#intro-settings-panel');
    this.introSettingsButton = asElement<HTMLButtonElement>(this.root, '#btn-intro-settings-toggle');
    this.introSettingsCloseButton = asElement<HTMLButtonElement>(this.root, '#btn-intro-settings-close');
    this.introMusicVolumeSlider = asElement<HTMLInputElement>(this.root, '#intro-settings-music-volume');
    this.introSfxVolumeSlider = asElement<HTMLInputElement>(this.root, '#intro-settings-sfx-volume');
    this.introLightingToggle = asElement<HTMLInputElement>(this.root, '#intro-settings-lighting');
    this.introCinematic = new LockstepIntroCinematic({
      elements: {
        panel: this.introPanel,
        canvas: asElement<HTMLCanvasElement>(this.root, '#intro-canvas'),
        title: asElement<HTMLElement>(this.root, '#intro-title'),
        line: asElement<HTMLElement>(this.root, '#intro-line'),
        skipHint: asElement<HTMLElement>(this.root, '#intro-skip-hint'),
      },
      onComplete: () => {
        this.controller.finishIntro();
      },
    });

    this.levelSelect = asElement<HTMLSelectElement>(this.root, '#level-select-input');
    this.levelSelectGrid = asElement<HTMLElement>(this.root, '#level-select-grid');
    this.levelSelectCurrentText = asElement<HTMLElement>(this.root, '#level-select-current');
    this.statusText = asElement<HTMLElement>(this.root, '#menu-status');
    this.playerNameInput = asElement<HTMLInputElement>(this.root, '#player-name-input');
    this.mainCurrentLevelText = asElement<HTMLElement>(this.root, '#main-current-level');
    this.playButton = asElement<HTMLButtonElement>(this.root, '#btn-play');
    this.levelStartButton = asElement<HTMLButtonElement>(this.root, '#btn-level-start');
    this.musicVolumeSlider = asElement<HTMLInputElement>(this.root, '#settings-music-volume');
    this.sfxVolumeSlider = asElement<HTMLInputElement>(this.root, '#settings-sfx-volume');
    this.lightingToggle = asElement<HTMLInputElement>(this.root, '#settings-lighting');
    this.scoreList = asElement<HTMLOListElement>(this.root, '#score-list');
    this.scoreStatus = asElement<HTMLElement>(this.root, '#score-status');
    this.hudScoreboard = asElement<HTMLElement>(this.root, '#hud-scoreboard');
    this.hudScoreList = asElement<HTMLOListElement>(this.root, '#hud-score-list');
    this.hudScoreStatus = asElement<HTMLElement>(this.root, '#hud-score-status');

    this.editorSourceSelect = asElement<HTMLSelectElement>(this.root, '#editor-source-level');
    this.editorIdInput = asElement<HTMLInputElement>(this.root, '#editor-level-id');
    this.editorWidthInput = asElement<HTMLInputElement>(this.root, '#editor-width');
    this.editorHeightInput = asElement<HTMLInputElement>(this.root, '#editor-height');
    this.editorPlayerNameInput = asElement<HTMLInputElement>(this.root, '#editor-player-name-input');
    this.editorGridRoot = asElement<HTMLElement>(this.root, '#editor-grid');
    this.editorFeedback = asElement<HTMLElement>(this.root, '#editor-feedback');
    this.editorSelectedTile = asElement<HTMLElement>(this.root, '#editor-selected-tile');
    this.editorPaletteRoot = asElement<HTMLElement>(this.root, '#editor-palette');
    this.editorSaveButton = asElement<HTMLButtonElement>(this.root, '#btn-editor-save');
    this.editorSavePlayButton = asElement<HTMLButtonElement>(this.root, '#btn-editor-save-play');

    this.buildPalette();
    this.renderEditorGrid();
    this.bindEvents();
    this.controller.subscribe((snapshot) => this.render(snapshot));
  }

  private buildMarkup(): string {
    return `
      <section class="intro-overlay" data-panel="intro">
        <canvas id="intro-canvas" aria-hidden="true"></canvas>
        <div class="intro-settings-corner">
          <button type="button" id="btn-intro-settings-toggle" aria-label="Open intro settings">Tune</button>
          <div class="intro-settings-panel" id="intro-settings-panel" hidden>
            <h3>Settings</h3>
            <label for="intro-settings-music-volume">Music Volume</label>
            <input id="intro-settings-music-volume" type="range" min="0" max="1" step="0.05" />
            <label for="intro-settings-sfx-volume">SFX Volume</label>
            <input id="intro-settings-sfx-volume" type="range" min="0" max="1" step="0.05" />
            <label class="checkbox-row">
              <input id="intro-settings-lighting" type="checkbox" />
              Lighting effects
            </label>
            <button type="button" id="btn-intro-open-editor">Level Editor</button>
            <button type="button" id="btn-intro-settings-close">Done</button>
          </div>
        </div>
        <div class="intro-content">
          <h1 id="intro-title">LOCKSTEP</h1>
          <p id="intro-line"></p>
          <p id="intro-skip-hint" class="intro-skip-hint">Press Start anytime to skip</p>
        </div>
        <aside class="intro-menu-dock">
          <div class="intro-menu-fields">
            <h2>Enter Lockstep</h2>
            <label for="intro-player-name-input">Player Name</label>
            <input id="intro-player-name-input" type="text" maxlength="32" placeholder="Enter your name" />
            <div class="intro-level-readout">
              Current Level
              <strong id="intro-current-level">Level 1</strong>
            </div>
            <p class="intro-level-hint">Press <kbd>ESC</kbd> in-game to open Level Select.</p>
          </div>
          <div class="button-row intro-button-row">
            <button type="button" id="btn-intro-start">Start</button>
            <button type="button" id="btn-intro-level-select">Levels</button>
          </div>
        </aside>
      </section>

      <div class="menu-status" id="menu-status" aria-live="polite"></div>
      <aside class="hud-scoreboard" id="hud-scoreboard" hidden>
        <h3>High Scores</h3>
        <div id="hud-score-status" class="score-status">Lower is better (moves, then time)</div>
        <ol id="hud-score-list" class="score-list"></ol>
      </aside>

      <section class="menu-panel" data-panel="main">
        <h1>LOCKSTEP</h1>
        <p>Move all white squares to green goals. Avoid lava and enemies.</p>
        <p class="main-level-readout">Current Level: <strong id="main-current-level">Level 1</strong></p>
        <p class="main-level-hint">Level Select is available in the <kbd>ESC</kbd> pause menu.</p>
        <label for="player-name-input">Player Name (required)</label>
        <input id="player-name-input" type="text" maxlength="32" placeholder="Enter your name" />

        <div class="button-row">
          <button type="button" id="btn-play">Play</button>
          <button type="button" id="btn-open-editor">Level Editor</button>
          <button type="button" id="btn-main-settings">Settings</button>
        </div>
      </section>

      <section class="menu-panel menu-panel-level-select-page" data-panel="level-select" hidden>
        <header class="level-select-header">
          <div>
            <h2>Level Select</h2>
            <p>Pick a map and chase faster solves. Lower moves and time rank higher.</p>
          </div>
          <div class="level-select-header-actions">
            <button type="button" id="btn-level-start">Play Selected</button>
            <button type="button" id="btn-level-back">Back</button>
          </div>
        </header>

        <div class="level-select-layout">
          <section class="level-select-grid-panel">
            <select id="level-select-input" class="level-select-hidden-input" aria-hidden="true" tabindex="-1"></select>
            <div id="level-select-grid" class="level-select-grid" role="listbox" aria-label="Level grid"></div>
          </section>

          <aside class="level-select-score-panel">
            <h3 id="level-select-current">Level 1</h3>
            <div id="score-status" class="score-status">Top 10 scores (lower is better)</div>
            <ol id="score-list" class="score-list level-select-score-list"></ol>
          </aside>
        </div>
      </section>

      <section class="menu-panel" data-panel="settings" hidden>
        <h2>Settings</h2>
        <label for="settings-music-volume">Music Volume</label>
        <input id="settings-music-volume" type="range" min="0" max="1" step="0.05" />

        <label for="settings-sfx-volume">SFX Volume</label>
        <input id="settings-sfx-volume" type="range" min="0" max="1" step="0.05" />

        <label class="checkbox-row">
          <input id="settings-lighting" type="checkbox" />
          Lighting effects
        </label>

        <div class="button-row">
          <button type="button" id="btn-settings-back">Back</button>
        </div>
      </section>

      <section class="menu-panel menu-panel-editor-page" data-panel="editor" hidden>
        <header class="editor-page-header">
          <div>
            <h2>Level Editor</h2>
            <p>Choose a template, paint tiles, then save and play.</p>
          </div>
          <div class="editor-page-header-actions">
            <label for="editor-player-name-input">Player Name</label>
            <input id="editor-player-name-input" type="text" maxlength="32" placeholder="Required to save/play" />
            <button type="button" id="btn-editor-back">Back to Intro</button>
          </div>
        </header>

        <div class="editor-page-layout">
          <aside class="editor-sidebar">
            <section class="editor-card">
              <h3>Template</h3>
              <label for="editor-source-level">Base Level</label>
              <select id="editor-source-level"></select>
              <div class="button-row editor-card-buttons">
                <button type="button" id="btn-editor-load">Load</button>
                <button type="button" id="btn-editor-new">New Blank</button>
              </div>
            </section>

            <section class="editor-card">
              <h3>Map Setup</h3>
              <label for="editor-level-id">Level ID</label>
              <input id="editor-level-id" type="text" placeholder="custom-level-1" />
              <div class="editor-dimensions">
                <div>
                  <label for="editor-width">Width</label>
                  <input id="editor-width" type="number" min="4" max="80" value="25" />
                </div>
                <div>
                  <label for="editor-height">Height</label>
                  <input id="editor-height" type="number" min="4" max="80" value="16" />
                </div>
              </div>
              <button type="button" id="btn-editor-resize">Resize Grid</button>
            </section>

            <section class="editor-card">
              <h3>Tiles</h3>
              <div class="editor-palette" id="editor-palette"></div>
              <p class="editor-selected">Selected: <strong id="editor-selected-tile">Wall (#)</strong></p>
            </section>

            <section class="editor-card">
              <h3>Save</h3>
              <div class="button-row editor-card-buttons">
                <button type="button" id="btn-editor-save">Save Level</button>
                <button type="button" id="btn-editor-save-play">Save + Play</button>
                <button type="button" id="btn-editor-export">Download .txt</button>
              </div>
              <div class="editor-feedback" id="editor-feedback" aria-live="polite"></div>
            </section>
          </aside>

          <section class="editor-workspace">
            <div class="editor-grid-scroll">
              <div class="editor-grid" id="editor-grid" role="grid" aria-label="Level tile grid"></div>
            </div>
          </section>
        </div>
      </section>

      <section class="menu-panel" data-panel="pause" hidden>
        <h2>Paused</h2>
        <p>Resume play or jump to another level.</p>
        <div class="button-row">
          <button type="button" id="btn-resume">Resume</button>
          <button type="button" id="btn-restart">Restart</button>
          <button type="button" id="btn-pause-level-select">Level Select</button>
          <button type="button" id="btn-main-menu">Main Menu</button>
          <button type="button" id="btn-pause-settings">Settings</button>
        </div>
      </section>
    `;
  }

  private bindEvents(): void {
    this.introStartButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.startFromIntro();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-intro-open-editor').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeIntroSettings();
      const snapshot = this.controller.getSnapshot();
      const source = snapshot.levels[snapshot.selectedLevelIndex] ?? snapshot.levels[0];
      if (source) {
        this.loadLevelIntoEditor(source);
      }
      this.controller.openEditor();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-intro-level-select').addEventListener('click', () => {
      this.closeIntroSettings();
      this.controller.openLevelSelect();
      void this.loadScoresForSelectedLevel(true);
    });

    this.introSettingsButton.addEventListener('click', () => {
      this.introSettingsPanel.hidden = !this.introSettingsPanel.hidden;
      if (!this.introSettingsPanel.hidden) {
        this.introMusicVolumeSlider.focus();
      }
    });

    this.introSettingsCloseButton.addEventListener('click', () => {
      this.closeIntroSettings();
      this.introSettingsButton.focus();
    });

    this.introPanel.addEventListener('pointerdown', (event) => {
      if (this.introSettingsPanel.hidden) {
        return;
      }

      const target = event.target as Node;
      const clickedToggle = target === this.introSettingsButton || this.introSettingsButton.contains(target);
      if (clickedToggle) {
        return;
      }

      const clickedPanel = this.introSettingsPanel.contains(target);
      if (!clickedPanel) {
        this.closeIntroSettings();
      }
    });

    this.playButton.addEventListener('click', () => {
      this.controller.startSelectedLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-open-editor').addEventListener('click', () => {
      const snapshot = this.controller.getSnapshot();
      const source = snapshot.levels[snapshot.selectedLevelIndex] ?? snapshot.levels[0];
      if (source) {
        this.loadLevelIntoEditor(source);
      }
      this.controller.openEditor();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-main-settings').addEventListener('click', () => {
      this.controller.openSettings();
    });

    this.levelStartButton.addEventListener('click', () => {
      const level = Number.parseInt(this.levelSelect.value, 10);
      this.controller.startLevel(level);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-level-back').addEventListener('click', () => {
      this.controller.closeLevelSelect();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-settings-back').addEventListener('click', () => {
      this.controller.closeSettings();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-resume').addEventListener('click', () => {
      this.controller.togglePause();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-restart').addEventListener('click', () => {
      this.controller.restartCurrentLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-main-menu').addEventListener('click', () => {
      this.controller.openMainMenu();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-pause-level-select').addEventListener('click', () => {
      this.controller.openLevelSelect();
      void this.loadScoresForSelectedLevel(true);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-pause-settings').addEventListener('click', () => {
      this.controller.openSettings();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-load').addEventListener('click', () => {
      this.loadSelectedEditorLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-new').addEventListener('click', () => {
      this.resetEditorGrid();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-resize').addEventListener('click', () => {
      this.resizeEditorGrid();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-save').addEventListener('click', () => {
      void this.saveEditorLevel(false);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-save-play').addEventListener('click', () => {
      void this.saveEditorLevel(true);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-export').addEventListener('click', () => {
      this.exportEditorText();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-back').addEventListener('click', () => {
      this.controller.openMainMenu();
    });

    this.playerNameInput.addEventListener('input', () => {
      this.controller.setPlayerName(this.playerNameInput.value);
    });

    this.introPlayerNameInput.addEventListener('input', () => {
      this.controller.setPlayerName(this.introPlayerNameInput.value);
    });

    this.editorPlayerNameInput.addEventListener('input', () => {
      this.controller.setPlayerName(this.editorPlayerNameInput.value);
    });

    this.levelSelect.addEventListener('change', () => {
      const level = Number.parseInt(this.levelSelect.value, 10);
      this.controller.setSelectedLevel(level);
      void this.loadScoresForSelectedLevel(true);
    });

    this.musicVolumeSlider.addEventListener('input', () => {
      this.controller.setMusicVolume(Number.parseFloat(this.musicVolumeSlider.value));
    });

    this.introMusicVolumeSlider.addEventListener('input', () => {
      this.controller.setMusicVolume(Number.parseFloat(this.introMusicVolumeSlider.value));
    });

    this.sfxVolumeSlider.addEventListener('input', () => {
      this.controller.setSfxVolume(Number.parseFloat(this.sfxVolumeSlider.value));
    });

    this.introSfxVolumeSlider.addEventListener('input', () => {
      this.controller.setSfxVolume(Number.parseFloat(this.introSfxVolumeSlider.value));
    });

    this.lightingToggle.addEventListener('change', () => {
      this.controller.setLightingEnabled(this.lightingToggle.checked);
    });

    this.introLightingToggle.addEventListener('change', () => {
      this.controller.setLightingEnabled(this.introLightingToggle.checked);
    });

    this.editorGridRoot.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.dataset.x || !target.dataset.y) {
        return;
      }

      this.paintGridCell(target);
    });

    window.addEventListener('keydown', (event) => {
      const snapshot = this.controller.getSnapshot();
      if (snapshot.screen === 'intro') {
        if (event.key === 'Escape' && !this.introSettingsPanel.hidden) {
          event.preventDefault();
          this.closeIntroSettings();
          return;
        }

        if (!isTextInputFocused(document.activeElement as Element | null) && isIntroStartKey(event)) {
          event.preventDefault();
          this.startFromIntro();
        }
        return;
      }

      if (event.key !== 'Escape') {
        return;
      }

      if (snapshot.screen === 'playing') {
        event.preventDefault();
        this.controller.openPauseMenu();
        return;
      }

      if (snapshot.screen === 'paused') {
        event.preventDefault();
        return;
      }

      if (snapshot.screen === 'settings') {
        event.preventDefault();
        this.controller.closeSettings();
        return;
      }

      if (snapshot.screen === 'level-select') {
        event.preventDefault();
        this.controller.closeLevelSelect();
        return;
      }

      if (snapshot.screen === 'editor') {
        event.preventDefault();
        this.controller.openMainMenu();
      }
    });
  }

  private startFromIntro(): void {
    const nextName = this.introPlayerNameInput.value.trim();
    this.controller.setPlayerName(nextName);
    if (!nextName) {
      this.introPlayerNameInput.focus();
      return;
    }

    this.closeIntroSettings();
    this.controller.startSelectedLevel();
  }

  private closeIntroSettings(): void {
    this.introSettingsPanel.hidden = true;
  }

  private render(snapshot: ControllerSnapshot): void {
    const screenChanged = this.lastRenderedScreen !== snapshot.screen;
    this.lastSnapshot = snapshot;
    this.syncLevelOptions(snapshot);
    this.syncEditorSourceOptions(snapshot);

    if (this.playerNameInput.value !== snapshot.playerName) {
      this.playerNameInput.value = snapshot.playerName;
    }
    if (this.introPlayerNameInput.value !== snapshot.playerName) {
      this.introPlayerNameInput.value = snapshot.playerName;
    }
    if (this.editorPlayerNameInput.value !== snapshot.playerName) {
      this.editorPlayerNameInput.value = snapshot.playerName;
    }

    this.musicVolumeSlider.value = snapshot.settings.musicVolume.toString();
    this.introMusicVolumeSlider.value = snapshot.settings.musicVolume.toString();
    this.sfxVolumeSlider.value = snapshot.settings.sfxVolume.toString();
    this.introSfxVolumeSlider.value = snapshot.settings.sfxVolume.toString();
    this.lightingToggle.checked = snapshot.settings.lightingEnabled;
    this.introLightingToggle.checked = snapshot.settings.lightingEnabled;
    this.statusText.textContent = snapshot.statusMessage ?? '';
    const currentLevel = snapshot.levels[snapshot.selectedLevelIndex];
    if (currentLevel) {
      const label = getLevelLabel(currentLevel.id, snapshot.selectedLevelIndex);
      this.introCurrentLevelText.textContent = label;
      this.mainCurrentLevelText.textContent = label;
      this.levelSelectCurrentText.textContent = `${label} (${currentLevel.id})`;
    }

    const canPlay = snapshot.playerName.trim().length > 0;
    this.playButton.disabled = !canPlay;
    this.levelStartButton.disabled = !canPlay;
    this.introStartButton.disabled = !canPlay;
    this.editorSaveButton.disabled = !canPlay;
    this.editorSavePlayButton.disabled = !canPlay;

    this.panels.intro.hidden = snapshot.screen !== 'intro';
    this.panels.main.hidden = snapshot.screen !== 'main';
    this.panels.levelSelect.hidden = snapshot.screen !== 'level-select';
    this.panels.settings.hidden = snapshot.screen !== 'settings';
    this.panels.editor.hidden = snapshot.screen !== 'editor';
    this.panels.pause.hidden = snapshot.screen !== 'paused';
    this.hudScoreboard.hidden = !(snapshot.screen === 'playing' || snapshot.screen === 'paused');

    if (snapshot.screen === 'intro') {
      this.introCinematic.start();
    } else {
      this.introCinematic.stop();
      this.closeIntroSettings();
    }

    if (screenChanged && snapshot.screen === 'main') {
      this.playButton.focus();
    }

    if (screenChanged && snapshot.screen === 'intro') {
      if (!canPlay) {
        this.introPlayerNameInput.focus();
      } else {
        this.introStartButton.focus();
      }
    }

    if (screenChanged && snapshot.screen === 'paused') {
      asElement<HTMLButtonElement>(this.root, '#btn-resume').focus();
    }

    if (screenChanged && snapshot.screen === 'settings') {
      this.musicVolumeSlider.focus();
    }

    if (screenChanged && snapshot.screen === 'level-select') {
      const selectedCard = this.levelSelectCardButtons.get(snapshot.selectedLevelIndex);
      if (selectedCard) {
        selectedCard.focus();
      } else {
        this.levelStartButton.focus();
      }
    }

    if (screenChanged && snapshot.screen === 'editor') {
      if (!canPlay) {
        this.editorPlayerNameInput.focus();
      } else {
        this.editorIdInput.focus();
      }
    }

    if (snapshot.screen === 'level-select') {
      void this.loadScoresForSelectedLevel(false);
    }

    if (snapshot.screen === 'playing' || snapshot.screen === 'paused') {
      const currentLevelId = snapshot.gameState.levelId;
      if (this.lastRenderedHudLevelId !== currentLevelId) {
        this.lastRenderedHudLevelId = currentLevelId;
        void this.loadScoresForLevel(currentLevelId, false);
      }
    } else {
      this.lastRenderedHudLevelId = null;
    }

    this.root.classList.toggle('overlay-hidden', snapshot.screen === 'playing');
    this.root.classList.toggle('editor-screen-active', snapshot.screen === 'editor');
    this.root.classList.toggle('level-select-screen-active', snapshot.screen === 'level-select');
    const gameShell = document.querySelector<HTMLElement>('#game-shell');
    if (gameShell) {
      gameShell.classList.toggle('editor-screen-active', snapshot.screen === 'editor');
      gameShell.classList.toggle('level-select-screen-active', snapshot.screen === 'level-select');
    }
    this.lastRenderedScreen = snapshot.screen;
  }

  private syncLevelOptions(snapshot: ControllerSnapshot): void {
    const signature = snapshot.levels.map((level) => level.id).join('|');
    if (this.levelSelect.dataset.signature !== signature) {
      this.levelSelect.innerHTML = '';
      this.levelSelectGrid.innerHTML = '';
      this.levelSelectCardButtons.clear();
      snapshot.levels.forEach((level, index) => {
        const menuOption = document.createElement('option');
        menuOption.value = String(index);
        menuOption.textContent = `${getLevelLabel(level.id, index)} (${level.id})`;
        this.levelSelect.append(menuOption);

        const levelCard = this.createLevelSelectCard(level, index);
        this.levelSelectGrid.append(levelCard);
        this.levelSelectCardButtons.set(index, levelCard);
      });
      this.levelSelect.dataset.signature = signature;
    }

    const nextValue = String(snapshot.selectedLevelIndex);
    if (this.levelSelect.value !== nextValue) {
      this.levelSelect.value = nextValue;
    }

    for (const [index, button] of this.levelSelectCardButtons) {
      const isSelected = index === snapshot.selectedLevelIndex;
      button.classList.toggle('level-card-selected', isSelected);
      button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    }
  }

  private createLevelSelectCard(level: ParsedLevel, index: number): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.dataset.levelIndex = String(index);
    card.setAttribute('role', 'option');
    card.addEventListener('click', () => {
      this.controller.setSelectedLevel(index);
      void this.loadScoresForSelectedLevel(true);
    });
    card.addEventListener('dblclick', () => {
      this.controller.startLevel(index);
    });

    const cardHeader = document.createElement('div');
    cardHeader.className = 'level-card-header';

    const cardTitle = document.createElement('strong');
    cardTitle.textContent = getLevelLabel(level.id, index);
    cardHeader.append(cardTitle);

    const cardId = document.createElement('span');
    cardId.textContent = level.id;
    cardHeader.append(cardId);
    card.append(cardHeader);

    const preview = document.createElement('div');
    preview.className = 'level-card-preview';
    preview.style.gridTemplateColumns = `repeat(${level.width}, 1fr)`;
    for (let y = 0; y < level.height; y += 1) {
      const row = level.grid[y];
      for (let x = 0; x < level.width; x += 1) {
        const tile = row?.[x] ?? '#';
        const cell = document.createElement('span');
        cell.className = `level-card-cell ${levelPreviewTileClass(tile)}`;
        preview.append(cell);
      }
    }
    card.append(preview);

    return card;
  }

  private syncEditorSourceOptions(snapshot: ControllerSnapshot): void {
    const signature = snapshot.levels.map((level) => level.id).join('|');
    if (this.editorSourceSelect.dataset.signature !== signature) {
      this.editorSourceSelect.innerHTML = '';
      snapshot.levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `Level ${index + 1} (${level.id})`;
        this.editorSourceSelect.append(option);
      });
      this.editorSourceSelect.dataset.signature = signature;
    }

    const nextValue = String(snapshot.selectedLevelIndex);
    if (this.editorSourceSelect.value !== nextValue) {
      this.editorSourceSelect.value = nextValue;
    }
  }

  private async loadScoresForSelectedLevel(forceRefresh: boolean): Promise<void> {
    const snapshot = this.lastSnapshot;
    if (!snapshot) {
      return;
    }

    const level = snapshot.levels[snapshot.selectedLevelIndex];
    if (!level) {
      this.renderScores('none', []);
      return;
    }

    await this.loadScoresForLevel(level.id, forceRefresh);
  }

  private async loadScoresForLevel(levelId: string, forceRefresh: boolean): Promise<void> {
    if (!forceRefresh && this.scoreCache.has(levelId)) {
      this.renderScores(levelId, this.scoreCache.get(levelId) ?? []);
      return;
    }

    if (!forceRefresh && this.inFlightScoreLevelId === levelId) {
      return;
    }

    const nonce = ++this.scoreRequestNonce;
    this.inFlightScoreLevelId = levelId;
    this.scoreStatus.textContent = `Loading scores for ${levelId}...`;
    this.hudScoreStatus.textContent = `Loading scores for ${levelId}...`;

    try {
      const scores = await fetchTopScores(levelId);
      if (nonce !== this.scoreRequestNonce) {
        return;
      }

      this.inFlightScoreLevelId = null;
      this.scoreCache.set(levelId, scores);
      this.renderScores(levelId, scores);
    } catch (error) {
      if (nonce !== this.scoreRequestNonce) {
        return;
      }

      this.inFlightScoreLevelId = null;
      this.scoreStatus.textContent = `Scores unavailable: ${String(error)}`;
      this.hudScoreStatus.textContent = `Scores unavailable: ${String(error)}`;
      this.scoreList.innerHTML = '';
      this.hudScoreList.innerHTML = '';
    }
  }

  private renderScores(levelId: string, scores: LevelScoreRecord[]): void {
    this.scoreList.innerHTML = '';
    this.hudScoreList.innerHTML = '';

    const applyScore = (list: HTMLOListElement, score: LevelScoreRecord, index: number): void => {
      const item = document.createElement('li');
      item.textContent = `${index + 1}. ${score.playerName} - ${score.moves} moves - ${(score.durationMs / 1000).toFixed(1)}s`;
      list.append(item);
    };

    if (levelId === 'none') {
      this.scoreStatus.textContent = 'No level selected.';
      this.hudScoreStatus.textContent = 'No level selected.';
      return;
    }

    const header = `${levelId}: top ${Math.min(scores.length, 10)} (lower moves, then lower time)`;

    if (scores.length === 0) {
      this.scoreStatus.textContent = `${levelId}: no scores yet.`;
      this.hudScoreStatus.textContent = `${levelId}: no scores yet.`;
      return;
    }

    this.scoreStatus.textContent = header;
    this.hudScoreStatus.textContent = header;
    for (let i = 0; i < scores.length; i += 1) {
      const score = scores[i];
      applyScore(this.scoreList, score, i);
      applyScore(this.hudScoreList, score, i);
    }
  }

  private buildPalette(): void {
    this.editorPaletteRoot.innerHTML = '';
    this.editorPaletteButtons = new Map<string, HTMLButtonElement>();

    for (const tile of EDITOR_TILE_PALETTE) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tile = tile;
      button.className = `editor-palette-tile ${tileClass(tile)}`;
      button.textContent = tile === ' ' ? 'space' : tile;
      button.title = describeTile(tile);
      button.addEventListener('click', () => {
        this.editorTile = tile;
        this.syncSelectedTile();
      });
      this.editorPaletteRoot.append(button);
      this.editorPaletteButtons.set(tile, button);
    }

    this.syncSelectedTile();
  }

  private syncSelectedTile(): void {
    this.editorSelectedTile.textContent = describeTile(this.editorTile);
    for (const [tile, button] of this.editorPaletteButtons) {
      button.classList.toggle('editor-palette-selected', tile === this.editorTile);
    }
  }

  private createBlankGrid(width: number, height: number): string[][] {
    const safeWidth = sanitizeDimension(width, 25);
    const safeHeight = sanitizeDimension(height, 16);
    const grid = createGrid(safeWidth, safeHeight, '#');

    for (let y = 1; y < safeHeight - 1; y += 1) {
      for (let x = 1; x < safeWidth - 1; x += 1) {
        grid[y][x] = ' ';
      }
    }

    if (safeWidth >= 3 && safeHeight >= 3) {
      grid[1][1] = 'P';
      grid[safeHeight - 2][safeWidth - 2] = '!';
    }

    return grid;
  }

  private defaultEditorId(): string {
    const existingIds = this.lastSnapshot?.levels.map((level) => level.id) ?? [];
    return nextCustomLevelId(existingIds);
  }

  private renderEditorGrid(): void {
    const width = this.editorGrid[0]?.length ?? 0;
    this.editorGridRoot.innerHTML = '';
    this.editorGridRoot.style.gridTemplateColumns = `repeat(${width}, 1fr)`;

    for (let y = 0; y < this.editorGrid.length; y += 1) {
      for (let x = 0; x < this.editorGrid[y].length; x += 1) {
        const tile = this.editorGrid[y][x];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `editor-grid-cell ${tileClass(tile)}`;
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.textContent = tile === ' ' ? '' : tile;
        cell.title = `${describeTile(tile)} @ (${x + 1}, ${y + 1})`;
        this.editorGridRoot.append(cell);
      }
    }

    this.editorWidthInput.value = String(width);
    this.editorHeightInput.value = String(this.editorGrid.length);
  }

  private showEditorFeedback(message: string, isError = false): void {
    this.editorFeedback.textContent = message;
    this.editorFeedback.classList.toggle('editor-feedback-error', isError);
  }

  private paintGridCell(target: HTMLElement): void {
    const x = Number.parseInt(target.dataset.x ?? '-1', 10);
    const y = Number.parseInt(target.dataset.y ?? '-1', 10);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      return;
    }

    if (!this.editorGrid[y] || this.editorGrid[y][x] === undefined) {
      return;
    }

    this.editorGrid[y][x] = this.editorTile;
    this.renderEditorGrid();
  }

  private loadLevelIntoEditor(level: ParsedLevel): void {
    this.editorGrid = cloneGrid(level.grid);
    this.editorIdInput.value = this.defaultEditorId();
    this.renderEditorGrid();
    this.showEditorFeedback(`Loaded ${level.id}`);
  }

  private loadSelectedEditorLevel(): void {
    const snapshot = this.lastSnapshot;
    if (!snapshot) {
      return;
    }

    const index = Number.parseInt(this.editorSourceSelect.value, 10);
    const level = snapshot.levels[index];
    if (!level) {
      this.showEditorFeedback('Choose a level to load first.', true);
      return;
    }

    this.loadLevelIntoEditor(level);
  }

  private resetEditorGrid(): void {
    const width = sanitizeDimension(Number.parseInt(this.editorWidthInput.value, 10), this.editorGrid[0]?.length ?? 25);
    const height = sanitizeDimension(Number.parseInt(this.editorHeightInput.value, 10), this.editorGrid.length || 16);

    this.editorGrid = this.createBlankGrid(width, height);
    this.editorIdInput.value = this.defaultEditorId();
    this.renderEditorGrid();
    this.showEditorFeedback('Created blank level template.');
  }

  private resizeEditorGrid(): void {
    const width = sanitizeDimension(Number.parseInt(this.editorWidthInput.value, 10), this.editorGrid[0]?.length ?? 25);
    const height = sanitizeDimension(Number.parseInt(this.editorHeightInput.value, 10), this.editorGrid.length || 16);

    this.editorGrid = resizeGrid(this.editorGrid, width, height, '#');
    this.renderEditorGrid();
    this.showEditorFeedback(`Resized to ${width}x${height}.`);
  }

  private resolveSaveId(baseId: string, snapshot: ControllerSnapshot): string {
    const allIds = new Set(snapshot.levels.map((level) => level.id));
    let candidate = baseId || this.defaultEditorId();

    if (!allIds.has(candidate)) {
      return candidate;
    }

    const stem = candidate;
    let suffix = 2;
    while (allIds.has(candidate)) {
      candidate = `${stem}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async saveEditorLevel(playAfterSave: boolean): Promise<void> {
    const snapshot = this.lastSnapshot;
    if (!snapshot) {
      return;
    }

    const authorName = this.controller.getPlayerName();
    if (!authorName) {
      this.showEditorFeedback('Enter a player name before saving or playing levels.', true);
      this.editorPlayerNameInput.focus();
      return;
    }

    const validation = validateGridForEditor(this.editorGrid);
    if (validation.errors.length > 0) {
      this.showEditorFeedback(validation.errors.join(' '), true);
      return;
    }

    const requestedId = levelIdFromInput(this.editorIdInput.value);
    const levelId = this.resolveSaveId(requestedId, snapshot);

    try {
      ensureParseableLevel(levelId, this.editorGrid);
    } catch (error) {
      this.showEditorFeedback(String(error), true);
      return;
    }

    const text = serializeGrid(this.editorGrid);

    try {
      const saved = await saveCustomLevel({
        id: levelId,
        name: levelId,
        text,
        authorName,
      });

      const parsed = parseLevelText(saved.id, saved.text);
      const levelIndex = this.controller.upsertLevel(parsed);
      this.editorIdInput.value = saved.id;
      this.scoreCache.delete(saved.id);

      if (playAfterSave) {
        this.controller.startLevel(levelIndex);
        return;
      }

      if (validation.warnings.length > 0) {
        this.showEditorFeedback(`Saved ${saved.id}. Warning: ${validation.warnings.join(' ')}`);
        return;
      }

      this.showEditorFeedback(`Saved ${saved.id} to backend.`);
    } catch (error) {
      this.showEditorFeedback(`Save failed: ${String(error)}`, true);
    }
  }

  private exportEditorText(): void {
    const levelId = levelIdFromInput(this.editorIdInput.value) || 'custom-level';
    const blob = new Blob([serializeGrid(this.editorGrid)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${levelId}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    this.showEditorFeedback(`Downloaded ${levelId}.txt`);
  }
}
