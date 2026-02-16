# Architecture

## Goals

- Keep game rules deterministic and testable.
- Separate simulation from rendering and browser IO.
- Reuse text levels with minimal format changes.
- Keep stack simple: Vite + TypeScript + Phaser + DOM overlays + minimal Node backend.

## Module Boundaries

### 1) Core (`/web/src/core`)

Pure TypeScript, no Phaser/browser imports.

- `levelParser.ts`: parse and validate level text.
- `engine.ts`: deterministic state transitions.
- `lighting.ts`: deterministic light/falloff math helpers.
- `simulation.ts`: deterministic harness for scripted input playback.
- `types.ts`: domain types.

Core API highlights:

- `createInitialState(levels, startIndex)`
- `update(state, input, dtMs)`
- `restartLevel(state)`
- `setLevel(state, index)`

### 2) Runtime (`/web/src/runtime`)

Browser/Phaser integration and asset loading.

- `levelLoader.ts`: loads manifest + level text files.
- `phaserView.ts`: renders state, collects keyboard input, runs fixed-step loop.
- `settingsStorage.ts`: persists settings to `localStorage`.
- `backendApi.ts`: HTTP client for custom levels and scoreboards.
- `backingTrack.ts`: procedural Web Audio backing track (step sequencer).
- `levelMeta.ts`: level display names and level-based music seed mapping.

### 3) App/UI (`/web/src/app`, `/web/src/ui`)

- `gameController.ts`: orchestration layer between core + runtime + menus.
- `overlay.ts`: DOM menus (main, pause, level select, settings, editor).
- `introCinematic.ts` + `introTimeline.ts`: programmatic title/lore intro renderer and deterministic timeline.
- `editor/levelEditorUtils.ts`: pure utilities for editor grid operations and validation.

Navigation note:

- Level Select is intentionally reachable from pause flow only (`Escape` in gameplay -> Pause -> Level Select).

### 4) Assets

- `/web/public/assets/levels/*.txt`
- `/web/public/assets/levels/manifest.json`

## Update Loop Model

- Runtime accumulates frame delta and executes fixed updates at `60Hz`.
- On each fixed update, one queued direction input is consumed.
- Core `update()` processes one deterministic turn.

Turn order (matching Java behavior):

1. Enemy phase (including enemy collision checks)
2. Player phase (all players move in deterministic order)
3. Win/lose handling and level reset/advance

## Gameplay Invariants Preserved

- Multiple players move on one input direction.
- Enemy tick happens before player movement each turn.
- Enemy path uses mutable numeric tiles (`1..17`) and loops in the same style as Java.
- Touching lava or enemy resets current level.
- Player reaching goal is removed; level advances when all players finish.
- Out-of-bounds movement removes the player from active play.

## Lighting v1

- Tile-based brightness shading to preserve original Java visual style.
- Numeric enemy path center dots pulse in size.
- Dot opacity is strongest for the immediate next-hit tile and fades with path distance.
- Runtime toggle from settings (`lightingEnabled`) switches tile glow intensity behavior.

## Level Editor + Saver

- In-browser editor built with DOM controls and a tile grid painter.
- Supports loading levels, resizing, text export, and validation.
- Saving writes to backend API (SQLite), reparses through core parser, and injects into live controller level list.
- Export path is plain `.txt` to remain compatible with repo map format.

## Backend

- Location: `/backend`
- Runtime: Node HTTP server + built-in SQLite (`node:sqlite`)
- Stores:
  - user-created levels (`user_levels`)
  - run scores (`level_scores`)
- Exposes:
  - `GET /api/levels`
  - `POST /api/levels`
  - `GET /api/scores/:levelId`
  - `POST /api/scores`

Top 10 ordering is deterministic: lowest `moves`, then lowest `durationMs`, then earliest submission.

## Testing

All tests run headlessly in Node with Vitest.

- Parser validity + property-based roundtrip
- Collision and movement edge cases
- State transitions (advance/complete/restart)
- Lighting math
- Golden snapshots for full-level deterministic sequences

## File Layout

```text
web/
  src/
    app/
      gameController.ts
    core/
      engine.ts
      levelParser.ts
      lighting.ts
      simulation.ts
      types.ts
    editor/
      levelEditorUtils.ts
    runtime/
      backingTrack.ts
      backingTrackPattern.ts
      backendApi.ts
      levelLoader.ts
      levelMeta.ts
      phaserView.ts
      settingsStorage.ts
    ui/
      introCinematic.ts
      introTimeline.ts
      overlay.ts
    main.ts
    styles.css
  public/
    assets/
      levels/
        manifest.json
        map0.txt ... map12.txt
  tests/
    core/
      *.test.ts
      __snapshots__/golden.test.ts.snap
    fixtures/
      map0.txt
      map1.txt
backend/
  src/
    config.mjs
    db.mjs
    server.mjs
    validation.mjs
  data/
    puzzle.sqlite
```

## Extending Entities

1. Add new tile symbol(s) in parser validation.
2. Extend core state + update rules in `engine.ts`.
3. Add deterministic tests for the new behavior.
4. Map new state to visuals in `phaserView.ts`.
5. If configurable, expose toggle in `overlay.ts` + `settingsStorage.ts`.
