# 2P1P Puzzle Backend

Simple Node backend for:

- storing user-created levels
- storing per-level top 10 scores

## Run

```bash
cd backend
npm run start
```

Default URL: `http://localhost:8787`

## Dev mode

```bash
npm run dev
```

## Test

```bash
npm run test
```

## API

- `GET /api/health`
- `GET /api/levels`
- `POST /api/levels`
- `GET /api/scores/:levelId`
- `POST /api/scores`

All requests/responses are JSON.

## Storage

SQLite file at `backend/data/puzzle.sqlite` (configurable via `DB_PATH`).
