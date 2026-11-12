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
// All people are fictional except the three team members (Alia, Shane, Raeisya; by consent).
// Do not add other real staff. Emails stay @acme.example; Slack is linked by slackId only.

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
  Platform: {
    code: 'P',
    desks: 12,
    people: [
      // Alia, Shane and Raeisya are the team (real first names, by consent). Everyone else is fictional.
      ['u-alia', 'Alia', 'hod'],
      ['u-hafiz', 'Hafiz Rahim'],
      ['u-meiling', 'Tan Mei Ling'],
      ['u-arjun', 'Arjun Pillai'],
      ['u-shane', 'Shane'],
      ['u-raeisya', 'Raeisya'],
      ['u-izzati', 'Nurul Izzati Hassan'],
      ['u-kahwai', 'Chong Kah Wai'],
      ['u-ravi', 'Ravi Shankar'],
      ['u-amirul', 'Amirul Hakim Salleh'],
      ['u-jiahui', 'Ong Jia Hui'],
      ['u-haziq', 'Haziq Firdaus'],
      ['u-aina', 'Aina Zulkifli'], // new joiner: no desk yet
      ['u-danial', 'Danial Hakim'],
      ['u-aisyah', 'Siti Aisyah Kamal'],
      ['u-zhihao', 'Yap Zhi Hao'],
    ],
  },
  Data: {
    code: 'D',
    desks: 10,
    people: [
      ['u-farah', 'Farah Hanim', 'hod'],
      ['u-weijie', 'Lim Wei Jie'],
      ['u-syafiq', 'Syafiq Azman'],
      ['u-priya', 'Priya Menon'],
      ['u-peishan', 'Goh Pei Shan'],
      ['u-irfanyusof', 'Muhammad Irfan Yusof'],
      ['u-lavanya', 'Lavanya Subramaniam'],
      ['u-karhoe', 'Wong Kar Hoe'],
      ['u-nadia', 'Nadia Iskandar'],
      ['u-zulhilmi', 'Zulhilmi Osman'],
      ['u-kavitha', 'Kavitha Rao'],
      ['u-xinyi', 'Teoh Xin Yi'],
      ['u-adam', 'Adam Harith'],
      ['u-shalini', 'Shalini Devi'],
    ],
  },
  Mobile: {
    code: 'M',
    desks: 10,
    people: [
      ['u-khairul', 'Khairul Anuar Ismail', 'hod'],
      ['u-wailing', 'Chan Wai Ling'],
      ['u-sanjay', 'Sanjay Ramesh'],
      ['u-aqilah', 'Aqilah Mansor'],
      ['u-junhao', 'Lee Jun Hao'],
      ['u-hanisofea', 'Hani Sofea Razak'],
      ['u-viknes', 'Vikneswaran Muthu'],
      ['u-shuqi', 'Ng Shu Qi'],
      ['u-faiz', 'Faiz Aiman Roslan'],
      ['u-yiting', 'Cheah Yi Ting'],
      ['u-irfandanish', 'Irfan Danish'],
      ['u-kaixiang', 'Low Kai Xiang'],
      ['u-mira', 'Mira Elisya'],
      ['u-prakash', 'Prakash Gopal'],
    ],
  },
  'Product & Design': {
    code: 'R',
    desks: 8,
    people: [
      ['u-jessica', 'Jessica Tan Hui Min', 'hod'],
      ['u-azlan', 'Azlan Shah Mokhtar'],
      ['u-revathi', 'Revathi Krishnan'],
      ['u-wenjie', 'Ho Wen Jie'],
      ['u-balqis', 'Balqis Amani'],
      ['u-danielfoo', 'Daniel Foo'],
      ['u-syazwani', 'Syazwani Rosli'],
      ['u-gerard', 'Gerard Anthony'],
      ['u-liyana', 'Liyana Zahari'],
      ['u-cheekeong', 'Tey Chee Keong'],
      ['u-anis', 'Anis Sabrina'],
      ['u-joshua', 'Joshua Raj'],
    ],
  },
  QA: {
    code: 'Q',
    desks: 7,
    people: [
      ['u-rajesh', 'Rajesh Varma', 'hod'],
      ['u-hidayah', 'Nur Hidayah Abdullah'],
      ['u-munyee', 'Kwan Mun Yee'],
      ['u-firdaus', 'Firdaus Jamil'],
      ['u-sharmila', 'Sharmila Selvam'],
      ['u-boonhuat', 'Tan Boon Huat'],
      ['u-amira', 'Amira Natasha'],
      ['u-hakimi', 'Hakimi Zainal'],
      ['u-eunice', 'Eunice Yeoh'],
      ['u-ashwin', 'Ashwin Menon'],
      ['u-fatin', 'Fatin Nabila'],
      ['u-kaming', 'Leong Ka Ming'],
    ],
  },
  Corporate: {
    code: 'C',
    desks: 7,
    people: [
      ['u-rosnah', 'Rosnah Ahmad', 'hod'],
      ['u-melissa', 'Melissa Chin', 'admin'],
      ['u-zainab', 'Zainab Hussin'],
      ['u-suresh', 'Suresh Naidu'],
      ['u-siewlan', 'Koh Siew Lan'],
      ['u-ikhwan', 'Ikhwan Hafizi'],
      ['u-grace', 'Grace Thong'],
      ['u-najwa', 'Najwa Insyirah'],
      ['u-cheeseng', 'Lim Chee Seng'],
      ['u-vanessa', 'Vanessa Pereira'],
      ['u-akmal', 'Akmal Rizal'],
      ['u-puvanes', 'Puvanes Rajan'],
    ],
  },
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
    users.push({ id, name, email: `${id.slice(2)}@acme.example`, team, role, slackId: null });
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
