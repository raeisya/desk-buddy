import type { ReactElement } from 'react'

export type AppTab = 'map' | 'seat' | 'me' | 'team'

const TABS: { id: AppTab; label: string; icon: ReactElement }[] = [
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
  {
    id: 'team',
    label: 'Team',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 19V11M8 19V5M13 19V9M18 19V13" />
      </svg>
    ),
  },
]

/**
 * Main navigation (C): Map · Find seat · Me, plus Team for HODs.
 * Phone: fixed bar at the bottom (thumb reach). Desktop: sidebar left of the content.
 */
export function AppNav({
  tab,
  onTab,
  placement,
  showTeam = false,
}: {
  tab: AppTab
  onTab: (tab: AppTab) => void
  placement: 'side' | 'bottom'
  /** HODs only: the team dashboard. */
  showTeam?: boolean
}) {
  return (
    <nav className={`app-nav app-nav--${placement}`} aria-label="Main">
      {TABS.filter((t) => showTeam || t.id !== 'team').map((t) => (
        <button key={t.id} type="button" aria-current={t.id === tab ? 'page' : undefined} onClick={() => onTab(t.id)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  )
}
