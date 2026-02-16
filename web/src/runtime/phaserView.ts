import Phaser from 'phaser';
import type { ControllerSnapshot, GameController } from '../app/gameController';

const FIXED_STEP_MS = 1000 / 60;
const TILE_SIZE = 40;

function isNumericTile(value: string): boolean {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric);
}

function clampByte(value: number): number {
  return Phaser.Math.Clamp(Math.round(value), 0, 255);
}

function rgb(r: number, g: number, b: number): number {
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

class PuzzleScene extends Phaser.Scene {
  private readonly controller: GameController;

  private terrainLayer!: Phaser.GameObjects.Graphics;

  private entityLayer!: Phaser.GameObjects.Graphics;

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
    this.hudText = this.add
      .text(16, 16, '', {
        fontFamily: 'system-ui, sans-serif',
        color: '#f2f6ff',
        fontSize: '16px',
      })
      .setDepth(2)
      .setShadow(0, 1, '#000000', 2, false, true);

    this.registerInput();
  }

  public update(time: number, delta: number): void {
    this.accumulator += delta;

    let guard = 0;
    while (this.accumulator >= FIXED_STEP_MS && guard < 5) {
      this.controller.fixedUpdate(FIXED_STEP_MS);
      this.accumulator -= FIXED_STEP_MS;
      guard += 1;
    }

    this.renderSnapshot(this.controller.getSnapshot(), this.scale.width, this.scale.height, time);
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

  private computeLegacyGlow(
    tileX: number,
    tileY: number,
    players: ControllerSnapshot['gameState']['players'],
  ): number {
    if (players.length === 0) {
      return 0;
    }

    let sumDistances = 0;
    for (const player of players) {
      const dx = tileX - player.x;
      const dy = tileY - player.y;
      sumDistances += Math.sqrt(dx * dx + dy * dy);
    }

    const brightness = sumDistances / ((players.length + 1) / 2);
    let swop = 255 - Math.trunc(brightness * 6);
    swop = Math.trunc(swop / 10);

    // Keep Java ordering/quirk for visual parity.
    if (swop <= 30) {
      swop -= 5;
    } else if (swop <= 15) {
      swop -= 10;
    }

    swop *= 2;
    return clampByte(swop);
  }

  private computeEnemyTint(
    tileX: number,
    tileY: number,
    enemies: ControllerSnapshot['gameState']['enemies'],
  ): number {
    const radius = 2.2;
    let strongest = 0;

    for (const enemy of enemies) {
      const dx = tileX - enemy.x;
      const dy = tileY - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) {
        continue;
      }

      const normalized = 1 - distance / radius;
      const strength = normalized * normalized;
      if (strength > strongest) {
        strongest = strength;
      }
    }

    return strongest;
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

    for (let y = 0; y < levelHeight; y += 1) {
      for (let x = 0; x < levelWidth; x += 1) {
        const tile = state.grid[y][x];
        const glowValue = snapshot.settings.lightingEnabled
          ? this.computeLegacyGlow(x, y, state.players)
          : 140;
        const wallShade = clampByte(glowValue * 2);
        const floorShade = clampByte(glowValue / 4);
        let red = floorShade;
        let green = floorShade;
        let blue = floorShade;

        if (tile === '#') {
          red = wallShade;
          green = wallShade;
          blue = wallShade;
        } else if (tile === 'x') {
          const lavaPulse = 0.5 + 0.5 * Math.sin((time + (x * 13 + y * 19) * 22) / 140);
          red = 190 + lavaPulse * 55;
          green = 32 + lavaPulse * 36;
          blue = 0;
        } else if (tile === '!') {
          const goalPulse = 0.5 + 0.5 * Math.sin((time + (x * 17 + y * 11) * 20) / 170);
          red = 0;
          green = 170 + goalPulse * 22;
          blue = 0;
        }

        const enemyTint = this.computeEnemyTint(x, y, state.enemies);
        red = clampByte(red + enemyTint * 120);
        green = clampByte(green - enemyTint * 22);
        blue = clampByte(blue - enemyTint * 22);

        const color = rgb(red, green, blue);
        this.terrainLayer.fillStyle(color, 1);
        this.terrainLayer.fillRect(offsetX + x * TILE_SIZE, offsetY + y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (tile === '!') {
          this.terrainLayer.fillStyle(rgb(0, 245, 0), 1);
          this.terrainLayer.fillRect(
            offsetX + x * TILE_SIZE + TILE_SIZE * 0.25,
            offsetY + y * TILE_SIZE + TILE_SIZE * 0.25,
            TILE_SIZE * 0.5,
            TILE_SIZE * 0.5,
          );
        }

        if (isNumericTile(tile)) {
          const pathPulse = 0.5 + 0.5 * Math.sin((time + x * 37 + y * 53) / 180);
          this.terrainLayer.fillStyle(rgb(120 + pathPulse * 45, 0, 0), 1);
          this.terrainLayer.fillRect(
            offsetX + x * TILE_SIZE + TILE_SIZE * 0.31,
            offsetY + y * TILE_SIZE + TILE_SIZE * 0.31,
            TILE_SIZE * 0.38,
            TILE_SIZE * 0.38,
          );

          this.terrainLayer.fillStyle(rgb(232 + pathPulse * 22, 25 + pathPulse * 25, 25 + pathPulse * 20), 1);
          this.terrainLayer.fillRect(
            offsetX + x * TILE_SIZE + TILE_SIZE * 0.39,
            offsetY + y * TILE_SIZE + TILE_SIZE * 0.39,
            TILE_SIZE * 0.22,
            TILE_SIZE * 0.22,
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

    const isPaused = snapshot.screen === 'paused';
    this.hudText.setText(
      `Level ${state.levelIndex + 1}/${state.levelIds.length}  Moves ${state.moves}  Players ${state.players.length}/${state.totalPlayers}${isPaused ? '  [PAUSED]' : ''}`,
    );
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
        pixelArt: true,
        antialias: false,
      },
    });
  }

  public destroy(): void {
    this.game.destroy(true);
  }
}
