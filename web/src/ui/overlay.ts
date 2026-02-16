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
  shouldPaintOnHover,
  validateGridForEditor,
} from '../editor/levelEditorUtils';
import { fetchTopScores, saveCustomLevel, type LevelScoreRecord } from '../runtime/backendApi';
import { isTextInputFocused } from '../runtime/inputFocus';
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

  private readonly statusText: HTMLElement;

  private readonly playerNameInput: HTMLInputElement;

  private readonly playButton: HTMLButtonElement;

  private readonly levelStartButton: HTMLButtonElement;

  private readonly volumeSlider: HTMLInputElement;

  private readonly lightingToggle: HTMLInputElement;

  private readonly panels: Record<string, HTMLElement>;

  private readonly introPanel: HTMLElement;

  private readonly introStartButton: HTMLButtonElement;

  private readonly introLevelSelect: HTMLSelectElement;

  private readonly introPlayerNameInput: HTMLInputElement;

  private readonly introSettingsPanel: HTMLElement;

  private readonly introSettingsButton: HTMLButtonElement;

  private readonly introSettingsCloseButton: HTMLButtonElement;

  private readonly introVolumeSlider: HTMLInputElement;

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

  private readonly editorGridRoot: HTMLElement;

  private readonly editorFeedback: HTMLElement;

  private readonly editorSelectedTile: HTMLElement;

  private readonly editorPaletteRoot: HTMLElement;

  private editorPaletteButtons = new Map<string, HTMLButtonElement>();

  private editorGrid: string[][] = this.createBlankGrid(25, 16);

  private editorTile = '#';

  private editorPainting = false;

  private lastSnapshot: ControllerSnapshot | null = null;

  private readonly scoreCache = new Map<string, LevelScoreRecord[]>();

  private scoreRequestNonce = 0;

  private inFlightScoreLevelId: string | null = null;

  private lastRenderedScreen: ControllerSnapshot['screen'] | null = null;

  private lastRenderedHudLevelId: string | null = null;

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
    this.introLevelSelect = asElement<HTMLSelectElement>(this.root, '#intro-level-select-input');
    this.introPlayerNameInput = asElement<HTMLInputElement>(this.root, '#intro-player-name-input');
    this.introSettingsPanel = asElement<HTMLElement>(this.root, '#intro-settings-panel');
    this.introSettingsButton = asElement<HTMLButtonElement>(this.root, '#btn-intro-settings-toggle');
    this.introSettingsCloseButton = asElement<HTMLButtonElement>(this.root, '#btn-intro-settings-close');
    this.introVolumeSlider = asElement<HTMLInputElement>(this.root, '#intro-settings-volume');
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
    this.statusText = asElement<HTMLElement>(this.root, '#menu-status');
    this.playerNameInput = asElement<HTMLInputElement>(this.root, '#player-name-input');
    this.playButton = asElement<HTMLButtonElement>(this.root, '#btn-play');
    this.levelStartButton = asElement<HTMLButtonElement>(this.root, '#btn-level-start');
    this.volumeSlider = asElement<HTMLInputElement>(this.root, '#settings-volume');
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
    this.editorGridRoot = asElement<HTMLElement>(this.root, '#editor-grid');
    this.editorFeedback = asElement<HTMLElement>(this.root, '#editor-feedback');
    this.editorSelectedTile = asElement<HTMLElement>(this.root, '#editor-selected-tile');
    this.editorPaletteRoot = asElement<HTMLElement>(this.root, '#editor-palette');

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
          <button type="button" id="btn-intro-settings-toggle">Settings</button>
          <div class="intro-settings-panel" id="intro-settings-panel" hidden>
            <h3>Settings</h3>
            <label for="intro-settings-volume">Volume</label>
            <input id="intro-settings-volume" type="range" min="0" max="1" step="0.05" />
            <label class="checkbox-row">
              <input id="intro-settings-lighting" type="checkbox" />
              Lighting effects
            </label>
            <button type="button" id="btn-intro-settings-close">Close</button>
          </div>
        </div>
        <div class="intro-content">
          <h1 id="intro-title">LOCKSTEP</h1>
          <p id="intro-line"></p>
          <p id="intro-skip-hint" class="intro-skip-hint">Press Start anytime to skip</p>
        </div>
        <aside class="intro-menu-dock">
          <h2>Enter Lockstep</h2>
          <label for="intro-player-name-input">Player Name</label>
          <input id="intro-player-name-input" type="text" maxlength="32" placeholder="Enter your name" />
          <label for="intro-level-select-input">Level</label>
          <select id="intro-level-select-input"></select>
          <div class="button-row intro-button-row">
            <button type="button" id="btn-intro-start">Start</button>
            <button type="button" id="btn-intro-open-levels">Scores</button>
            <button type="button" id="btn-intro-open-editor">Editor</button>
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
        <label for="player-name-input">Player Name (required)</label>
        <input id="player-name-input" type="text" maxlength="32" placeholder="Enter your name" />

        <div class="button-row">
          <button type="button" id="btn-play">Play</button>
          <button type="button" id="btn-level-select">Level Select</button>
          <button type="button" id="btn-open-editor">Level Editor</button>
          <button type="button" id="btn-main-settings">Settings</button>
        </div>
      </section>

      <section class="menu-panel" data-panel="level-select" hidden>
        <h2>Level Select</h2>
        <label for="level-select-input">Choose a level</label>
        <select id="level-select-input"></select>

        <div class="scoreboard">
          <div id="score-status" class="score-status">Top 10 scores (lower is better)</div>
          <ol id="score-list" class="score-list"></ol>
        </div>

        <div class="button-row">
          <button type="button" id="btn-level-start">Start</button>
          <button type="button" id="btn-level-back">Back</button>
        </div>
      </section>

      <section class="menu-panel" data-panel="settings" hidden>
        <h2>Settings</h2>
        <label for="settings-volume">Volume</label>
        <input id="settings-volume" type="range" min="0" max="1" step="0.05" />

        <label class="checkbox-row">
          <input id="settings-lighting" type="checkbox" />
          Lighting effects
        </label>

        <div class="button-row">
          <button type="button" id="btn-settings-back">Back</button>
        </div>
      </section>

      <section class="menu-panel menu-panel-editor" data-panel="editor" hidden>
        <h2>Level Editor</h2>
        <p>Load a level, paint tiles, then save and play.</p>

        <div class="editor-controls">
          <label for="editor-source-level">Source Level</label>
          <select id="editor-source-level"></select>
          <button type="button" id="btn-editor-load">Load</button>
          <button type="button" id="btn-editor-new">New Blank</button>
        </div>

        <div class="editor-controls">
          <label for="editor-level-id">Save ID</label>
          <input id="editor-level-id" type="text" placeholder="custom-level-1" />
          <label for="editor-width">Width</label>
          <input id="editor-width" type="number" min="4" max="80" value="25" />
          <label for="editor-height">Height</label>
          <input id="editor-height" type="number" min="4" max="80" value="16" />
          <button type="button" id="btn-editor-resize">Resize</button>
        </div>

        <div class="editor-palette" id="editor-palette"></div>
        <div class="editor-selected">Selected: <strong id="editor-selected-tile">Wall (#)</strong></div>

        <div class="editor-grid" id="editor-grid" role="grid" aria-label="Level tile grid"></div>

        <div class="button-row">
          <button type="button" id="btn-editor-save">Save Level</button>
          <button type="button" id="btn-editor-save-play">Save + Play</button>
          <button type="button" id="btn-editor-export">Download .txt</button>
          <button type="button" id="btn-editor-back">Back</button>
        </div>

        <div class="editor-feedback" id="editor-feedback" aria-live="polite"></div>
      </section>

      <section class="menu-panel" data-panel="pause" hidden>
        <h2>Paused</h2>
        <p>Use Resume to continue.</p>
        <div class="button-row">
          <button type="button" id="btn-resume">Resume</button>
          <button type="button" id="btn-restart">Restart</button>
          <button type="button" id="btn-pause-settings">Settings</button>
          <button type="button" id="btn-quit">Quit</button>
        </div>
      </section>
    `;
  }

  private bindEvents(): void {
    this.introStartButton.addEventListener('click', () => {
      this.startFromIntro();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-intro-open-levels').addEventListener('click', () => {
      this.closeIntroSettings();
      this.introCinematic.skip();
      this.controller.openLevelSelect();
      void this.loadScoresForSelectedLevel(true);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-intro-open-editor').addEventListener('click', () => {
      this.closeIntroSettings();
      const snapshot = this.controller.getSnapshot();
      const source = snapshot.levels[snapshot.selectedLevelIndex] ?? snapshot.levels[0];
      if (source) {
        this.loadLevelIntoEditor(source);
      }
      this.introCinematic.skip();
      this.controller.openEditor();
    });

    this.introSettingsButton.addEventListener('click', () => {
      this.introSettingsPanel.hidden = !this.introSettingsPanel.hidden;
      if (!this.introSettingsPanel.hidden) {
        this.introVolumeSlider.focus();
      }
    });

    this.introSettingsCloseButton.addEventListener('click', () => {
      this.closeIntroSettings();
      this.introSettingsButton.focus();
    });

    this.playButton.addEventListener('click', () => {
      this.controller.startSelectedLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-level-select').addEventListener('click', () => {
      this.controller.openLevelSelect();
      void this.loadScoresForSelectedLevel(true);
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
      this.controller.openMainMenu();
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

    asElement<HTMLButtonElement>(this.root, '#btn-quit').addEventListener('click', () => {
      this.controller.openMainMenu();
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

    this.levelSelect.addEventListener('change', () => {
      const level = Number.parseInt(this.levelSelect.value, 10);
      this.controller.setSelectedLevel(level);
      void this.loadScoresForSelectedLevel(true);
    });

    this.introLevelSelect.addEventListener('change', () => {
      const level = Number.parseInt(this.introLevelSelect.value, 10);
      this.controller.setSelectedLevel(level);
    });

    this.volumeSlider.addEventListener('input', () => {
      this.controller.setVolume(Number.parseFloat(this.volumeSlider.value));
    });

    this.introVolumeSlider.addEventListener('input', () => {
      this.controller.setVolume(Number.parseFloat(this.introVolumeSlider.value));
    });

    this.lightingToggle.addEventListener('change', () => {
      this.controller.setLightingEnabled(this.lightingToggle.checked);
    });

    this.introLightingToggle.addEventListener('change', () => {
      this.controller.setLightingEnabled(this.introLightingToggle.checked);
    });

    this.editorGridRoot.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement;
      if (!target.dataset.x || !target.dataset.y) {
        return;
      }

      this.editorPainting = true;
      this.paintGridCell(target);
    });

    this.editorGridRoot.addEventListener('mouseover', (event) => {
      const mouseEvent = event as MouseEvent;
      if (!shouldPaintOnHover(this.editorPainting, mouseEvent.buttons)) {
        if (this.editorPainting && mouseEvent.buttons === 0) {
          this.editorPainting = false;
        }
        return;
      }

      const target = event.target as HTMLElement;
      if (!target.dataset.x || !target.dataset.y) {
        return;
      }

      this.paintGridCell(target);
    });

    window.addEventListener('mouseup', () => {
      this.editorPainting = false;
    });

    window.addEventListener('blur', () => {
      this.editorPainting = false;
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

      if (snapshot.screen === 'level-select' || snapshot.screen === 'editor') {
        event.preventDefault();
        this.controller.openMainMenu();
      }
    });
  }

  private startFromIntro(): void {
    const level = Number.parseInt(this.introLevelSelect.value, 10);
    if (Number.isInteger(level)) {
      this.controller.setSelectedLevel(level);
    }

    this.controller.setPlayerName(this.introPlayerNameInput.value);
    this.closeIntroSettings();
    this.introCinematic.skip();
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

    this.volumeSlider.value = snapshot.settings.volume.toString();
    this.introVolumeSlider.value = snapshot.settings.volume.toString();
    this.lightingToggle.checked = snapshot.settings.lightingEnabled;
    this.introLightingToggle.checked = snapshot.settings.lightingEnabled;
    this.statusText.textContent = snapshot.statusMessage ?? '';

    const canPlay = snapshot.playerName.trim().length > 0;
    this.playButton.disabled = !canPlay;
    this.levelStartButton.disabled = !canPlay;
    this.introStartButton.disabled = !canPlay;

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
      this.volumeSlider.focus();
    }

    if (screenChanged && snapshot.screen === 'editor') {
      this.editorIdInput.focus();
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
    this.lastRenderedScreen = snapshot.screen;
  }

  private syncLevelOptions(snapshot: ControllerSnapshot): void {
    const signature = snapshot.levels.map((level) => level.id).join('|');
    if (this.levelSelect.dataset.signature !== signature || this.introLevelSelect.dataset.signature !== signature) {
      this.levelSelect.innerHTML = '';
      this.introLevelSelect.innerHTML = '';
      snapshot.levels.forEach((level, index) => {
        const menuOption = document.createElement('option');
        menuOption.value = String(index);
        menuOption.textContent = `Level ${index + 1} (${level.id})`;
        this.levelSelect.append(menuOption);

        const introOption = document.createElement('option');
        introOption.value = String(index);
        introOption.textContent = `Level ${index + 1} (${level.id})`;
        this.introLevelSelect.append(introOption);
      });
      this.levelSelect.dataset.signature = signature;
      this.introLevelSelect.dataset.signature = signature;
    }

    const nextValue = String(snapshot.selectedLevelIndex);
    if (this.levelSelect.value !== nextValue) {
      this.levelSelect.value = nextValue;
    }
    if (this.introLevelSelect.value !== nextValue) {
      this.introLevelSelect.value = nextValue;
    }
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
