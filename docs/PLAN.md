# DeskBuddy — Hackathon Plan

> *Every empty desk, put to work.*

KopiCode 24h Hackathon · Thu 12 Nov 9:00 AM → Fri 13 Nov 9:00 AM · Team of 3 · Repo: `raeisya/desk-buddy`

## Theme fit
Theme: **Work, Build, Serve.** DeskBuddy sits in **Work** (business productivity: better ways of working inside the company; benefits staff and corporate functions).

- Work is likely the most crowded pillar, and some teams will build booking apps. **Lead the pitch with what a booking app doesn't have:** AI reading the Slack messages people already post, plus the capacity number.
- One roadmap line for **Serve**: the same occupancy layer offered to tenants of commercial buildings the company develops. Slide only, no code.

## Problem
A growing tech company is running out of desks. Seats were taken first-come, so teams are scattered across the floor. Seniors often work from home, juniors sometimes do too. On any given day, desks of absent owners sit empty while other staff have nowhere to sit.

## Product
**DeskBuddy** is a live office floor map. When a desk owner is WFH, on MC, on leave or outstation, their desk becomes available as a hot seat.

- **Status comes from Slack.** People already post "wfh today" in a team channel. An LLM turns those free-text messages (including Malay/Manglish) into a structured status, so nobody needs a new habit.
- **Juniors** see free desks live and claim one near their team.
- **HODs** get a team presence dashboard.

Positioning: an **occupancy/presence layer**, not an HR or leave system.

## Judging criteria
| Criterion | Weight | What it means for us |
|---|---|---|
| Problem & Commercial Value + Feasibility | 30% | Capacity slide with numbers; answer "what if people don't update?" |
| Working Demo | 30% | One end-to-end journey, clean UI. Code is not reviewed. |
| Creativity & Innovation | 20% | Clever use of AI/tools |
| Presentation & Storytelling | 15% | Time limit, Q&A |
| Additional Challenge | 5% | Surprise challenge drops **5:00 PM Thursday** |

Judges score only what the demo shows. Code is not reviewed, but **commit IDs and deployment times are checked.**

## Constraints
- **Dummy data only, no company data.** Fictional company **"Acme Tech"**: 80 staff, 60 desks, +20%/yr headcount growth. Fictional floor plan, made-up Malaysian names, no real colleagues. Commercial numbers are either public or labelled "illustrative".
- **Slack: our own test workspace only.** Real Slack accounts for just 4–5 demo characters (our own accounts + Gmail plus-addresses). The other ~75 staff exist only in the DB with seeded history.
- **Stack:** React + Vite, NestJS, Postgres. `synchronize: true` is fine for the hackathon. Slack Bolt in **Socket Mode** (no public URL or tunnel needed). Slack app created from a manifest.
- **Must be cloud-hosted.** Localhost, mock-ups and Figma are not accepted. Socket Mode and the live map need an always-on process. **Decision: Railway** (see Deploy below). **Deploy the skeleton before lunch and redeploy continuously.**
- **Disqualification:** any commit or deploy after 9:00 AM Friday, presenting a version other than the one submitted, or using work built before 9:00 AM Thursday.
- **Repo is public.** Never commit confidential company data, real staff data, Slack tokens or API keys. Secrets go in `.env` only, and `.env` is in `.gitignore`.

## Key risks and design decisions
- **Biggest risk: stale status.** If people don't update, the map lies and trust dies. Mitigations:
  - The LLM reads Slack messages people already post (no habit change).
  - Check-in + auto-release: owner not checked in by 10am → desk freed.
  - Low-confidence parse → Slack DM "Did you mean WFH tomorrow? [Yes] [No]".
- **Privacy:** MC is health data (PDPA). Colleagues see "Away"; only the HOD sees the reason. Report WFH per team, not per person, to avoid a surveillance feel.
- **Desk state is derived** from owner presence + bookings. It is never stored.
- **Live demo depends on Slack + LLM API + venue Wi-Fi.** See proposal P2 below.
- **Pixel office is a skin over the same data, not a rewrite.** React + absolutely positioned pixel sprites on one background image (`image-rendering: pixelated`, CSS sprite sheets, CSS transitions for walking). No Phaser/PixiJS.
- **Art can eat the build.** Use a ready-made pixel office tileset (licence must allow a public repo + demo; record it in the README). Static office by 17:00; animation only after 21:00, capped at 4h.
- **Bubbles show "Away" / "In office" only**, never the reason.
- Record a **1–2 min backup demo video** of the final deployed version (part of the submission; played if the live demo breaks).
- Venue Wi-Fi is unknown until the day: **bring a phone hotspot.**

## What the AI does (Person A)
Turns Slack messages into structured status.

```
"otw site Putrajaya until Thu"
→ { status: "OUTSTATION", from: "2026-11-12", to: "2026-11-14", confidence: 0.92 }
```

- Prompt includes today's date (to resolve "esok", "until Thu"), few-shot examples, forced JSON output, small fast model.
- ~2–3 hours of work.
- Measured against 50 Manglish test messages (A generates them with AI, C reviews them for realism) → a "47/50 parsed correctly" slide.

## Scope
**Must (the demo):**
1. Login page = demo persona picker (Owner / Junior / HOD), with a show-only "Sign in with Slack" button
2. Pixel-art office rendered from `desks.json` over a tileset map image (no floor editor), in a pixel UI theme
3. Slack channel listener → LLM parse → presence row
4. Map updates **live** (SSE/websocket) when a Slack message arrives
5. Claim + check in to a free desk
6. HOD dashboard: today's counts per team + 4-week occupancy heatmap (seeded)

**Should (only after the must-haves work end to end):**
- Auto-release with a fast-forward demo clock (our answer to the stale-status question)
- Nearest-desk-to-team suggestion
- Low-confidence Slack DM
- Avatar animation: walk to desk, typing loop, bubble when a Slack message lands
- "DeskBuddy bot" sprite that walks to a desk and says "Got it: Hafiz is away today" when the AI parses a message (makes the AI visible on stage)
- Real Slack sign-in (OAuth): roadmap only, the login button is for show

**Won't (mention in the pitch as roadmap):** floor editor, multi-floor, HRMS integration, mobile app, per-person WFH tracking.

**Capacity forecast** is a slide, not a feature: "Seats run out in N months; hot-seating pushes it to M months."

## Data model (4 tables)
| Table | Columns |
|---|---|
| `users` | id, slack_id, email, name, team, role (staff/hod/admin) |
| `desks` | id, x, y, w, h, zone, owner_id (the only place ownership lives) |
| `presence` | user_id, date, status, source, raw_message, confidence |
| `bookings` | desk_id, user_id, date, checked_in_at, released_at |

Desk states: `occupied | available | hot-seated | away | unassigned`. `away` = owner hasn't posted yet and it's before the 10:00 cutoff; after the cutoff a silent owner's desk becomes `available` (auto-release). Rules live in `apps/api/src/floor/derive-desk-state.ts`.

## Pitch: 5 min presentation + 2 min Q&A
~2.5 min problem/value/capacity slide + ~2.5 min live demo.

**Demo journey (~2.5 min)**
1. Owner posts "wfh today" in Slack.
2. AI parses it → an "Away" bubble pops above the owner's avatar, the avatar leaves, the desk glows free, live.
3. Junior (picked on the login page) asks for a seat near their team → DeskBuddy suggests that desk.
4. Junior checks in; their avatar walks over and sits.
5. Fast-forward demo clock → a no-show owner's desk auto-releases at 10am.
6. HOD dashboard counts update.

**Prepare Q&A answers for:** "What if people don't update Slack?" (auto-release), "Isn't this surveillance?" (Away only, per-team reporting), "Why not just a booking app?" (no new habit), "What's it worth?" (capacity slide).

## Dummy data patterns (make it look real)
- Tue/Wed near full, Fridays half empty
- Seniors WFH more
- One team always split across the floor
- Someone outstation weekly
- An MC cluster in one week

Generate with a rule-based script. Use AI only for names and message text, then sanity-check the output.

## Deploy: Railway
One Docker container (NestJS serves the API, SSE and the built React app) + Railway Postgres, one project. The $5 one-time trial covers the event.

1. Repo owner (raeisya) creates the Railway project from `raeisya/desk-buddy` and invites the team.
2. Add PostgreSQL to the same project.
3. App service variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `DATABASE_SSL=false`, `RELEASE_CUTOFF=10:00`. Slack and LLM keys go here too, never in git.
4. Health check path `/api/health`; generate a public domain.
5. Check: `<domain>/api/health` returns `{"ok":true}` and the map loads.

**After the final deploy on Friday morning, turn off auto-deploy.** A push after 9:00 AM that triggers a deploy = disqualification.

## Task split
**Already done (foundation, commit `fb3b141`):** NestJS + 4 tables, React + Vite map from a 10-desk stub, derived desk state, live updates (SSE), demo clock + auto-release, Docker image. See the README.

**Folder ownership (avoids merge conflicts)**
| Person | Owns |
|---|---|
| **A**: deploy + Slack + AI + data | `apps/api/src/slack/`, `apps/api/src/parser/`, `apps/api/src/hod/`, history seed script, Railway |
| **B**: pixel office | `apps/web/src/` (except `theme/`, `pages/Login.tsx`, `hod/`), `apps/api/src/bookings/` |
| **C**: map art + theme + login + story | `apps/web/src/theme/`, `apps/web/src/pages/Login.tsx`, `apps/web/src/hod/`, `apps/api/src/seed/data/`, deck |
| Shared: announce before editing | `contracts.ts` (both copies), `app.module.ts` (one import line each) |

**Person A: deploy + Slack + AI + data**
| Time | Work |
|---|---|
| 11:00–12:00 | Deploy to Railway (app + Postgres). Live URL by 12:00 |
| 14:00–17:00 | Slack Socket Mode → LLM parser → `setPresence()` |
| 17:15–21:00 | 4 weeks of seeded history (script) + 50 Manglish test messages (AI-generated, C reviews). Tune the parser (→ "47/50"). HOD API endpoints (counts per team, 4-week heatmap) |
| 21:00–05:00 | Low-confidence DM, P2 injector, challenge backend |
| 05:00–08:30 | Final deploy, record the commit ID, turn off auto-deploy |

**Person B: pixel office (frontend)**
| Time | Work |
|---|---|
| 11:00–12:00 | Pixel renderer: background image + sprites at desk x/y, state markers, desk click panel |
| 14:00–17:00 | Avatar per user (sprite chosen from user id), "Away" bubble, free-desk glow. Use C's theme |
| 17:15–21:00 | Claim + check-in (backend + UI). Owns the challenge by default |
| 21:00–05:00 | Animation: walk to desk, typing loop, bubble when a Slack message lands (**4h cap**) |
| 05:00–08:30 | Fix what rehearsal finds |

**Person C: map art + theme + login + story**
| Time | Work |
|---|---|
| 11:00–12:00 | Pick a tileset and check its licence → **UI theme** (palette, pixel font, panel/button styles). Slack workspace + 4–5 demo accounts (tokens to A privately) |
| 14:00–16:00 | Office map image (~60 desks, 5–6 zones). `desks.json` in the image's pixel coordinates. 80 staff. **Rough version to B by 15:00** |
| 16:00–17:00 | **Login page** = persona picker ("Choose who you are today") + show-only "Sign in with Slack" button |
| 17:15–21:00 | Review A's test messages (10 min), then the HOD dashboard UI |
| 21:00–05:00 | Deck (capacity slide, Work + Serve roadmap), word-for-word demo script |
| 05:00–08:30 | Lead rehearsals, backup video, slides as PDF |

**Timeline (hour 0 = 9:00 AM Thursday)**
| Clock | Hour | What |
|---|---|---|
| 9:00 AM | 0 | Hacking starts; Hour 0 alignment |
| **12:00 PM** | 3 | **Live URL works.** If not, A spends the first half of lunch on it. |
| 12:00–2:00 PM | 3–5 | Lunch and prayer: **2h lost from the busiest block** |
| 5:00 PM | 8 | Checkpoint 1 (Slack post turns a desk green **on the deployed app**) · **Challenge drops** |
| 6:00 PM | 9 | Organisers' progress check-in |
| 9:00 PM | 12 | **Checkpoint 2:** full must-have journey works. Stop adding must-have work. |
| 9 PM–5 AM | 12–20 | Should-haves + challenge. Quiet hours from midnight. Sleep shifts (proposal): C 00:00–03:00 · A 02:00–05:00 · B 05:00–07:30 |
| **5:00 AM** | 20 | **Our code freeze.** Final deploy, note the commit ID. |
| 5:00–8:30 AM | 20–23.5 | Record backup video, export slides to PDF, rehearse ≥3× |
| **8:30 AM** | 23.5 | **Submit the form** (don't wait for 8:59) |
| 9:00 AM | 24 | Form closes. No commits or deploys after this. |
| 9:30 AM | — | Presentations, Level 2 Auditorium, Menara Gamuda |

**Challenge (5:00 PM):** all three read it together (15 min), decide what to build, then **B owns it by default** (B has the most spare time after Checkpoint 2). If it's backend-heavy, A builds the API and B builds the UI. Cap it at ~4h: it's worth 5%.

**Submission checklist:** team + project name · one-line description · live demo link · repo link + final commit ID · slides (PDF/PPTX) · 1–2 min backup video.

**Rebalance rules**
- If A hasn't got Slack→map working on the deployed URL by 17:00 → C pauses non-critical work and pairs with A.
- **C's map image is on the critical path.** If the rough map isn't with B by 15:00 → push the login page to after 21:00; B keeps a simple dropdown persona switcher until then. No map = no demo; no login page = demo still works.
- If C is behind at 21:00 → cut the HOD dashboard to today's counts + heatmap; B takes the heatmap UI. Never cut the demo script or rehearsals.
- B has spare time after 21:00 → take whatever is behind first; animation and the bot sprite only after that.

**Git:** everyone pushes to `main`. `git pull --rebase` before every push. Never push broken code: `main` auto-deploys. Semantic commit messages (`feat:`, `fix:`, `docs:`, `chore:`).

## Proposals
- **P1. Slack sign-in: decided.** Show-only button on the login page; real OAuth is roadmap.
- **P2. Add a hidden "inject message" endpoint/shortcut** (~30 min, A). It sends text through the same parse → presence → push path, skipping only Slack. If Slack or Wi-Fi fails on stage, the demo continues. Also: bring a phone hotspot and cache LLM responses for the scripted demo messages.
- **P3. HOD question box** (~2h, A). The HOD asks "who from Data is in on Thursday?" and the LLM answers from presence rows. A second AI feature for the 20% creativity score, reusing A's LLM setup.

## Answered (from the participant briefing)
- **Pre-work:** not allowed. Everything is built from 9:00 AM Thursday; repo's first commit is 09:15 Thursday.
- **Pitch:** 5 min presentation + 2 min Q&A, from our own laptop, demoing the submitted cloud version.
- **Additional Challenge:** revealed 5:00 PM Thursday. Likely responses if it's one of these:
  - Sustainability/ESG → zone consolidation: fill one zone first so empty zones can switch off lights and air-con ("Zone C empty 3 days/week → X kWh saved, illustrative").
  - Specific AI tool or API → swap it into the parser or HOD question box.
  - Mobile/accessibility → responsive map + one-tap "find me a seat". No native app.
  - Unrelated to our product → do the minimum and protect rehearsals.
