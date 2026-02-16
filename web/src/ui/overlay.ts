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
  parseTextToGrid,
  resizeGrid,
  sanitizeDimension,
  serializeGrid,
  validateGridForEditor,
} from '../editor/levelEditorUtils';
import { loadStoredCustomLevels, upsertStoredCustomLevel } from '../runtime/customLevelStorage';

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

export class OverlayUI {
  private readonly root: HTMLElement;

  private readonly controller: GameController;

  private readonly levelSelect: HTMLSelectElement;

  private readonly statusText: HTMLElement;

  private readonly volumeSlider: HTMLInputElement;

  private readonly lightingToggle: HTMLInputElement;

  private readonly panels: Record<string, HTMLElement>;

  private readonly editorLoadSelect: HTMLSelectElement;

  private readonly editorIdInput: HTMLInputElement;

  private readonly editorNameInput: HTMLInputElement;

  private readonly editorWidthInput: HTMLInputElement;

  private readonly editorHeightInput: HTMLInputElement;

  private readonly editorGridRoot: HTMLElement;

  private readonly editorTextArea: HTMLTextAreaElement;

  private readonly editorFeedback: HTMLElement;

  private readonly editorSelectedTile: HTMLElement;

  private readonly editorPaletteRoot: HTMLElement;

  private editorPaletteButtons = new Map<string, HTMLButtonElement>();

  private editorGrid: string[][] = createGrid(25, 16, '#');

  private editorTile = '#';

  private editorPainting = false;

  private lastSnapshot: ControllerSnapshot | null = null;

  public constructor(root: HTMLElement, controller: GameController) {
    this.root = root;
    this.controller = controller;

    this.root.innerHTML = this.buildMarkup();

    this.panels = {
      main: asElement<HTMLElement>(this.root, '[data-panel="main"]'),
      levelSelect: asElement<HTMLElement>(this.root, '[data-panel="level-select"]'),
      settings: asElement<HTMLElement>(this.root, '[data-panel="settings"]'),
      editor: asElement<HTMLElement>(this.root, '[data-panel="editor"]'),
      pause: asElement<HTMLElement>(this.root, '[data-panel="pause"]'),
    };

    this.levelSelect = asElement<HTMLSelectElement>(this.root, '#level-select-input');
    this.statusText = asElement<HTMLElement>(this.root, '#menu-status');
    this.volumeSlider = asElement<HTMLInputElement>(this.root, '#settings-volume');
    this.lightingToggle = asElement<HTMLInputElement>(this.root, '#settings-lighting');

    this.editorLoadSelect = asElement<HTMLSelectElement>(this.root, '#editor-load-level');
    this.editorIdInput = asElement<HTMLInputElement>(this.root, '#editor-level-id');
    this.editorNameInput = asElement<HTMLInputElement>(this.root, '#editor-level-name');
    this.editorWidthInput = asElement<HTMLInputElement>(this.root, '#editor-width');
    this.editorHeightInput = asElement<HTMLInputElement>(this.root, '#editor-height');
    this.editorGridRoot = asElement<HTMLElement>(this.root, '#editor-grid');
    this.editorTextArea = asElement<HTMLTextAreaElement>(this.root, '#editor-text');
    this.editorFeedback = asElement<HTMLElement>(this.root, '#editor-feedback');
    this.editorSelectedTile = asElement<HTMLElement>(this.root, '#editor-selected-tile');
    this.editorPaletteRoot = asElement<HTMLElement>(this.root, '#editor-palette');

    this.buildPalette();
    this.bindEvents();
    this.controller.subscribe((snapshot) => this.render(snapshot));
  }

  private buildMarkup(): string {
    return `
      <div class="menu-status" id="menu-status" aria-live="polite"></div>

      <section class="menu-panel" data-panel="main">
        <h1>2P1P Puzzle Game</h1>
        <p>Move all white squares to green goals. Avoid lava and enemies.</p>
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
        <p>Edit tiles directly, validate, save locally, and export to text.</p>

        <div class="editor-controls">
          <label for="editor-load-level">Load Existing</label>
          <select id="editor-load-level"></select>
          <button type="button" id="btn-editor-load">Load</button>
          <button type="button" id="btn-editor-new">New</button>
        </div>

        <div class="editor-controls">
          <label for="editor-level-id">Level ID</label>
          <input id="editor-level-id" type="text" placeholder="custom-level-1" />
          <label for="editor-level-name">Display Name</label>
          <input id="editor-level-name" type="text" placeholder="Custom Level" />
        </div>

        <div class="editor-controls">
          <label for="editor-width">Width</label>
          <input id="editor-width" type="number" min="4" max="80" value="25" />
          <label for="editor-height">Height</label>
          <input id="editor-height" type="number" min="4" max="80" value="16" />
          <button type="button" id="btn-editor-resize">Resize</button>
        </div>

        <div class="editor-palette" id="editor-palette"></div>
        <div class="editor-selected">Selected: <strong id="editor-selected-tile">Wall (#)</strong></div>

        <div class="editor-grid" id="editor-grid" role="grid" aria-label="Level tile grid"></div>

        <label for="editor-text">Level Text</label>
        <textarea id="editor-text" rows="6" spellcheck="false"></textarea>

        <div class="button-row">
          <button type="button" id="btn-editor-apply-text">Apply Text</button>
          <button type="button" id="btn-editor-validate">Validate</button>
          <button type="button" id="btn-editor-save">Save Local</button>
          <button type="button" id="btn-editor-export">Download .txt</button>
          <button type="button" id="btn-editor-save-play">Save + Play</button>
          <button type="button" id="btn-editor-back">Back</button>
        </div>

        <div class="editor-feedback" id="editor-feedback" aria-live="polite"></div>
      </section>

      <section class="menu-panel" data-panel="pause" hidden>
        <h2>Paused</h2>
        <p>Press ESC to resume.</p>
        <div class="button-row">
          <button type="button" id="btn-resume">Resume</button>
          <button type="button" id="btn-restart">Restart</button>
          <button type="button" id="btn-pause-settings">Settings</button>
          <button type="button" id="btn-quit">Quit</button>
        </div>
      </section>
    `;
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

  private bindEvents(): void {
    asElement<HTMLButtonElement>(this.root, '#btn-play').addEventListener('click', () => {
      this.controller.startSelectedLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-level-select').addEventListener('click', () => {
      this.controller.openLevelSelect();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-open-editor').addEventListener('click', () => {
      const snapshot = this.controller.getSnapshot();
      const level = snapshot.levels[snapshot.selectedLevelIndex] ?? snapshot.levels[0];
      this.loadLevelIntoEditor(level, false);
      this.controller.openEditor();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-main-settings').addEventListener('click', () => {
      this.controller.openSettings();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-level-start').addEventListener('click', () => {
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

    this.levelSelect.addEventListener('change', () => {
      const level = Number.parseInt(this.levelSelect.value, 10);
      this.controller.setSelectedLevel(level);
    });

    this.volumeSlider.addEventListener('input', () => {
      this.controller.setVolume(Number.parseFloat(this.volumeSlider.value));
    });

    this.lightingToggle.addEventListener('change', () => {
      this.controller.setLightingEnabled(this.lightingToggle.checked);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-new').addEventListener('click', () => {
      this.resetEditorGrid();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-load').addEventListener('click', () => {
      this.loadSelectedEditorLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-resize').addEventListener('click', () => {
      this.resizeEditorGrid();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-apply-text').addEventListener('click', () => {
      this.applyEditorText();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-validate').addEventListener('click', () => {
      this.validateEditorGrid();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-save').addEventListener('click', () => {
      this.saveEditorLevel(false);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-save-play').addEventListener('click', () => {
      this.saveEditorLevel(true);
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-export').addEventListener('click', () => {
      this.exportEditorText();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-editor-back').addEventListener('click', () => {
      this.controller.openMainMenu();
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
      if (!this.editorPainting) {
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

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      const snapshot = this.controller.getSnapshot();
      if (snapshot.screen === 'paused') {
        event.preventDefault();
        this.controller.togglePause();
      }

      if (snapshot.screen === 'settings') {
        event.preventDefault();
        this.controller.closeSettings();
      }

      if (snapshot.screen === 'level-select' || snapshot.screen === 'editor') {
        event.preventDefault();
        this.controller.openMainMenu();
      }
    });
  }

  private render(snapshot: ControllerSnapshot): void {
    this.lastSnapshot = snapshot;
    this.syncLevelOptions(snapshot);
    this.syncEditorLevelOptions(snapshot);

    this.volumeSlider.value = snapshot.settings.volume.toString();
    this.lightingToggle.checked = snapshot.settings.lightingEnabled;
    this.statusText.textContent = snapshot.statusMessage ?? '';

    this.panels.main.hidden = snapshot.screen !== 'main';
    this.panels.levelSelect.hidden = snapshot.screen !== 'level-select';
    this.panels.settings.hidden = snapshot.screen !== 'settings';
    this.panels.editor.hidden = snapshot.screen !== 'editor';
    this.panels.pause.hidden = snapshot.screen !== 'paused';

    if (snapshot.screen === 'main') {
      asElement<HTMLButtonElement>(this.root, '#btn-play').focus();
    }

    if (snapshot.screen === 'paused') {
      asElement<HTMLButtonElement>(this.root, '#btn-resume').focus();
    }

    if (snapshot.screen === 'settings') {
      this.volumeSlider.focus();
    }

    if (snapshot.screen === 'editor') {
      this.editorIdInput.focus();
    }

    this.root.classList.toggle('overlay-hidden', snapshot.screen === 'playing');
  }

  private syncLevelOptions(snapshot: ControllerSnapshot): void {
    const signature = snapshot.levels.map((level) => level.id).join('|');
    if (this.levelSelect.dataset.signature !== signature) {
      this.levelSelect.innerHTML = '';
      snapshot.levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `Level ${index + 1} (${level.id})`;
        this.levelSelect.append(option);
      });
      this.levelSelect.dataset.signature = signature;
    }

    const nextValue = String(snapshot.selectedLevelIndex);
    if (this.levelSelect.value !== nextValue) {
      this.levelSelect.value = nextValue;
    }
  }

  private syncEditorLevelOptions(snapshot: ControllerSnapshot): void {
    const customIds = new Set(loadStoredCustomLevels().map((level) => level.id));
    const signature = snapshot.levels
      .map((level) => `${level.id}:${customIds.has(level.id) ? 'custom' : 'builtin'}`)
      .join('|');

    if (this.editorLoadSelect.dataset.signature === signature) {
      return;
    }

    this.editorLoadSelect.innerHTML = '';
    snapshot.levels.forEach((level, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = customIds.has(level.id)
        ? `Custom: ${level.id}`
        : `Built-in: ${level.id}`;
      this.editorLoadSelect.append(option);
    });
    this.editorLoadSelect.dataset.signature = signature;
    this.editorLoadSelect.value = String(snapshot.selectedLevelIndex);
  }

  private syncSelectedTile(): void {
    this.editorSelectedTile.textContent = describeTile(this.editorTile);
    for (const [tile, button] of this.editorPaletteButtons) {
      button.classList.toggle('editor-palette-selected', tile === this.editorTile);
    }
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
    this.editorTextArea.value = serializeGrid(this.editorGrid);
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

  private showEditorFeedback(message: string, isError = false): void {
    this.editorFeedback.textContent = message;
    this.editorFeedback.classList.toggle('editor-feedback-error', isError);
  }

  private loadLevelIntoEditor(level: ParsedLevel, keepId: boolean): void {
    this.editorGrid = cloneGrid(level.grid);

    const existingIds = this.lastSnapshot?.levels.map((entry) => entry.id) ?? [];
    if (keepId) {
      this.editorIdInput.value = level.id;
    } else {
      this.editorIdInput.value = nextCustomLevelId(existingIds);
    }

    this.editorNameInput.value = level.id;
    this.renderEditorGrid();
    this.showEditorFeedback(`Loaded ${level.id} into editor.`);
  }

  private loadSelectedEditorLevel(): void {
    const snapshot = this.lastSnapshot;
    if (!snapshot) {
      return;
    }

    const index = Number.parseInt(this.editorLoadSelect.value, 10);
    const level = snapshot.levels[index];
    if (!level) {
      this.showEditorFeedback('No level selected to load.', true);
      return;
    }

    const isCustom = loadStoredCustomLevels().some((entry) => entry.id === level.id);
    this.loadLevelIntoEditor(level, isCustom);
  }

  private resetEditorGrid(): void {
    const width = sanitizeDimension(Number.parseInt(this.editorWidthInput.value, 10), 25);
    const height = sanitizeDimension(Number.parseInt(this.editorHeightInput.value, 10), 16);
    this.editorGrid = createGrid(width, height, '#');

    const existingIds = this.lastSnapshot?.levels.map((level) => level.id) ?? [];
    this.editorIdInput.value = nextCustomLevelId(existingIds);
    this.editorNameInput.value = 'Custom Level';
    this.renderEditorGrid();
    this.showEditorFeedback('Created a new blank level.');
  }

  private resizeEditorGrid(): void {
    const width = sanitizeDimension(Number.parseInt(this.editorWidthInput.value, 10), this.editorGrid[0]?.length ?? 25);
    const height = sanitizeDimension(Number.parseInt(this.editorHeightInput.value, 10), this.editorGrid.length || 16);
    this.editorGrid = resizeGrid(this.editorGrid, width, height, '#');
    this.renderEditorGrid();
    this.showEditorFeedback(`Resized level to ${width}x${height}.`);
  }

  private applyEditorText(): void {
    try {
      const parsed = parseTextToGrid(this.editorTextArea.value);
      this.editorGrid = parsed;
      this.renderEditorGrid();
      this.showEditorFeedback('Applied level text to grid.');
    } catch (error) {
      this.showEditorFeedback(String(error), true);
    }
  }

  private validateEditorGrid(): void {
    const validation = validateGridForEditor(this.editorGrid);
    if (validation.errors.length > 0) {
      this.showEditorFeedback(validation.errors.join(' '), true);
      return;
    }

    if (validation.warnings.length > 0) {
      this.showEditorFeedback(`Warnings: ${validation.warnings.join(' ')}`);
      return;
    }

    this.showEditorFeedback('Level is valid.');
  }

  private saveEditorLevel(playAfterSave: boolean): void {
    const snapshot = this.lastSnapshot;
    if (!snapshot) {
      return;
    }

    const validation = validateGridForEditor(this.editorGrid);
    if (validation.errors.length > 0) {
      this.showEditorFeedback(validation.errors.join(' '), true);
      return;
    }

    const existingIds = snapshot.levels.map((level) => level.id);
    const providedId = levelIdFromInput(this.editorIdInput.value);
    const levelId = providedId || nextCustomLevelId(existingIds);

    try {
      ensureParseableLevel(levelId, this.editorGrid);
    } catch (error) {
      this.showEditorFeedback(String(error), true);
      return;
    }

    const text = serializeGrid(this.editorGrid);
    const parsedLevel = parseLevelText(levelId, text);
    const displayName = this.editorNameInput.value.trim() || levelId;

    upsertStoredCustomLevel({
      id: levelId,
      name: displayName,
      text,
      updatedAt: Date.now(),
    });

    const index = this.controller.upsertLevel(parsedLevel);

    if (playAfterSave) {
      this.controller.startLevel(index);
      return;
    }

    if (validation.warnings.length > 0) {
      this.showEditorFeedback(`Saved ${levelId}. Warnings: ${validation.warnings.join(' ')}`);
      return;
    }

    this.showEditorFeedback(`Saved ${levelId} locally.`);
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
