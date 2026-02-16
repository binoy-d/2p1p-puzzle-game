# Copilot Instructions

## Project Structure

- Legacy Java game: `/src`
- Web game: `/web`
- Deterministic game rules (no Phaser/browser APIs): `/web/src/core`
- Browser/runtime integration: `/web/src/runtime`
- Menus and level editor UI: `/web/src/ui`
- Editor utilities: `/web/src/editor`
- Tests: `/web/tests`
- Backend API + SQLite: `/backend`

## Core Engineering Rules

1. Keep gameplay logic deterministic in `/web/src/core`.
2. Do not import Phaser or browser globals into core modules.
3. Match original Java turn order:
   - enemy phase first
   - player phase second
4. Preserve level text compatibility (`#`, space, `P`, `!`, `x`, `1-9`).
5. Prefer small, focused edits and keep tests passing.

## Commands

Run from `/web`:

```bash
npm install
npm run dev
npm run lint
npm run test
npm run coverage
npm run build
```

Run backend from `/backend`:

```bash
npm run start
npm run test
```

## Testing Expectations

- Add/update unit tests for deterministic behavior changes.
- Keep parser/collision/state-transition tests green.
- For renderer-only changes, ensure no core behavior regressions.

## Level Editor Notes

- Editor must save parseable level text.
- Save flow should:
  1. validate grid,
  2. parse through `parseLevelText`,
  3. persist to backend `POST /api/levels`,
  4. upsert into controller level list.
- Export `.txt` files in the same format as built-in maps.
- Require a non-empty player name before allowing gameplay.
- Submit per-level scores (`moves`, `durationMs`) to backend and keep top 10 ordering stable.

## Styling and UX

- Keep controls keyboard-accessible.
- Maintain readable tile contrast for path/hazard visualization.
- Do not add heavyweight UI frameworks.
