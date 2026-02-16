import Phaser from 'phaser';
import type { ControllerSnapshot, GameController } from '../app/gameController';
import {
  collectEnemyPathTargets,
  computePathDotOpacity,
  computePathDotScale,
  pathDistanceFromNextHit,
} from './enemyPathVisuals';

const FIXED_STEP_MS = 1000 / 60;
const MIN_TILE_SIZE = 22;
const MAX_TILE_SIZE = 80;
const BOARD_WIDTH_RATIO = 0.96;
const BOARD_HEIGHT_RATIO = 0.9;

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

function fract(value: number): number {
  return value - Math.floor(value);
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

  private computeTileSize(viewportWidth: number, viewportHeight: number, levelWidth: number, levelHeight: number): number {
    if (levelWidth <= 0 || levelHeight <= 0) {
      return 40;
    }

    const widthBased = (viewportWidth * BOARD_WIDTH_RATIO) / levelWidth;
    const heightBased = (viewportHeight * BOARD_HEIGHT_RATIO) / levelHeight;
    const size = Math.floor(Math.min(widthBased, heightBased));
    return Phaser.Math.Clamp(size, MIN_TILE_SIZE, MAX_TILE_SIZE);
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
    const tileSize = this.computeTileSize(viewportWidth, viewportHeight, levelWidth, levelHeight);

    const boardWidth = levelWidth * tileSize;
    const boardHeight = levelHeight * tileSize;
    const offsetX = Math.floor((viewportWidth - boardWidth) / 2);
    const offsetY = Math.floor((viewportHeight - boardHeight) / 2);
    const enemyPathTargets = collectEnemyPathTargets(state.enemies, state.grid);
    const enemyTargetValues = enemyPathTargets.map((target) => target.value);

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

        const color = rgb(red, green, blue);
        this.terrainLayer.fillStyle(color, 1);
        this.terrainLayer.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);

        if (tile === 'x') {
          const subSize = tileSize / 4;
          const flickerStep = Math.floor(time / 95);
          for (let iy = 0; iy < 4; iy += 1) {
            for (let ix = 0; ix < 4; ix += 1) {
              const seed = (x + 1) * 73856093 + (y + 1) * 19349663 + (ix + 1) * 83492791 + (iy + 1) * 297121507 + flickerStep * 104729;
              const noise = fract(Math.sin(seed) * 43758.5453);
              const subRed = 210 + noise * 40;
              const subGreen = 22 + noise * 35;

              this.terrainLayer.fillStyle(rgb(subRed, subGreen, 0), 1);
              this.terrainLayer.fillRect(
                offsetX + x * tileSize + ix * subSize,
                offsetY + y * tileSize + iy * subSize,
                subSize,
                subSize,
              );
            }
          }
        }

        if (tile === '!') {
          this.terrainLayer.fillStyle(rgb(0, 245, 0), 1);
          this.terrainLayer.fillRect(
            offsetX + x * tileSize + tileSize * 0.25,
            offsetY + y * tileSize + tileSize * 0.25,
            tileSize * 0.5,
            tileSize * 0.5,
          );
        }

        if (isNumericTile(tile)) {
          const tileValue = Number.parseInt(tile, 10);
          const distanceFromNext = pathDistanceFromNextHit(tileValue, enemyTargetValues);
          const opacity = computePathDotOpacity(distanceFromNext);
          const centerScale = computePathDotScale(distanceFromNext, time, x * 0.37 + y * 0.53);
          const centerSize = tileSize * centerScale;
          const outerSize = centerSize * 1.55;
          const outerInset = (tileSize - outerSize) / 2;
          const centerInset = (tileSize - centerSize) / 2;
          const pathPulse = 0.5 + 0.5 * Math.sin((time + x * 37 + y * 53) / 180);

          this.terrainLayer.fillStyle(rgb(120 + pathPulse * 45, 0, 0), opacity * 0.55);
          this.terrainLayer.fillRect(
            offsetX + x * tileSize + outerInset,
            offsetY + y * tileSize + outerInset,
            outerSize,
            outerSize,
          );

          this.terrainLayer.fillStyle(
            rgb(232 + pathPulse * 22, 25 + pathPulse * 25, 25 + pathPulse * 20),
            opacity,
          );
          this.terrainLayer.fillRect(
            offsetX + x * tileSize + centerInset,
            offsetY + y * tileSize + centerInset,
            centerSize,
            centerSize,
          );
        }
      }
    }

    const pulseScale = 0.72 + 0.16 * (Math.sin(time / 160) + 1) / 2;
    for (const player of state.players) {
      const px = offsetX + player.x * tileSize;
      const py = offsetY + player.y * tileSize;

      this.entityLayer.fillStyle(0xffffff, 1);
      this.entityLayer.fillRect(
        px + (tileSize * (1 - pulseScale)) / 2,
        py + (tileSize * (1 - pulseScale)) / 2,
        tileSize * pulseScale,
        tileSize * pulseScale,
      );
    }

    for (const enemy of state.enemies) {
      const ex = offsetX + enemy.x * tileSize;
      const ey = offsetY + enemy.y * tileSize;

      this.entityLayer.fillStyle(0xae1b2f, 1);
      this.entityLayer.fillRect(ex, ey, tileSize, tileSize);

      this.entityLayer.fillStyle(0xff6578, 1);
      this.entityLayer.fillRect(
        ex + tileSize * 0.28,
        ey + tileSize * 0.28,
        tileSize * 0.44,
        tileSize * 0.44,
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
