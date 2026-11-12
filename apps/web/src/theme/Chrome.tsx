import type { ReactNode } from 'react'
import type { FloorResponse, UserSummary } from '../api/contracts'
import { frameStyle, variantFor } from './characters'

/*
 * Redline "drawing" chrome (C): title block, framed map, side-panel hint, footer.
 * Layout and look only. Data comes in as props; B's components stay inside.
 */

const TZ = 'Asia/Kuala_Lumpur'
const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

interface TitleBlockProps {
  floor: FloorResponse | null
  live: boolean
  persona: UserSummary | null
  /** The persona picker (B's switcher today, C's login page later). */
  children?: ReactNode
}

/** Page header styled as an engineering drawing's title block. */
export function TitleBlock({ floor, live, persona, children }: TitleBlockProps) {
  const now = floor ? new Date(floor.now) : null
  return (
    <header className="tb">
      <div className="tb-brand">
        <span className="tb-logo">DeskBuddy</span>
        <span className="tb-tagline">Every empty desk, put to work.</span>
      </div>
      <dl className="tb-cells">
        <div>
          <dt className="db-label">Dwg no.</dt>
          <dd>DB-001</dd>
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
        {persona && <span className="tb-sprite" style={frameStyle(variantFor(persona.id), 'down', 0)} aria-hidden="true" />}
        <div className="tb-who-picker">{children}</div>
        <span className={`tb-live${live ? ' on' : ''}`}>{live ? '● Live' : '○ Offline'}</span>
      </div>
    </header>
  )
}

interface MapFrameProps {
  floor: FloorResponse
  users: UserSummary[]
  legend?: ReactNode
  children: ReactNode
}

/** The map inside a red-banded drawing frame, with live counts and the legend. */
export function MapFrame({ floor, users, legend, children }: MapFrameProps) {
  const free = floor.desks.filter((d) => d.state === 'available' || d.state === 'unassigned').length
  const owners = new Set(floor.desks.flatMap((d) => (d.owner ? [d.owner.id] : [])))
  const noDesk = users.length > 0 ? users.filter((u) => !owners.has(u.id)).length : null
  return (
    <section className="db-panel mapframe" aria-label="Floor plan">
      <div className="db-panel__head">
        <h2 className="db-panel__title">Floor 12</h2>
        <span className="db-panel__hint">
          {floor.desks.length} desks · <strong>{free} free</strong>
          {noDesk !== null && ` · ${noDesk} staff without a desk`}
        </span>
      </div>
      <div className="mapframe-body">{children}</div>
      {legend && <div className="mapframe-legend">{legend}</div>}
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
