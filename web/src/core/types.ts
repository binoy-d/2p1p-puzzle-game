export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Player extends Vec2 {
  id: number;
}

export interface Enemy extends Vec2 {
  id: number;
}

export interface ParsedLevel {
  id: string;
  width: number;
  height: number;
  grid: string[][];
  playerSpawns: Vec2[];
  enemySpawns: Vec2[];
}

export type GameStatus = 'playing' | 'game-complete';

export type TurnEvent =
  | 'none'
  | 'level-reset'
  | 'level-advanced'
  | 'game-complete'
  | 'turn-processed';

export interface GameState {
  levelIds: string[];
  levels: Record<string, ParsedLevel>;
  levelIndex: number;
  levelId: string;
  grid: string[][];
  players: Player[];
  enemies: Enemy[];
  totalPlayers: number;
  playersDone: number;
  moves: number;
  tick: number;
  status: GameStatus;
  lastEvent: TurnEvent;
}

export interface UpdateInput {
  direction: Direction | null;
  restart?: boolean;
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
}

export interface LightingConfig {
  ambient: number;
  falloffExponent: number;
}
