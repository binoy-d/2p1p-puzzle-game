# 2P1P Puzzle Game

This repository now contains two versions:

- Legacy Java version in `/src`.
- Browser version in `/web` using TypeScript + Vite + Phaser 3.

## Web Game Quick Start

From the `web` folder:

```bash
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
- Pause/Resume: `Escape`
- Menus: mouse + keyboard focusable buttons

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

## Lighting (High Level)

Lighting v1 is implemented as:

- A darkness render texture over the scene.
- Radial cutouts erased around players (larger) and enemies (smaller) for radius/falloff.
- Additive glow circles layered on top for visual bloom.
- Toggleable from Settings (stored in `localStorage`).

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
