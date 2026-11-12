# DeskBuddy

*Every empty desk, put to work.* A live office floor map: when a desk owner is WFH / MC / on leave / outstation (read from Slack by an LLM), their desk becomes a hot seat.

Plan, scope and task split: [docs/PLAN.md](docs/PLAN.md)

## Run locally

Requires Node 22+ and Docker.

```bash
cp .env.example .env      # first time only
npm install
npm run db:up             # Postgres on :5432
npm run dev               # API on :3000, web on :5173 (proxies /api)
```

Open http://localhost:5173. On first boot the API seeds a 10-desk stub floor and today's presence.

Reset the database: `docker compose down -v && npm run db:up`.

## Layout

```
apps/api   NestJS + TypeORM (Postgres). Serves /api and, in production, the built web app.
apps/web   React + Vite. Floor map rendered as SVG.
docs/      Plan.
```

| Where | What |
|---|---|
| `apps/api/src/common/contracts.ts` | API types + the 5 desk states. **Copy to `apps/web/src/api/contracts.ts` whenever it changes.** |
| `apps/api/src/floor/derive-desk-state.ts` | The rules for desk state. Derived, never stored. |
| `apps/api/src/presence/presence.service.ts` | The single write path for presence. The Slack listener should call `setPresence()`. |
| `apps/api/src/common/clock.service.ts` | The only source of "now". Use it instead of `new Date()` so the demo clock works. |
| `apps/api/src/events/events.service.ts` | Call `emit()` after any write that changes the map → clients refetch live. |
| `apps/api/src/seed/data/*.json` | Stub data. Person C replaces with the full fictional floor. |

## Art, fonts and data

- **All art is original**, drawn by our own scripts. There are no third-party assets, so there are no licences to track:
  - `scripts/generate-map-art.py` → `apps/web/public/office-map.png` (from `desks.json`)
  - `scripts/generate-characters.py` → `apps/web/public/sprites/characters.png`
- **Fonts** (all SIL Open Font License, bundled via `@fontsource`, no runtime Google Fonts): Silkscreen, IBM Plex Sans, IBM Plex Mono.
- **People and company are fictional** ("Acme Tech"), except the three team members, who appear by first name with consent. Emails are `@acme.example`.
- Regenerate the floor: `node scripts/generate-floor.mjs && python3 scripts/generate-map-art.py && python3 scripts/generate-characters.py`

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | DB check, for the host's health probe |
| GET | `/api/floor?date=YYYY-MM-DD` | Desks with derived state (defaults to today) |
| GET | `/api/users` | For the persona switcher |
| POST | `/api/presence` | `{ userId, status, date? }`; status ∈ IN_OFFICE, WFH, MC, LEAVE, OUTSTATION |
| GET / PUT / DELETE | `/api/clock` | Demo clock. PUT `{ now: ISO }` to fast-forward, DELETE to reset |
| GET | `/api/stream` | Server-Sent Events: `floor-changed`, `clock-changed` |

Try a live update with the web app open:

```bash
curl -X POST localhost:3000/api/presence -H 'Content-Type: application/json' \
  -d '{"userId":"u-meiling","status":"WFH"}'
```

## Deploy

One Docker container + managed Postgres. The host must **not sleep** the container (Slack Socket Mode and SSE need an always-on process).

1. Build from the repo-root `Dockerfile`.
2. Set env vars: `DATABASE_URL`, `DATABASE_SSL=true` (most managed Postgres), `PORT` if the host requires it, `RELEASE_CUTOFF`.
3. Health check: `GET /api/health`.

**Rule:** no commits or deploys after 9:00 AM Friday.
