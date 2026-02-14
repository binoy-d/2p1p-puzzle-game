import type { ControllerSnapshot, GameController } from '../app/gameController';

function asElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required selector: ${selector}`);
  }
  return element as T;
}

export class OverlayUI {
  private readonly root: HTMLElement;

  private readonly controller: GameController;

  private readonly levelSelect: HTMLSelectElement;

  private readonly statusText: HTMLElement;

  private readonly volumeSlider: HTMLInputElement;

  private readonly lightingToggle: HTMLInputElement;

  private readonly panels: Record<string, HTMLElement>;

  public constructor(root: HTMLElement, controller: GameController) {
    this.root = root;
    this.controller = controller;

    this.root.innerHTML = this.buildMarkup();

    this.panels = {
      main: asElement<HTMLElement>(this.root, '[data-panel="main"]'),
      levelSelect: asElement<HTMLElement>(this.root, '[data-panel="level-select"]'),
      settings: asElement<HTMLElement>(this.root, '[data-panel="settings"]'),
      pause: asElement<HTMLElement>(this.root, '[data-panel="pause"]'),
    };

    this.levelSelect = asElement<HTMLSelectElement>(this.root, '#level-select-input');
    this.statusText = asElement<HTMLElement>(this.root, '#menu-status');
    this.volumeSlider = asElement<HTMLInputElement>(this.root, '#settings-volume');
    this.lightingToggle = asElement<HTMLInputElement>(this.root, '#settings-lighting');

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

  private bindEvents(): void {
    asElement<HTMLButtonElement>(this.root, '#btn-play').addEventListener('click', () => {
      this.controller.startSelectedLevel();
    });

    asElement<HTMLButtonElement>(this.root, '#btn-level-select').addEventListener('click', () => {
      this.controller.openLevelSelect();
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

      if (snapshot.screen === 'level-select') {
        event.preventDefault();
        this.controller.openMainMenu();
      }
    });
  }

  private render(snapshot: ControllerSnapshot): void {
    this.syncLevelOptions(snapshot);

    this.volumeSlider.value = snapshot.settings.volume.toString();
    this.lightingToggle.checked = snapshot.settings.lightingEnabled;
    this.statusText.textContent = snapshot.statusMessage ?? '';

    this.panels.main.hidden = snapshot.screen !== 'main';
    this.panels.levelSelect.hidden = snapshot.screen !== 'level-select';
    this.panels.settings.hidden = snapshot.screen !== 'settings';
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

    this.root.classList.toggle('overlay-hidden', snapshot.screen === 'playing');
  }

  private syncLevelOptions(snapshot: ControllerSnapshot): void {
    if (this.levelSelect.options.length !== snapshot.levels.length) {
      this.levelSelect.innerHTML = '';
      snapshot.levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `Level ${index + 1} (${level.id})`;
        this.levelSelect.append(option);
      });
    }

    const nextValue = String(snapshot.selectedLevelIndex);
    if (this.levelSelect.value !== nextValue) {
      this.levelSelect.value = nextValue;
    }
  }
}
