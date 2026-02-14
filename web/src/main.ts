import { GameController } from './app/gameController';
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

  const levels = await loadLevelsFromManifest('/assets/levels/manifest.json');
  const settings = loadSettings();

  const controller = new GameController(levels, settings);
  new PhaserGameView('game-root', controller);

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
