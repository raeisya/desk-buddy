import type { ReactElement } from 'react'

export type PhoneTab = 'map' | 'seat' | 'me'

const TABS: { id: PhoneTab; label: string; icon: ReactElement }[] = [
  {
    id: 'map',
    label: 'Map',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="16" height="16" />
        <path d="M3 11h16M11 3v16" />
      </svg>
    ),
  },
  {
    id: 'seat',
    label: 'Find seat',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="M15 15l4 4" />
      </svg>
    ),
  },
  {
    id: 'me',
    label: 'Me',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="7" r="4" />
        <path d="M3 20c1-4 4-6 8-6s7 2 8 6" />
      </svg>
    ),
  },
]

/** Phone-only bottom navigation (C): Map · Find seat · Me. */
export function BottomNav({ tab, onTab }: { tab: PhoneTab; onTab: (tab: PhoneTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => (
        <button key={t.id} type="button" aria-current={t.id === tab ? 'page' : undefined} onClick={() => onTab(t.id)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}
