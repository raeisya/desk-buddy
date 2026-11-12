import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/*
 * EN / Manglish toggle (shown as EN | MY). Scope: login page, title block, nav, map, desk panel, Find seat
 * and Me; Team and Staff stay English. Add a key to `en` first: TypeScript then requires the same key in `my`.
 * `{name}` in a string is a placeholder: t('freeCount', { n: 3 }).
 */

const en = {
  tagline: 'Every empty desk, put to work.',
  loginTitle: 'Who are you today?',
  loginHint: 'Pick a demo persona',
  roleHod: 'HOD',
  roleStaff: 'Staff',
  roleNewJoiner: 'New joiner',
  roleAdmin: 'Admin',
  blurbHod: "See who's in today and how the floor is used",
  blurbStaff: 'Post "wfh today" in Slack and your desk frees itself',
  blurbNewJoiner: 'Day one, no desk yet. Find a free seat near your team',
  blurbAdmin: 'Manage staff: teams, roles, who has left',
  slackNote: 'Or use your Slack account',
  slackFailed: 'Slack sign-in failed · pick a persona for now',
  slackButton: 'Sign in with Slack',
  footerLeft: 'Demo personas · fictional company',
  footerRight: 'Updated live from Slack',
  navMap: 'Map',
  navSeat: 'Find seat',
  navMe: 'Me',
  navTeam: 'Team',
  navStaff: 'Staff',
  desksInUse: 'Desks in use',
  project: 'Project',
  today: 'Today',
  loading: 'Loading…',
  live: '● Live',
  offline: '○ Offline',
  logout: 'Log out',
  floorTitle: 'Floor 12',
  desksCount: '{n} desks',
  freeCount: '{n} free',
  noDeskCount: ' · {n} staff without a desk',
  freeInZone: 'Free in {zone}',
  noFreeInZone: 'No free desks here right now. Try another zone.',
  ownerAwayDesk: "{name}'s desk · away today",
  hotDesk: 'Hot desk',
  view: 'View ▶',
  pickDesk: 'Pick a desk',
  pickDeskBody: "Green desks are free today: their owners said in Slack that they're out.",
  pickDeskTap: 'Tap one to see whose it is and take it.',
  footerScale: 'Scale 1:100 · Rev B · Drawn by DeskBuddy',
  footerSlack: "Desks free up when their owners say they're out in Slack",
  legendAvailable: 'Available',
  legendHot: 'Hot-seated',
  findSeatNear: 'Find me a seat near {team}',
  panelStatus: 'Status',
  panelZone: 'Zone',
  panelOwner: 'Owner',
  panelSitting: 'Sitting here today',
  unassigned: 'Unassigned',
  nobody: 'Nobody',
  takeDesk: 'Take this desk',
  taking: 'Taking…',
  leaveDesk: 'Leave desk',
  leaving: 'Leaving…',
  atOwnDesk: "You're at your desk today. Out today (WFH, MC, leave)?",
  setMyStatus: 'Set my status',
  pickWhoFirst: 'Pick who you are to take a desk.',
  state_available: 'Available',
  state_unassigned: 'Free (unassigned)',
  'state_hot-seated': 'Hot-seated',
  state_away: 'Owner not in yet',
  state_occupied: 'Occupied',
  alreadyAt: "You're already at {desk} today.",
  noFreeNow: 'No free desks right now.',
  ownFree: 'Your own desk {desk} is free. Take it back.',
  noTeamDesks: "No {team} desks on this floor, so here's a free one.",
  noneIn: "None of {team} is in yet. This is the closest free desk to your team's desks.",
  nearTeam: 'Closest free desk to {team}: {who} within a few desks.',
  oneMate: '1 teammate',
  manyMates: '{n} teammates',
  nearToday: 'Closest free desk to where {team} is sitting today.',
  meTitle: "Today you're",
  st_IN_OFFICE: 'In office',
  st_WFH: 'WFH',
  st_MC: 'MC',
  st_LEAVE: 'Leave',
  st_OUTSTATION: 'Outstation',
  away: 'Away',
  noDeskYet: 'No desk yet',
  meDeskOutTail: ' is free for others today. Colleagues just see "Away".',
  meDeskInHead: 'Your desk ',
  meDeskInTail: ' ({zone}) shows as yours today.',
  meSittingHead: "You're at ",
  meSittingTail: ' today ({zone}).',
  meNoDesk: 'No desk of your own yet. Take a free one near your team.',
  findSeatBtn: 'Find seat ▶',
  notRight: 'Not right? Tap to fix',
  saving: 'Saving…',
  saved: 'Saved. The map has been updated.',
  savedSlack: 'Saved. The map and your Slack status are updated.',
  slackTipHead: "Easier still: post in your team's Slack channel, e.g. ",
  slackTipTail: ', or set your Slack status. DeskBuddy reads both.',
  syncOn: '✓ Synced: changing your status here updates your Slack status too.',
  syncAsk: 'Want your Slack status to follow DeskBuddy?',
  syncBtn: 'Connect Slack',
  syncErr: "Couldn't connect Slack. Sign in with your linked Slack account and try again.",
  syncOk: 'Slack connected.',
  sortedTitle: "You're sorted for today",
  sortedNote: 'Your desk is held for today. Leave it if your plans change so someone else can sit.',
  deskN: 'Desk {desk}',
  yoursToday: 'Yours today',
  seeYou: '{zone}. See you there.',
  showOnMap: 'Show on map',
  leaveThisDesk: 'Leave this desk',
  noFreeTitle: 'No free desks right now',
  noFreeNote: "Desks free up when their owners post in Slack that they're out. This page updates live.",
  bestTitle: 'Best seat for you',
  bestNote: 'Free desks closest to the {team} team.',
  bestMatch: 'Best match',
  freeToday: 'Free today',
  isAway: '{name} is away today',
  hotNoOwner: 'Hot desk, no owner',
  takeN: 'Take {desk} ▶',
  seeFullMap: 'See on full map',
  optionsNear: 'Options near your team',
  showing: 'Showing',
}

export type StringKey = keyof typeof en

const my: Record<StringKey, string> = {
  tagline: "Desk kosong? Don't waste lah, pakai je.",
  loginTitle: 'Eh, who are you today ah?',
  loginHint: 'Pick one lah',
  roleHod: 'HOD',
  roleStaff: 'Staff',
  roleNewJoiner: 'New joiner',
  roleAdmin: 'Admin',
  blurbHod: "Wanna see who's in today, how packed the office? Here lah",
  blurbStaff: 'Post "wfh today" in Slack, your desk confirm free up by itself one',
  blurbNewJoiner: 'First day, no desk yet. Jom find seat near your geng',
  blurbAdmin: 'Settle staff stuff: team, role, who already cabut',
  slackNote: 'Or just use your Slack lah, senang',
  slackFailed: 'Alamak, Slack cannot lah · pick persona first',
  slackButton: 'Sign in with Slack',
  footerLeft: 'Demo personas · company also fake one',
  footerRight: 'Live from Slack, no need refresh lah',
  navMap: 'Map',
  navSeat: 'Cari seat',
  navMe: 'Me',
  navTeam: 'Geng',
  navStaff: 'Staff',
  desksInUse: 'Desks kena chop',
  project: 'Project',
  today: 'Today',
  loading: 'Wait ah…',
  live: '● Live',
  offline: '○ Offline',
  logout: 'Chau lah',
  floorTitle: 'Floor 12',
  desksCount: '{n} desks',
  freeCount: '{n} kosong',
  noDeskCount: ' · {n} people no desk yet',
  freeInZone: 'Kosong in {zone}',
  noFreeInZone: 'Here all full already. Try other zone lah.',
  ownerAwayDesk: "{name}'s desk · not around today",
  hotDesk: 'Hot desk',
  view: 'Tengok ▶',
  pickDesk: 'Pick one desk',
  pickDeskBody: 'Green one means free today: the owner already say in Slack they not coming.',
  pickDeskTap: 'Tap to see whose, then chop it.',
  footerScale: 'Scale 1:100 · Rev B · DeskBuddy drew one',
  footerSlack: 'Owner say out in Slack, desk free up automatic',
  legendAvailable: 'Free',
  legendHot: 'Tumpang',
  findSeatNear: 'Find me seat near {team} lah',
  panelStatus: 'Status',
  panelZone: 'Zone',
  panelOwner: 'Owner',
  panelSitting: 'Who sit here today',
  unassigned: 'No owner',
  nobody: 'Nobody lah',
  takeDesk: 'Chop this desk',
  taking: 'Chopping…',
  leaveDesk: 'Cabut from desk',
  leaving: 'Cabut-ing…',
  atOwnDesk: 'You at your desk today. Today out ah (WFH, MC, cuti)?',
  setMyStatus: 'Set my status',
  pickWhoFirst: 'Pick who you are first, then can chop desk.',
  state_available: 'Free',
  state_unassigned: 'Free (no owner)',
  'state_hot-seated': 'Tumpang',
  state_away: 'Owner not here yet',
  state_occupied: 'Got people',
  alreadyAt: 'You already at {desk} today lah.',
  noFreeNow: 'Alamak, no desk free now.',
  ownFree: 'Your own desk {desk} still free. Take back lah.',
  noTeamDesks: 'No {team} desk on this floor, so take this free one lah.',
  noneIn: '{team} geng all not in yet. This one closest to your team desks.',
  nearTeam: 'Closest free desk to {team}: {who} sitting nearby only.',
  oneMate: '1 kaki',
  manyMates: '{n} kaki',
  nearToday: 'Closest free desk to where {team} sitting today.',
  meTitle: 'Today you',
  st_IN_OFFICE: 'In office',
  st_WFH: 'WFH',
  st_MC: 'MC',
  st_LEAVE: 'Cuti',
  st_OUTSTATION: 'Outstation',
  away: 'Away',
  noDeskYet: 'No desk yet lah',
  meDeskOutTail: ' free for others today. Your geng only see "Away".',
  meDeskInHead: 'Your desk ',
  meDeskInTail: ' ({zone}) still yours today.',
  meSittingHead: 'You at ',
  meSittingTail: ' today ({zone}).',
  meNoDesk: 'Still no own desk. Chop a free one near your geng lah.',
  findSeatBtn: 'Cari seat ▶',
  notRight: 'Salah ah? Tap to fix',
  saving: 'Saving ah…',
  saved: 'Done! Map also updated already.',
  savedSlack: 'Done! Map and your Slack status also updated already.',
  slackTipHead: 'More senang: just post in your team Slack, like ',
  slackTipTail: ', or set your Slack status. DeskBuddy will read both one.',
  syncOn: '✓ Synced: change status here, your Slack status also follow.',
  syncAsk: 'Want your Slack status follow DeskBuddy ah?',
  syncBtn: 'Connect Slack',
  syncErr: 'Cannot connect Slack leh. Sign in with your linked Slack account then try again.',
  syncOk: 'Slack connected already.',
  sortedTitle: 'Settle already for today',
  sortedNote: 'Your desk kept for today. Plan change, leave it so others can sit.',
  deskN: 'Desk {desk}',
  yoursToday: 'Yours today',
  seeYou: '{zone}. See you there ya.',
  showOnMap: 'Show on map',
  leaveThisDesk: 'Cabut from this desk',
  noFreeTitle: 'Alamak, all desk full',
  noFreeNote: "When owners post in Slack they're out, desk free up. This page update live one.",
  bestTitle: 'Best seat for you lah',
  bestNote: 'Free desks closest to {team} geng.',
  bestMatch: 'Best match',
  freeToday: 'Free today',
  isAway: '{name} not around today',
  hotNoOwner: 'Hot desk, no owner',
  takeN: 'Chop {desk} ▶',
  seeFullMap: 'See full map',
  optionsNear: 'Other options near your geng',
  showing: 'Showing',
}

export type Lang = 'en' | 'my'
const STRINGS: Record<Lang, Record<StringKey, string>> = { en, my }
const STORAGE_KEY = 'deskbuddy.lang'

function readSaved(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'my' || saved === 'bm' ? 'my' : 'en' // 'bm' = the old BM toggle
  } catch {
    return 'en'
  }
}

type Vars = Record<string, string | number>

/** Look up `key` in `lang` and fill `{name}` placeholders. Usable outside components (e.g. seat notes). */
export function translate(lang: Lang, key: StringKey, vars?: Vars): string {
  const text = STRINGS[lang][key]
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey, vars?: Vars) => string
}

const LangContext = createContext<LangState | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readSaved)

  useEffect(() => {
    document.documentElement.lang = lang === 'my' ? 'en-MY' : 'en' // Manglish is Malaysian English
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* not remembered; fine for a demo */
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang, t: (key: StringKey, vars?: Vars) => translate(lang, key, vars) }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}

/** EN | MY (Manglish) switch. */
export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(['en', 'my'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} title={l === 'my' ? 'Manglish' : 'English'} className={lang === l ? 'on' : undefined} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
