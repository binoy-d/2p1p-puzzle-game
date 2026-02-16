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
- Level Editor: available from main menu

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
- Load existing built-in/custom levels into the editor.
- Resize maps, edit raw text, and validate before save.
- `Save Local` stores custom levels in browser `localStorage` and adds them to level select immediately.
- `Save + Play` saves then launches the edited level.
- `Download .txt` exports a compatible level text file.

## Lighting (High Level)

Lighting v1 is implemented as:

- Per-tile brightness shading that matches the original Java feel (walls/floors brighten by player proximity).
- Short-range enemy red tint spread on surrounding tiles for hazard readability.
- Enhanced enemy path visibility with animated red center markers on numeric path tiles.
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
