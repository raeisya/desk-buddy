import { useMemo, useState, type ReactNode } from 'react'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { shortName } from '../components/displayName'
import { LangToggle, useLang, type StringKey } from '../i18n/lang'
import { useNarrow } from './useNarrow'
import { homeZoneFor, isFree, MAP_H, MAP_W, zonesOf, type Zone } from './zones'
import { personFrameStyle } from '../components/characterArt'

/*
 * Redline "drawing" chrome (C): title block, framed map, side-panel hint, footer.
 * Layout and look only. Data comes in as props; B's components stay inside.
 */

const TZ = 'Asia/Kuala_Lumpur'
const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })

/** Role shown under the signed-in name. Aina is the demo's new joiner (no desk yet). */
function personaRole(user: UserSummary): StringKey {
  return user.id === 'u-aina' ? 'roleNewJoiner' : user.role === 'hod' ? 'roleHod' : user.role === 'admin' ? 'roleAdmin' : 'roleStaff'
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
  const { t } = useLang()
  return (
    <header className="tb">
      <div className="tb-brand">
        <span className="tb-logo">DeskBuddy</span>
        <span className="tb-tagline">{t('tagline')}</span>
      </div>
      <dl className="tb-cells">
        <div>
          <dt className="db-label">{t('desksInUse')}</dt>
          <dd>{floor ? `${inUse} / ${floor.desks.length}` : '…'}</dd>
        </div>
        <div>
          <dt className="db-label">{t('project')}</dt>
          <dd>Acme Tech · Level 12</dd>
        </div>
        <div>
          <dt className="db-label">{t('today')}</dt>
          <dd>{now ? `${fmtDay.format(now)} · ${fmtTime.format(now)}` : t('loading')}</dd>
        </div>
      </dl>
      <div className="tb-who">
        {persona && (
          <>
            <span className="tb-sprite" style={personFrameStyle(persona.id, 'down', 0)} aria-hidden="true" />
            <div className="tb-who-text">
              <span className="tb-who-name">{persona.name}</span>
              <span className="tb-who-role">{t(personaRole(persona))} · {persona.team}</span>
            </div>
          </>
        )}
        <span className={`tb-live${live ? ' on' : ''}`}>{live ? t('live') : t('offline')}</span>
        <LangToggle />
        {onLogout && (
          <button type="button" className="db-btn db-btn--secondary tb-logout" onClick={onLogout}>
            {t('logout')}
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
  const { t } = useLang()

  return (
    <section className="db-panel mapframe" aria-label="Floor plan">
      <div className="db-panel__head">
        <h2 className="db-panel__title">{t('floorTitle')}</h2>
        <span className="db-panel__hint">
          {t('desksCount', { n: floor.desks.length })} · <strong>{t('freeCount', { n: free })}</strong>
          {noDesk !== null && t('noDeskCount', { n: noDesk })}
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
                  <span className="zone-tile__free">{t('freeCount', { n })}</span>
                </button>
              )
            })}
          </nav>
          <MapCrop box={zone}>{children}</MapCrop>
          {legend && <div className="mapframe-legend">{legend}</div>}
          <div className="zone-free">
            <h3 className="db-label">{t('freeInZone', { zone: zone.name })}</h3>
            {freeHere.length === 0 && <p className="muted">{t('noFreeInZone')}</p>}
            {freeHere.map((d) => (
              <button key={d.id} type="button" className="zone-free__item" onClick={() => onSelectDesk?.(d)}>
                <span>
                  <strong>{d.id}</strong>
                  <span className="zone-free__sub">
                    {d.owner ? t('ownerAwayDesk', { name: shortName(d.owner.name) }) : t('hotDesk')}
                  </span>
                </span>
                <span className="zone-free__go">{t('view')}</span>
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
  const { t } = useLang()
  return (
    <aside className="db-panel panel-hint" aria-label="How to take a desk">
      <div className="db-panel__head">
        <h2 className="db-panel__title">{t('pickDesk')}</h2>
      </div>
      <div className="db-panel__body">
        <p>{t('pickDeskBody')}</p>
        <p className="muted">{t('pickDeskTap')}</p>
      </div>
    </aside>
  )
}

export function DrawingFooter() {
  const { t } = useLang()
  return (
    <footer className="tb-footer">
      <span>{t('footerScale')}</span>
      <span>{t('footerSlack')}</span>
    </footer>
  )
}
