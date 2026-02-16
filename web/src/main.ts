import { GameController } from './app/gameController';
import { parseLevelText } from './core/levelParser';
import type { ParsedLevel } from './core/types';
import { fetchCustomLevels } from './runtime/backendApi';
import { ProceduralBackingTrack } from './runtime/backingTrack';
import { loadLevelsFromManifest } from './runtime/levelLoader';
import { PhaserGameView } from './runtime/phaserView';
import { loadSettings } from './runtime/settingsStorage';
import { OverlayUI } from './ui/overlay';
import './styles.css';

async function bootstrap(): Promise<void> {
  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (!appRoot) {
    throw new Error('Missing #app root element.');
  }

  appRoot.innerHTML = `
    <div id="game-shell">
      <div id="game-root" role="application" aria-label="Puzzle game canvas"></div>
      <div id="menu-root" aria-label="Game menus"></div>
    </div>
  `;

  const builtInLevels = await loadLevelsFromManifest('/assets/levels/manifest.json');
  const customLevels: ParsedLevel[] = [];

  try {
    const fromBackend = await fetchCustomLevels();
    for (const level of fromBackend) {
      try {
        customLevels.push(parseLevelText(level.id, level.text));
      } catch {
        // Skip malformed backend entries but continue loading valid levels.
      }
    }
  } catch {
    // Backend optional in dev: game still runs with built-in levels.
  }

  const levels = [...builtInLevels, ...customLevels];
  const settings = loadSettings();

  const controller = new GameController(levels, settings);
  new PhaserGameView('game-root', controller);
  const backingTrack = new ProceduralBackingTrack(controller);
  window.addEventListener(
    'beforeunload',
    () => {
      backingTrack.destroy();
    },
    { once: true },
  );

  const menuRoot = document.querySelector<HTMLElement>('#menu-root');
  if (!menuRoot) {
    throw new Error('Missing #menu-root element.');
  }

  new OverlayUI(menuRoot, controller);
}

bootstrap().catch((error) => {
  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (appRoot) {
    appRoot.innerHTML = `<pre class="boot-error">${String(error)}</pre>`;
  }

  throw error;
});
