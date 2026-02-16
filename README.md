# LOCKSTEP

This repository now contains two versions:

- Legacy Java version in `/src`.
- Browser version in `/web` using TypeScript + Vite + Phaser 3.
- Backend API in `/backend` (Node + SQLite) for custom levels and scoreboards.

Lore premise: a fractured Light-Core binds every explorer into one movement field, so each command moves all bodies in lockstep.

## Full Stack Quick Start

Run everything with one command from repo root:

```bash
docker compose up --build
```

Then open `http://localhost:5173`.

Notes:

- Backend API runs on `http://localhost:8787`.
- SQLite data is persisted in the Docker volume `backend-data`.
- Stop services with `docker compose down`.
- Reset persisted DB with `docker compose down -v`.

## Local (non-Docker) Quick Start

Start backend:

```bash
cd backend
npm run start
```

Start web app:

```bash
cd web
npm install
npm run dev
```

Then open the Vite URL (usually `http://localhost:5173`).

### Test

```bash
npm run test
```

### Coverage

```bash
npm run coverage
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Controls

- Move: `WASD` or arrow keys
- Pause menu: `Escape`
- Intro menu (integrated with cinematic):
  - enter player name directly on intro
  - choose level directly on intro
  - top-right quick settings (volume + lighting)
  - `Start` button (or `Enter` / `Space`) to skip and launch selected level
- Menus: mouse + keyboard focusable buttons
- Enemy collisions: short impact animation shows the player/enemy intersection before reset
- Level Editor: available from main menu
- Player name is required before starting a run

## Levels

Level files live in `/web/public/assets/levels/*.txt` and are listed in:

- `/web/public/assets/levels/manifest.json`

### Add a New Level

1. Create a text file in `/web/public/assets/levels` (for example `map13.txt`).
2. Keep the map rectangular (all lines same width).
3. Use supported tiles:
   - `#` wall
   - ` ` empty floor
   - `P` player spawn
   - `!` goal
   - `x` lava
   - `1-9` enemy path markers (`1` is enemy spawn)
4. Append the new filename to `/web/public/assets/levels/manifest.json`.

### In-Game Level Editor and Saver

- Open from Main Menu -> `Level Editor`.
- Paint tiles with the palette (`#`, space, `P`, `!`, `x`, `1-9`).
- Load existing levels into the editor.
- Resize maps and validate before save.
- `Save Level` stores custom levels in backend SQLite and adds them to level select immediately.
- `Save + Play` saves then launches the edited level.
- `Download .txt` exports a compatible level text file.

## Backend API

Base URL: `http://localhost:8787`

- `GET /api/levels` -> all user-created levels
- `POST /api/levels` -> create/update user level
- `GET /api/scores/:levelId` -> top 10 scores for level
- `POST /api/scores` -> submit a run score

SQLite DB is stored at `/backend/data/puzzle.sqlite`.

## Lighting (High Level)

Lighting v1 is implemented as:

- Per-tile brightness shading that matches the original Java feel (walls/floors brighten by player proximity).
- Enemy path center dots pulse in size; the next-hit dot is fully opaque, and farther path dots fade progressively.
- Toggleable from Settings (stored in `localStorage`).

## Audio (High Level)

- Procedural backing track generated at runtime with Web Audio API (no external audio files).
- 16-step house/synth sequencer with kick/snare/hat + bass/chord/lead layers.
- Starts on first user interaction (browser autoplay-safe) and respects the global volume setting.

## Testing Approach

Core logic in `/web/src/core` is pure deterministic TypeScript and tested headlessly with Vitest:

- Parser tests (valid + invalid + property-based roundtrip)
- Collision/movement tests
- State transition tests
- Lighting math tests
- Golden snapshot tests for real levels (`map0`, `map1`)

## Architecture

Detailed architecture and extension guidance:

- `/web/docs/ARCHITECTURE.md`
