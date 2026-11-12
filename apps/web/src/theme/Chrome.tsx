import { useMemo, useState, type ReactNode } from 'react'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { shortName } from '../components/displayName'
import { frameStyle, variantFor } from './characters'
import { useNarrow } from './useNarrow'
import { homeZoneFor, isFree, MAP_H, MAP_W, zonesOf, type Zone } from './zones'

/*
 * Redline "drawing" chrome (C): title block, framed map, side-panel hint, footer.
 * Layout and look only. Data comes in as props; B's components stay inside.
 */

const TZ = 'Asia/Kuala_Lumpur'
const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

/** Role shown under the signed-in name. Aina is the demo's new joiner (no desk yet). */
function personaTag(user: UserSummary): string {
  const role = user.id === 'u-aina' ? 'New joiner' : user.role === 'hod' ? 'HOD' : user.role === 'admin' ? 'Admin' : 'Staff'
  return `${role} · ${user.team}`
}

interface TitleBlockProps {
  floor: FloorResponse | null
  live: boolean
  persona: UserSummary | null
  /** Back to the login page. */
  onLogout?: () => void
}

/** Page header styled as an engineering drawing's title block. */
export function TitleBlock({ floor, live, persona, onLogout }: TitleBlockProps) {
  const now = floor ? new Date(floor.now) : null
  // Live: goes up when someone takes a desk, down when a Slack post frees one.
  const inUse = floor ? floor.desks.length - floor.desks.filter(isFree).length : 0
  return (
    <header className="tb">
      <div className="tb-brand">
        <span className="tb-logo">DeskBuddy</span>
        <span className="tb-tagline">Every empty desk, put to work.</span>
      </div>
      <dl className="tb-cells">
        <div>
          <dt className="db-label">Desks in use</dt>
          <dd>{floor ? `${inUse} / ${floor.desks.length}` : '…'}</dd>
        </div>
        <div>
          <dt className="db-label">Project</dt>
          <dd>Acme Tech · Level 12</dd>
        </div>
        <div>
          <dt className="db-label">Today</dt>
          <dd>{now ? `${fmtDay.format(now)} · ${fmtTime.format(now)}` : 'Loading…'}</dd>
        </div>
      </dl>
      <div className="tb-who">
        {persona && (
          <>
            <span className="tb-sprite" style={frameStyle(variantFor(persona.id), 'down', 0)} aria-hidden="true" />
            <div className="tb-who-text">
              <span className="tb-who-name">{persona.name}</span>
              <span className="tb-who-role">{personaTag(persona)}</span>
            </div>
          </>
        )}
        <span className={`tb-live${live ? ' on' : ''}`}>{live ? '● Live' : '○ Offline'}</span>
        {onLogout && (
          <button type="button" className="db-btn db-btn--secondary tb-logout" onClick={onLogout}>
            Log out
          </button>
        )}
      </div>
    </header>
  )
}

interface PageHeaderProps {
  title: string
  /** Right side of the red band, e.g. the date. */
  meta?: ReactNode
  /** One line under the band. */
  note?: ReactNode
  /** Small label at the end of the note strip, e.g. "HOD only". */
  chip?: string
}

/** Opening band for the tab pages (Find seat, Me, Team), matching the map's red frame header. */
export function PageHeader({ title, meta, note, chip }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div className="page-head__band">
        <h1 className="page-head__title">{title}</h1>
        {meta && <span className="page-head__meta">{meta}</span>}
      </div>
      {(note || chip) && (
        <div className="page-head__strip">
          {note && <p>{note}</p>}
          {chip && <span className="db-chip db-chip--red page-head__chip">{chip}</span>}
        </div>
      )}
    </header>
  )
}

/** Shows only one box of the map (map pixels), scaled to fill the width. Used for phone zone views. */
export function MapCrop({ box, children }: { box: Pick<Zone, 'x' | 'y' | 'w' | 'h'>; children: ReactNode }) {
  return (
    <div className="zone-viewport" style={{ aspectRatio: `${box.w} / ${box.h}` }}>
      <div
        className="zone-stage"
        style={{
          width: `${(MAP_W / box.w) * 100}%`,
          transform: `translate(${(-box.x / MAP_W) * 100}%, ${(-box.y / MAP_H) * 100}%)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface MapFrameProps {
  floor: FloorResponse
  users: UserSummary[]
  legend?: ReactNode
  /** Phone view: start on this team's zone. */
  homeTeam?: string
  /** Phone view: tapping a desk in the "free here" list. */
  onSelectDesk?: (desk: FloorDesk) => void
  children: ReactNode
}

/**
 * The map inside a red-banded drawing frame, with live counts and the legend.
 * On a phone the full floor is unreadable, so it shows one zone at a time (picker laid out like
 * the floor) plus a tappable list of that zone's free desks.
 */
export function MapFrame({ floor, users, legend, homeTeam, onSelectDesk, children }: MapFrameProps) {
  const narrow = useNarrow()
  const ordered = useMemo(() => zonesOf(floor.desks), [floor.desks])
  const [picked, setPicked] = useState<string | null>(null)
  const zone = ordered.find((z) => z.name === (picked ?? homeZoneFor(ordered, homeTeam))) ?? ordered[0]

  const free = floor.desks.filter(isFree).length
  const owners = new Set(floor.desks.flatMap((d) => (d.owner ? [d.owner.id] : [])))
  const noDesk = users.length > 0 ? users.filter((u) => !owners.has(u.id)).length : null
  const freeHere = zone ? zone.desks.filter(isFree).sort((a, b) => a.id.localeCompare(b.id)) : []

  return (
    <section className="db-panel mapframe" aria-label="Floor plan">
      <div className="db-panel__head">
        <h2 className="db-panel__title">Floor 12</h2>
        <span className="db-panel__hint">
          {floor.desks.length} desks · <strong>{free} free</strong>
          {noDesk !== null && ` · ${noDesk} staff without a desk`}
        </span>
      </div>

      {narrow && zone ? (
        <>
          <nav className="zone-picker" aria-label="Zones, laid out like the floor">
            {ordered.map((z) => {
              const n = z.desks.filter(isFree).length
              return (
                <button
                  key={z.name}
                  type="button"
                  className={`zone-tile${z.name === zone.name ? ' on' : ''}`}
                  aria-pressed={z.name === zone.name}
                  onClick={() => setPicked(z.name)}
                >
                  <span className="zone-tile__name">{z.name}</span>
                  <span className="zone-tile__free">{n} free</span>
                </button>
              )
            })}
          </nav>
          <MapCrop box={zone}>{children}</MapCrop>
          {legend && <div className="mapframe-legend">{legend}</div>}
          <div className="zone-free">
            <h3 className="db-label">Free in {zone.name}</h3>
            {freeHere.length === 0 && <p className="muted">No free desks here right now. Try another zone.</p>}
            {freeHere.map((d) => (
              <button key={d.id} type="button" className="zone-free__item" onClick={() => onSelectDesk?.(d)}>
                <span>
                  <strong>{d.id}</strong>
                  <span className="zone-free__sub">
                    {d.owner ? `${shortName(d.owner.name)}'s desk · away today` : 'Hot desk'}
                  </span>
                </span>
                <span className="zone-free__go">View ▶</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mapframe-body">{children}</div>
          {legend && <div className="mapframe-legend">{legend}</div>}
        </>
      )}
    </section>
  )
}

/** Side panel when no desk is selected, so the layout doesn't jump. */
export function PanelHint() {
  return (
    <aside className="db-panel panel-hint" aria-label="How to take a desk">
      <div className="db-panel__head">
        <h2 className="db-panel__title">Pick a desk</h2>
      </div>
      <div className="db-panel__body">
        <p>Green desks are free today: their owners said in Slack that they're out.</p>
        <p className="muted">Tap one to see whose it is and take it.</p>
      </div>
    </aside>
  )
}

export function DrawingFooter() {
  return (
    <footer className="tb-footer">
      <span>Scale 1:100 · Rev B · Drawn by DeskBuddy</span>
      <span>Desks free up when their owners say they're out in Slack</span>
    </footer>
  )
}
