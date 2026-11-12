import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/*
 * EN / BM toggle. Scope: login page, title block and main nav only; the screens inside stay English.
 * Add a key to `en` first: TypeScript then requires the same key in `bm`.
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
}

export type StringKey = keyof typeof en

const bm: Record<StringKey, string> = {
  tagline: 'Setiap meja kosong, dimanfaatkan.',
  loginTitle: 'Siapa anda hari ini?',
  loginHint: 'Pilih persona demo',
  roleHod: 'Ketua',
  roleStaff: 'Staf',
  roleNewJoiner: 'Pekerja baharu',
  roleAdmin: 'Pentadbir',
  blurbHod: 'Lihat siapa di pejabat hari ini dan penggunaan ruang',
  blurbStaff: 'Hantar "wfh hari ni" di Slack, meja anda terus dikosongkan',
  blurbNewJoiner: 'Hari pertama, belum ada meja. Cari tempat kosong dekat pasukan anda',
  blurbAdmin: 'Urus staf: pasukan, peranan, siapa yang sudah berhenti',
  slackNote: 'Atau guna akaun Slack anda',
  slackFailed: 'Log masuk Slack gagal · pilih persona dahulu',
  slackButton: 'Log masuk dengan Slack',
  footerLeft: 'Persona demo · syarikat rekaan',
  footerRight: 'Dikemas kini terus dari Slack',
  navMap: 'Peta',
  navSeat: 'Cari tempat',
  navMe: 'Saya',
  navTeam: 'Pasukan',
  navStaff: 'Staf',
  desksInUse: 'Meja digunakan',
  project: 'Projek',
  today: 'Hari ini',
  loading: 'Memuatkan…',
  live: '● Langsung',
  offline: '○ Luar talian',
  logout: 'Log keluar',
}

export type Lang = 'en' | 'bm'
const STRINGS: Record<Lang, Record<StringKey, string>> = { en, bm }
const STORAGE_KEY = 'deskbuddy.lang'

function readSaved(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'bm' ? 'bm' : 'en'
  } catch {
    return 'en'
  }
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey) => string
}

const LangContext = createContext<LangState | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readSaved)

  useEffect(() => {
    document.documentElement.lang = lang === 'bm' ? 'ms' : 'en'
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* not remembered; fine for a demo */
    }
  }, [])

  const value = useMemo(() => ({ lang, setLang, t: (key: StringKey) => STRINGS[lang][key] }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}

/** EN | BM switch. */
export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(['en', 'bm'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? 'on' : undefined} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
