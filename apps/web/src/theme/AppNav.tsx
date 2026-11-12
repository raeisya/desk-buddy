import type { ReactElement } from 'react'
import type { Role } from '../api/contracts'
import { useLang, type StringKey } from '../i18n/lang'

export type AppTab = 'map' | 'seat' | 'me' | 'team' | 'admin'

const TABS: { id: AppTab; label: StringKey; icon: ReactElement }[] = [
  {
    id: 'map',
    label: 'navMap',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="16" height="16" />
        <path d="M3 11h16M11 3v16" />
      </svg>
    ),
  },
  {
    id: 'seat',
    label: 'navSeat',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
        <path d="M15 15l4 4" />
      </svg>
    ),
  },
  {
    id: 'me',
    label: 'navMe',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="7" r="4" />
        <path d="M3 20c1-4 4-6 8-6s7 2 8 6" />
      </svg>
    ),
  },
  {
    id: 'team',
    label: 'navTeam',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 19V11M8 19V5M13 19V9M18 19V13" />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'navStaff',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="8" cy="7" r="3" />
        <path d="M2 19c.6-3.4 2.8-5 6-5s5.4 1.6 6 5" />
        <path d="M15 6h5M15 10h5M17 14h3" />
      </svg>
    ),
  },
]

/**
 * Main navigation (C): Map · Find seat · Me, plus Team (HOD, admin) and Staff (admin).
 * Phone: fixed bar at the bottom (thumb reach). Desktop: sidebar left of the content.
 */
export function AppNav({
  tab,
  onTab,
  placement,
  role = 'staff',
}: {
  tab: AppTab
  onTab: (tab: AppTab) => void
  placement: 'side' | 'bottom'
  /** Team dashboard for HODs and admins; Staff (admin page) for admins only. */
  role?: Role
}) {
  const { t: tr } = useLang()
  return (
    <nav className={`app-nav app-nav--${placement}`} aria-label="Main">
      {TABS.filter((t) => tabAllowed(t.id, role)).map((t) => (
        <button key={t.id} type="button" aria-current={t.id === tab ? 'page' : undefined} onClick={() => onTab(t.id)}>
          {t.icon}
          {tr(t.label)}
        </button>
      ))}
    </nav>
  )
}

function tabAllowed(tab: AppTab, role: Role): boolean {
  if (tab === 'team') return role === 'hod' || role === 'admin'
  if (tab === 'admin') return role === 'admin'
  return true
}
