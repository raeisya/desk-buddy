# DeskBuddy

*Every empty desk, put to work.* A live pixel-art office floor map. When a desk owner is WFH, on MC, on leave or outstation (read from what they already post in Slack), their desk becomes a hot seat someone else can take.

Built for the KopiCode 24h hackathon (12–13 Nov 2026). Plan, scope and task split: [docs/PLAN.md](docs/PLAN.md)

## Features

### Everyone
- **Live floor map**: 60 desks across 6 zones, drawn as a pixel office. Each desk is *occupied*, *available* (owner is out), *hot-seated* (someone else took it today) or *unassigned*. Every open screen updates live when anything changes.
- **Take a free desk for today** from the map, or let **Find me a seat** pick the best free desk near your team.
- **Me page**: set today's status (In office, WFH, MC, Leave, Outstation) and see it as a little scene; **change your own permanent desk** on the floor map; **customise your character** (hair, skin, shirt, pants).
- **Privacy**: colleagues only see *Away*. The reason (MC, leave…) is shown to you and as per-team counts to HODs, never per person on the map.
- **EN / Manglish** toggle (EN | MY) on the main screens.
- Small touches: people stroll around the floor, and clicking the KOPI counter sends your teammates on a *Jom Kopi* run.

### From Slack (no new habit)
- **Daily "where are you working?" prompt**: reactions and replies in the channel become today's status. The parser is rule-based (English, Malay and Manglish keywords, Slack emoji, "esok"/"tomorrow"); low-confidence messages are ignored, not guessed.
- **Slack profile status** (🌴 Vacationing until Friday, 🤒 Out sick…) counts as planned absence for the days it covers.
- **Two-way sync** (optional, `SLACK_STATUS_SYNC=on`): a status set in DeskBuddy is mirrored to your Slack status after you *Connect Slack* on the Me page.
- **Sign in with Slack** (optional) lands you as your linked persona. The persona picker always works.

### HOD (Team page)
- **Team today**: in office / WFH / MC / leave / outstation per team. Counts only, no names.
- **Desk use, last 4 weeks**: weekday heatmap, busiest and quietest day, and a hint to move one team's office day.
- **Seats for new joiners**: free desks near the team and a *room for ~N more staff* estimate from the busiest weekday.
- **Manage desks**: on the floor map, click a free (green) desk to give it to someone in your team, or click a teammate's desk to take it back.

### Admin
- Everything an HOD has, for **every team**.
- **Staff page**: search by name or desk, filter by team and active/deactivated, paginated. Change team or role inline. The **⋮** menu on each row: *Remove from desk*, *Deactivate* (hidden from sign-in and counts, desk freed) or *Reactivate*.

## Demo personas

Pick these on the login page:

| Persona | Role | Team | Good for showing |
|---|---|---|---|
| **Isaac** | Admin | Business Development | Staff page, Manage desks for any team |
| **Farhan** | HOD | Business Development | Team page, Manage desks for own team |
| **Alia** | HOD | CityOS | A second team's view: Manage desks only shows CityOS desks |
| **Akmal** | Staff | Business Development | No permanent desk: Find me a seat, take a desk |
| **Aina Zulkifli** | Staff | CityOS | The new joiner who needs a permanent desk |

All 81 people and the company ("Acme Tech") are fictional. See [Art, fonts and data](#art-fonts-and-data).

## Run locally

Requires Node 22+ and Docker.

```bash
cp .env.example .env      # first time only
npm install
npm run db:up             # Postgres on :5432
npm run dev               # API on :3000, web on :5173 (proxies /api)
```

Open http://localhost:5173. On first boot the API seeds 60 desks, 81 staff, today's presence and 4 weeks of history. Slack is off until its variables are set; everything else works without it.

Reset the database: `docker compose down -v && npm run db:up`.

Try a live update with the web app open:

```bash
curl -X POST localhost:3000/api/presence -H 'Content-Type: application/json' \
  -d '{"userId":"u-meiling","status":"WFH"}'

# Same as a Slack message, without Slack (demo fallback)
curl -X POST localhost:3000/api/slack/inject -H 'Content-Type: application/json' \
  -d '{"userId":"u-meiling","text":"mc today, demam"}'
```

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Always | Postgres connection string |
| `DATABASE_SSL` | Managed Postgres | `true` for Neon, Supabase, Railway etc. |
| `PORT` | Hosting | Defaults to 3000 |
| `RELEASE_CUTOFF` | Nothing (kept for the API) | Shown by `/api/clock` and `/api/floor`. Desks are **not** auto-released any more (team decision, 12 Nov): silence means "in the office" |
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID` | Reading Slack | All three, or the Slack listener stays off. Socket Mode, so no public URL needed |
| `SLACK_USER_MAP` | Optional | Pin Slack members to demo staff: `U0AAA:u-meiling,U0BBB:u-hafiz`. Real IDs go in `.env` / Railway only, never in git |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Sign in with Slack, Connect Slack | OpenID Connect |
| `SLACK_STATUS_SYNC` | Two-way status | `on` only once the Slack app has the user scopes `users.profile:read` and `users.profile:write` |

## Layout

```
apps/api   NestJS + TypeORM (Postgres). Serves /api and, in production, the built web app.
apps/web   React + Vite. Pixel floor map: one PNG background with sprite characters on top.
scripts/   Generators for the floor, map art and character sprites.
docs/      Plan.
```

| Where | What |
|---|---|
| `apps/api/src/common/contracts.ts` | API types and the desk states. **Copy to `apps/web/src/api/contracts.ts` whenever it changes.** |
| `apps/api/src/floor/derive-desk-state.ts` | The rules for desk state. Derived, never stored. |
| `apps/api/src/presence/presence.service.ts` | The single write path for presence. Slack, the Me page and the API all call `setPresence()`. |
| `apps/api/src/parser/status-parser.ts` | Slack text and emoji → status. Rule-based. |
| `apps/api/src/common/clock.service.ts` | The only source of "now". Use it instead of `new Date()` so the demo clock works. |
| `apps/api/src/events/events.service.ts` | Call `emit()` after any write that changes the map → clients refetch live. |
| `apps/api/src/seed/data/*.json` | The fictional floor, staff and today's presence. |

## API

All under `/api`. Who you are comes from `userId` / `actorId` in the request (see [Known limits](#known-limits)).

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB check, for the host's health probe |
| GET | `/floor?date=YYYY-MM-DD` | Desks with derived state (defaults to today) |
| GET | `/stream` | Server-Sent Events: `floor-changed`, `clock-changed` |
| GET | `/users` | Active people, for the persona picker |
| PUT | `/users/:id/avatar` | Save a character look; `{ reset: true }` for the default |
| GET | `/presence/:userId` | Your own status today, with the reason (Me page only) |
| POST | `/presence` | `{ userId, status, date? }`; status ∈ IN_OFFICE, WFH, MC, LEAVE, OUTSTATION |
| POST | `/bookings` | `{ deskId, userId }`: take a desk for today |
| POST | `/bookings/release` | `{ deskId, userId }`: leave the desk you took |
| POST | `/desks/:id/move` | `{ userId }`: move your own permanent desk to a desk with no owner |
| PUT | `/desks/:id/owner` | `{ actorId, userId \| null }`: HOD (own team) or admin assigns or takes back a permanent desk |
| GET | `/admin/users?actorId=` | Admin: everyone, including deactivated, with their desk |
| PATCH | `/admin/users/:id` | Admin: `{ actorId, team?, role?, active? }` |
| GET | `/hod/today` | Status counts per team for today |
| GET | `/hod/heatmap` | Desk use per weekday, last 4 weeks |
| GET / PUT / DELETE | `/clock` | Demo clock. PUT `{ now: ISO }` to fast-forward, DELETE to reset |
| GET | `/slack/status` | Is the API connected to Slack? |
| POST | `/slack/daily-prompt` | Bot posts today's "where are you working?" message |
| POST | `/slack/status-sync` | Re-read everyone's Slack profile status now |
| POST | `/slack/inject` | `{ userId, text }`: parse text as if posted in Slack (demo fallback) |
| GET | `/auth/slack`, `/auth/slack/callback` | Sign in with Slack |
| GET | `/slack/status-link`, `/auth/slack/status` | Connect Slack for two-way status |

## Known limits

- **Identity is not verified.** Sign-in picks a persona and the API trusts the `userId` / `actorId` it is sent. Roles are enforced on the server (staff can't assign desks, a HOD can't touch another team), but anyone who can reach the API can act as anyone. Real sessions are the next step.
- **No LLM yet.** Slack messages are parsed by keyword and emoji rules, which cover the common EN/BM/Manglish phrasings. An LLM parser can slot in behind the same `parseStatusText` contract, with the rules as fallback.
- **`synchronize: true`** in TypeORM: fine for the hackathon, needs migrations before real data.

## Art, fonts and data

- **All art is original**, drawn by our own scripts. There are no third-party assets, so there are no licences to track:
  - `scripts/generate-map-art.py` → `apps/web/public/office-map.png` (from `desks.json`)
  - `scripts/generate-characters.py` → `apps/web/public/sprites/characters.png`
- **Fonts** (all SIL Open Font License, bundled via `@fontsource`, no runtime Google Fonts): Silkscreen, IBM Plex Sans, IBM Plex Mono.
- **People and company are fictional** ("Acme Tech"), except the three team members, who appear by first name with consent. Emails are `@acme.example`.
- Regenerate the floor: `node scripts/generate-floor.mjs && python3 scripts/generate-map-art.py && python3 scripts/generate-characters.py`

## Deploy

One Docker container + managed Postgres. The host must **not sleep** the container (Slack Socket Mode and SSE need an always-on process). `main` auto-deploys to Railway.

1. Build from the repo-root `Dockerfile`.
2. Set the [environment variables](#environment-variables) above (at least `DATABASE_URL` and `DATABASE_SSL=true`).
3. Health check: `GET /api/health`.

**Rule:** no commits or deploys after 9:00 AM Friday.
