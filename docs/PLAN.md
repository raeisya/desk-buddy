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
- **Must be cloud-hosted.** Localhost, mock-ups and Figma are not accepted. Socket Mode needs an always-on process, so use a host that doesn't sleep (no free tier that idles; Cloud Run only with min instances = 1) plus managed Postgres. **Deploy the empty skeleton before lunch and redeploy continuously.**
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
- Avatar animation is fun but scores almost nothing: **cap at 2 hours.**
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
- Measured against C's 50 Manglish test messages → a "47/50 parsed correctly" slide.

## Scope
**Must (the demo):**
1. Demo persona switcher (Owner / Junior / HOD)
2. Fictional floor rendered as SVG from `desks.json` (no floor editor)
3. Slack channel listener → LLM parse → presence row
4. Map updates **live** (SSE/websocket) when a Slack message arrives
5. Claim + check in to a free desk
6. HOD dashboard: today's counts per team + 4-week occupancy heatmap (seeded)

**Should (only after the must-haves work end to end):**
- Auto-release with a fast-forward demo clock (our answer to the stale-status question)
- Nearest-desk-to-team suggestion
- Low-confidence Slack DM
- Avatar animation
- Slack sign-in (see P1)

**Won't (mention in the pitch as roadmap):** floor editor, multi-floor, HRMS integration, mobile app, per-person WFH tracking.

**Capacity forecast** is a slide, not a feature: "Seats run out in N months; hot-seating pushes it to M months."

## Data model (4 tables)
| Table | Columns |
|---|---|
| `users` | slack_id, email, name, team, role (staff/hod/admin), home_desk_id |
| `desks` | id, x, y, w, h, zone, owner_id |
| `presence` | user_id, date, status, source, raw_message, confidence |
| `bookings` | desk_id, user_id, date, checked_in_at, released_at |

Desk states: `occupied | available | hot-seated | away | unassigned`

## Pitch: 5 min presentation + 2 min Q&A
~2.5 min problem/value/capacity slide + ~2.5 min live demo.

**Demo journey (~2.5 min)**
1. Owner posts "wfh today" in Slack.
2. AI parses it → the owner's desk turns green live.
3. Junior asks for a seat near their team → DeskBuddy suggests that desk.
4. Junior checks in; avatar sits.
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

## Task split
**Hour 0 (all, ~1h):** agree JSON shapes (`desks.json`, `users.json`, `presence.json`), API response shapes and the 5 desk states. C hands B a 10-desk stub JSON within 30 min.

**Person A: backend + Slack + AI**
| Hours | Work |
|---|---|
| 0–2 | NestJS setup, 4 tables, Slack app from manifest, Socket Mode, **deploy backend + managed Postgres** |
| 2–6 | Listener → LLM parse → presence → live push |
| **6** | **Checkpoint 1:** a Slack post turns a desk green on B's map |
| 6–10 | Claim/check-in API, derived desk state |
| 10–12 | Dashboard endpoints for C |
| 12–17 | Should-haves (auto-release + demo clock, nearest desk, DM confirm) |

**Person B: frontend map**
| Hours | Work |
|---|---|
| 0–2 | React + Vite, render desks from stub as SVG, **deploy frontend** |
| 2–6 | State colours, desk detail panel, persona switcher, live updates |
| 6–10 | Claim/check-in flow, full floor from C's JSON |
| 10–12 | Polish (legend, empty/error states, transitions) |
| 12–16 | Demo clock control, avatar animation (2h max) |
| 16–18 | Rehearsal fixes |

**Person C: dummy data + dashboard + story**
| Hours | Work |
|---|---|
| 0–0.5 | 10-desk stub for B |
| 0.5–4 | Fictional floor (~60 desks, 5–6 team zones, rooms), 80 staff, 4 weeks of history with patterns |
| 4–5 | ~50 Manglish test messages for A's parser |
| 5–11 | HOD dashboard |
| 11–14 | Pitch deck (problem, demo, capacity slide, roadmap) |
| 14–18 | Word-for-word demo script, incl. which Slack account posts what, when |
| 18+ | Lead rehearsals, record backup video |

**Timeline (hour 0 = 9:00 AM Thursday)**
| Clock | Hour | What |
|---|---|---|
| 9:00 AM | 0 | Hacking starts; Hour 0 alignment |
| ~11:30 AM | 2.5 | Skeleton (frontend + backend + DB) deployed to the cloud |
| 12:00–2:00 PM | 3–5 | Lunch and prayer: **2h lost from the busiest block** |
| 5:00 PM | 8 | Checkpoint 1 (Slack post turns a desk green **on the deployed app**) · **Challenge drops** |
| 6:00 PM | 9 | Organisers' progress check-in |
| 9:00 PM | 12 | **Checkpoint 2:** full must-have journey works. Stop adding must-have work. |
| 9 PM–5 AM | 12–20 | Should-haves + challenge. Sleep in shifts (≥3h each). Quiet hours from midnight. |
| **5:00 AM** | 20 | **Our code freeze.** Final deploy, note the commit ID. |
| 5:00–8:30 AM | 20–23.5 | Record backup video, export slides to PDF, rehearse ≥3× |
| **8:30 AM** | 23.5 | **Submit the form** (don't wait for 8:59) |
| 9:00 AM | 24 | Form closes. No commits or deploys after this. |
| 9:30 AM | — | Presentations, Level 2 Auditorium, Menara Gamuda |

**Challenge (5:00 PM):** all three read it together (15 min), decide what to build, then **B owns it by default** (B has the most spare time after Checkpoint 2). If it's backend-heavy, A builds the API and B builds the UI. Cap it at ~4h: it's worth 5%.

**Submission checklist:** team + project name · one-line description · live demo link · repo link + final commit ID · slides (PDF/PPTX) · 1–2 min backup video.

**Rebalance rules**
- If A hasn't got Slack→map working by hour 6 → C pauses the deck and pairs with A.
- If C falls behind → cut the dashboard to today's counts + heatmap. Never cut the demo script or rehearsals.
- B has spare time after hour 12 → take whatever is behind first; avatar animation only after that.

## Proposals (not yet agreed — decide at Hour 0)
- **P1. Slack sign-in moves from must-have to should-have.** Code isn't reviewed and the persona switcher already acts as sign-in for the demo. OAuth setup costs A 1–2 hours for ~0 points. Say "Slack SSO" in the pitch.
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
