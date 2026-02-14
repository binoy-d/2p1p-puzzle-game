import Phaser from 'phaser';
import type { ControllerSnapshot, GameController } from '../app/gameController';
import { getSpawnTileCenter } from '../core/engine';

const FIXED_STEP_MS = 1000 / 60;
const TILE_SIZE = 40;
const LIGHT_TEXTURE_KEY = 'light-gradient';

function isNumericTile(value: string): boolean {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric);
}

class PuzzleScene extends Phaser.Scene {
  private readonly controller: GameController;

  private terrainLayer!: Phaser.GameObjects.Graphics;

  private entityLayer!: Phaser.GameObjects.Graphics;

  private glowLayer!: Phaser.GameObjects.Graphics;

  private darknessLayer!: Phaser.GameObjects.RenderTexture;

  private hudText!: Phaser.GameObjects.Text;

  private accumulator = 0;

  public constructor(controller: GameController) {
    super('PuzzleScene');
    this.controller = controller;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0x08090d);

    this.terrainLayer = this.add.graphics().setDepth(0);
    this.entityLayer = this.add.graphics().setDepth(1);
    this.glowLayer = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.darknessLayer = this.add
      .renderTexture(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setDepth(3);
    this.hudText = this.add
      .text(16, 16, '', {
        fontFamily: 'system-ui, sans-serif',
        color: '#f2f6ff',
        fontSize: '16px',
      })
      .setDepth(4)
      .setShadow(0, 1, '#000000', 2, false, true);

    this.createLightTexture();
    this.registerInput();
  }

  public update(_time: number, delta: number): void {
    this.accumulator += delta;

    let guard = 0;
    while (this.accumulator >= FIXED_STEP_MS && guard < 5) {
      this.controller.fixedUpdate(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      guard += 1;
    }

    this.renderSnapshot(this.controller.getSnapshot(), this.scale.width, this.scale.height, _time);
  }

  private createLightTexture(): void {
    if (this.textures.exists(LIGHT_TEXTURE_KEY)) {
      return;
    }

    const size = 256;
    const texture = this.textures.createCanvas(LIGHT_TEXTURE_KEY, size, size);
    if (!texture) {
      throw new Error('Unable to create light texture.');
    }
    const ctx = texture.context;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }

  private registerInput(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          event.preventDefault();
          this.controller.queueDirection('up');
          break;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          this.controller.queueDirection('down');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          event.preventDefault();
          this.controller.queueDirection('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          event.preventDefault();
          this.controller.queueDirection('right');
          break;
        case 'Escape':
          event.preventDefault();
          this.controller.togglePause();
          break;
        default:
          break;
      }
    });
  }

  private renderSnapshot(
    snapshot: ControllerSnapshot,
    viewportWidth: number,
    viewportHeight: number,
    time: number,
  ): void {
    const state = snapshot.gameState;
    const levelHeight = state.grid.length;
    const levelWidth = state.grid[0]?.length ?? 0;

    const boardWidth = levelWidth * TILE_SIZE;
    const boardHeight = levelHeight * TILE_SIZE;
    const offsetX = Math.floor((viewportWidth - boardWidth) / 2);
    const offsetY = Math.floor((viewportHeight - boardHeight) / 2);

    this.terrainLayer.clear();
    this.entityLayer.clear();
    this.glowLayer.clear();

    for (let y = 0; y < levelHeight; y += 1) {
      for (let x = 0; x < levelWidth; x += 1) {
        const tile = state.grid[y][x];
        let color = 0x1d2128;

        if (tile === '#') {
          color = 0x5a616f;
        } else if (tile === 'x') {
          color = 0xc14b1d;
        } else if (tile === '!') {
          color = 0x15754a;
        } else if (isNumericTile(tile)) {
          color = 0x242a34;
        }

        this.terrainLayer.fillStyle(color, 1);
        this.terrainLayer.fillRect(offsetX + x * TILE_SIZE, offsetY + y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (tile === '!') {
          this.terrainLayer.fillStyle(0x46e58a, 1);
          this.terrainLayer.fillRect(
            offsetX + x * TILE_SIZE + TILE_SIZE * 0.25,
            offsetY + y * TILE_SIZE + TILE_SIZE * 0.25,
            TILE_SIZE * 0.5,
            TILE_SIZE * 0.5,
          );
        }
      }
    }

    const pulseScale = 0.72 + 0.16 * (Math.sin(time / 160) + 1) / 2;
    for (const player of state.players) {
      const px = offsetX + player.x * TILE_SIZE;
      const py = offsetY + player.y * TILE_SIZE;

      this.entityLayer.fillStyle(0xffffff, 1);
      this.entityLayer.fillRect(
        px + (TILE_SIZE * (1 - pulseScale)) / 2,
        py + (TILE_SIZE * (1 - pulseScale)) / 2,
        TILE_SIZE * pulseScale,
        TILE_SIZE * pulseScale,
      );
    }

    for (const enemy of state.enemies) {
      const ex = offsetX + enemy.x * TILE_SIZE;
      const ey = offsetY + enemy.y * TILE_SIZE;

      this.entityLayer.fillStyle(0xae1b2f, 1);
      this.entityLayer.fillRect(ex, ey, TILE_SIZE, TILE_SIZE);

      this.entityLayer.fillStyle(0xff6578, 1);
      this.entityLayer.fillRect(
        ex + TILE_SIZE * 0.28,
        ey + TILE_SIZE * 0.28,
        TILE_SIZE * 0.44,
        TILE_SIZE * 0.44,
      );
    }

    if (snapshot.settings.lightingEnabled) {
      this.applyLighting(state, offsetX, offsetY);
    } else {
      this.darknessLayer.clear();
    }

    const isPaused = snapshot.screen === 'paused';
    this.hudText.setText(
      `Level ${state.levelIndex + 1}/${state.levelIds.length}  Moves ${state.moves}  Players ${state.players.length}/${state.totalPlayers}${isPaused ? '  [PAUSED]' : ''}`,
    );
  }

  private applyLighting(state: ControllerSnapshot['gameState'], offsetX: number, offsetY: number): void {
    this.darknessLayer.clear();
    this.darknessLayer.fill(0x000000, 0.78);

    for (const player of state.players) {
      const center = getSpawnTileCenter(player.x, player.y, TILE_SIZE, offsetX, offsetY);
      this.darknessLayer.erase(LIGHT_TEXTURE_KEY, center.x - 124, center.y - 124);

      this.glowLayer.fillStyle(0xffffff, 0.24);
      this.glowLayer.fillCircle(center.x, center.y, TILE_SIZE * 1.15);
    }

    for (const enemy of state.enemies) {
      const center = getSpawnTileCenter(enemy.x, enemy.y, TILE_SIZE, offsetX, offsetY);
      this.darknessLayer.erase(LIGHT_TEXTURE_KEY, center.x - 72, center.y - 72);

      this.glowLayer.fillStyle(0xff4455, 0.2);
      this.glowLayer.fillCircle(center.x, center.y, TILE_SIZE * 0.85);
    }
  }
}

export class PhaserGameView {
  private readonly game: Phaser.Game;

  public constructor(containerId: string, controller: GameController) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerId,
      width: 1280,
      height: 720,
      backgroundColor: '#08090d',
      scene: [new PuzzleScene(controller)],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: false,
        antialias: true,
      },
    });
  }

  public destroy(): void {
    this.game.destroy(true);
  }
}
