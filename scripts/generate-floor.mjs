#!/usr/bin/env node
// Generates the fictional Acme Tech floor: apps/api/src/seed/data/{users,desks,presence-today}.json
// Run: node scripts/generate-floor.mjs   (deterministic — same output every run)
//
// Map geometry (the map image must match this):
//   Image 1280×768 px = 40×24 tiles of 32 px. Desk coords are image pixels (top-left).
//   6 zones, each one pod of 10 desks: 5 across × 2 rows, back-to-back.
//   Each desk cell is 64×64 (2×2 tiles: desk + chair). Pods are face-to-face: the two desk rows meet in
//   the middle, chairs on the outside. Row 0 facing 'down' (chair top half, desk bottom half),
//   row 1 facing 'up' (desk top half, chair bottom half).
//   Zone A/B/C pods at y=160, D/E/F at y=480; pods at x=96, 480, 864. Corridor y=288..480.
// Names: first names of real colleagues (team decision, first name only) plus fictional fillers so the
// floor keeps 80 staff. Hafiz, Aina and Mei Ling are demo accounts. Seeded presence history (incl. MC/leave)
// is random and fictional, not anyone's real record. Emails stay @acme.example; Slack is linked by slackId only.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api', 'src', 'seed', 'data');

const TILE = 32;
const DESK = 2 * TILE; // 64
const POD_X = [96, 480, 864];
const POD_Y = [160, 480];
export const MAP = { width: 1280, height: 768, tile: TILE };

// ── People ───────────────────────────────────────────────────────────────────
// Per team: [id, name, role?]. Order matters: the first `desks` people own a desk, the rest don't.
// IDs of the original 10 stub users are kept (README examples + Slack mapping depend on them).
const TEAMS = {
  CityOS: {
    code: 'P',
    desks: 12,
    people: [
      // Alia, Shane and Raeisya are the team (linked to real Slack accounts).
      ['u-alia', 'Alia', 'hod'],
      ['u-hafiz', 'Hafiz Rahim'],
      ['u-meiling', 'Tan Mei Ling'],
      ['u-arjun', 'Zaid'],
      ['u-shane', 'Shane'],
      ['u-raeisya', 'Raeisya'],
      ['u-izzati', 'Farzana'],
      ['u-kahwai', 'James'],
      ['u-ravi', 'Iqhwan'],
      ['u-amirul', 'Pavitra'],
      ['u-jiahui', 'Ze Xin'],
      ['u-haziq', 'Haziq'],
      ['u-aina', 'Aina Zulkifli'], // new joiner: no desk yet
      ['u-danial', 'Danial'],
      ['u-aisyah', 'Aisyah'],
      ['u-zhihao', 'Zhi Hao'],
    ],
  },
  SpatialQ: {
    code: 'D',
    desks: 10,
    people: [
      ['u-farah', 'Farah', 'hod'],
      ['u-weijie', 'Afiq'],
      ['u-syafiq', 'Jia Jiat'],
      ['u-priya', 'Jeremy'],
      ['u-peishan', 'Luqman'],
      ['u-irfanyusof', 'Irfan'],
      ['u-lavanya', 'Rizal'],
      ['u-karhoe', 'Nazmir'],
      ['u-nadia', 'Nadia'],
      ['u-zulhilmi', 'Zulhilmi'],
      ['u-kavitha', 'Kavitha'],
      ['u-xinyi', 'Xin Yi'],
      ['u-adam', 'Adam'],
      ['u-shalini', 'Shalini'],
    ],
  },
  ModelChecker: {
    code: 'M',
    desks: 10,
    people: [
      ['u-khairul', 'Chi Keen', 'hod'],
      ['u-wailing', 'Darren'],
      ['u-sanjay', 'Harini'],
      ['u-aqilah', 'Lana'],
      ['u-junhao', 'Arieq'],
      ['u-hanisofea', 'Ryan'],
      ['u-viknes', 'Vikneswaran'],
      ['u-shuqi', 'Shu Qi'],
      ['u-faiz', 'Faiz'],
      ['u-yiting', 'Yi Ting'],
      ['u-irfandanish', 'Danish'],
      ['u-kaixiang', 'Kai Xiang'],
      ['u-mira', 'Mira'],
      ['u-prakash', 'Prakash'],
    ],
  },
  Product: {
    code: 'R',
    desks: 8,
    people: [
      ['u-jessica', 'Wei Fan', 'hod'],
      ['u-azlan', 'David'],
      ['u-revathi', 'Ming Wei'],
      ['u-wenjie', 'Hwea Yee'],
      ['u-balqis', 'Safrina'],
      ['u-danielfoo', 'Izzuddin'],
      ['u-syazwani', 'Syazwani'],
      ['u-gerard', 'Gerard'],
      ['u-liyana', 'Liyana'],
      ['u-cheekeong', 'Chee Keong'],
      ['u-anis', 'Anis'],
      ['u-joshua', 'Joshua'],
    ],
  },
  DevOps: {
    code: 'Q',
    desks: 7,
    people: [
      ['u-rajesh', 'Deshika', 'hod'],
      ['u-hidayah', 'Zhi Cern'],
      ['u-munyee', 'Xin Yan'],
      ['u-firdaus', 'Syaffa'],
      ['u-sharmila', 'Wei Ching'],
      ['u-boonhuat', 'Boon Huat'],
      ['u-amira', 'Amira'],
      ['u-hakimi', 'Hakimi'],
      ['u-eunice', 'Eunice'],
      ['u-ashwin', 'Ashwin'],
      ['u-fatin', 'Fatin'],
      ['u-kaming', 'Ka Ming'],
    ],
  },
  'Business Development': {
    code: 'C',
    desks: 7,
    people: [
      ['u-rosnah', 'Farhan', 'hod'],
      ['u-melissa', 'Isaac', 'admin'],
      ['u-zainab', 'Song Ze'],
      ['u-suresh', 'Omar'],
      ['u-siewlan', 'Weng Yeow'],
      ['u-ikhwan', 'Ikhwan'],
      ['u-grace', 'Grace'],
      ['u-najwa', 'Najwa'],
      ['u-cheeseng', 'Chee Seng'],
      ['u-vanessa', 'Vanessa'],
      ['u-akmal', 'Akmal'],
      ['u-puvanes', 'Puvanes'],
    ],
  },
};

// Slack member IDs of the demo accounts in our test workspace (not secrets; they only identify an account).
// The Slack listener maps an incoming message to a person via users.slack_id.
const SLACK_IDS = {
  'u-hafiz': 'U0CGL2XK3HD',
  'u-meiling': 'U0CHVR40NE4',
  'u-alia': 'U0CGJGKR4BZ',
  'u-shane': 'U0CH3K0HXV2',
  'u-raeisya': 'U0CGTKZ981Z',
};

// ── Floor ────────────────────────────────────────────────────────────────────
// Which team owns each seat, per pod: row 0 (5 seats) then row 1 (5 seats). '-' = unassigned hot desk.
// Seats went first-come, so teams spill into each other's zones. Data is always split (Zone B + Zone E).
const ZONES = [
  { name: 'Zone A', seats: 'PPPPP PPPPP' },
  { name: 'Zone B', seats: 'DDPD- DMDP-' },
  { name: 'Zone C', seats: 'MMMMM MMQMM' },
  { name: 'Zone D', seats: 'RRRRC RRRR-' },
  { name: 'Zone E', seats: 'DDDQQ DDQQ-' },
  { name: 'Zone F', seats: 'CCCQ- CCCQ-' },
];

// Today's presence. Demo characters are pinned; everyone else is drawn from a seeded distribution.
// Missing from the file = hasn't posted yet (desk shows "away" until the release cutoff).
const PINNED_PRESENCE = {
  'u-alia': 'IN_OFFICE', // HOD persona
  'u-hafiz': null, // demo owner: silent at start, posts "wfh today" live
  'u-arjun': null, // no-show owner: auto-released when the demo clock passes 10:00
  'u-meiling': 'IN_OFFICE',
  'u-shane': 'IN_OFFICE',
  'u-raeisya': 'IN_OFFICE',
  'u-aina': 'IN_OFFICE', // new joiner persona: no desk, claims the freed one near her team
  'u-farah': 'IN_OFFICE',
  'u-syafiq': 'MC',
};
const DISTRIBUTION = [
  ['IN_OFFICE', 0.55],
  ['WFH', 0.2],
  ['OUTSTATION', 0.04],
  ['LEAVE', 0.04],
  ['MC', 0.03],
  [null, 0.14], // silent
];

// ── Build ────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const users = [];
const queueByCode = {};
for (const [team, t] of Object.entries(TEAMS)) {
  const holders = [];
  t.people.forEach(([id, name, role = 'staff'], i) => {
    users.push({ id, name, email: `${id.slice(2)}@acme.example`, team, role, slackId: SLACK_IDS[id] ?? null });
    if (i < t.desks) holders.push(id);
  });
  queueByCode[t.code] = holders;
}

const desks = [];
ZONES.forEach((zone, z) => {
  const px = POD_X[z % 3];
  const py = POD_Y[Math.floor(z / 3)];
  const seats = zone.seats.replace(/\s/g, '');
  if (seats.length !== 10) throw new Error(`${zone.name}: expected 10 seats, got ${seats.length}`);
  [...seats].forEach((code, s) => {
    const row = Math.floor(s / 5);
    const col = s % 5;
    let ownerId = null;
    if (code !== '-') {
      ownerId = queueByCode[code]?.shift();
      if (!ownerId) throw new Error(`${zone.name}: team ${code} has more seats than desk holders`);
    }
    desks.push({
      id: `D-${String(desks.length + 1).padStart(2, '0')}`,
      x: px + col * DESK,
      y: py + row * DESK,
      w: DESK,
      h: DESK,
      zone: zone.name,
      facing: row === 0 ? 'down' : 'up',
      ownerId,
    });
  });
});
for (const id of Object.keys(SLACK_IDS)) {
  if (!users.some((u) => u.id === id)) throw new Error(`SLACK_IDS: unknown user ${id}`);
}
for (const [code, left] of Object.entries(queueByCode)) {
  if (left.length) throw new Error(`Team ${code}: ${left.length} desk holders without a seat (${left.join(', ')})`);
}

const rand = mulberry32(42);
const presence = [];
for (const u of users) {
  let status;
  if (u.id in PINNED_PRESENCE) status = PINNED_PRESENCE[u.id];
  else {
    let r = rand();
    status = DISTRIBUTION.find(([, p]) => (r -= p) < 0)?.[0] ?? null;
  }
  if (status) presence.push({ userId: u.id, status });
}

// One object per line keeps diffs readable.
const toJson = (rows) => `[\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`;
writeFileSync(join(OUT, 'users.json'), toJson(users));
writeFileSync(join(OUT, 'desks.json'), toJson(desks));
writeFileSync(join(OUT, 'presence-today.json'), toJson(presence));

const owned = desks.filter((d) => d.ownerId).length;
console.log(`users ${users.length} · desks ${desks.length} (${owned} owned, ${desks.length - owned} unassigned) · presence rows ${presence.length}`);
console.log(`staff without a desk: ${users.length - owned}`);
