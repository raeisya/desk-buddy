import { useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { PixelOffice } from '../components/PixelOffice'
import { MapCrop, PageHeader } from '../theme/Chrome'
import { floorDay } from '../theme/format'
import { rankSeats, zonesOf } from '../theme/zones'
import './screens.css'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Refetch the floor after taking/leaving a desk. */
  onChanged: () => void
  /** Open a desk on the Map tab. */
  onShowOnMap: (desk: FloorDesk) => void
}

/** "Find seat" tab (C): the best free desk near your team, one tap to take it. */
export function FindSeat({ floor, persona, onChanged, onShowOnMap }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  const ranked = rankSeats(floor.desks, persona)
  const best = ranked[0] ?? null
  const others = ranked.slice(1, 4)
  const zone = best ? zonesOf(floor.desks).find((z) => z.name === best.zone) : undefined
  const teammatesIn = floor.desks.filter((d) => d.owner?.team === persona.team && d.state === 'occupied').length

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sitting) {
    return (
      <section className="tab-screen">
        <PageHeader
          title="You're sorted for today"
          meta={floorDay(floor)}
          note="Your desk is held for today. Leave it if your plans change so someone else can sit."
        />
        <div className="db-panel">
          <div className="db-panel__head">
            <h2 className="db-panel__title">Desk {sitting.id}</h2>
            <span className="db-chip db-chip--ok">Yours today</span>
          </div>
          <div className="db-panel__body screen-stack">
            <p className="screen-lead">{sitting.zone}. See you there.</p>
            <button type="button" className="db-btn db-btn--secondary" onClick={() => onShowOnMap(sitting)}>
              Show on map
            </button>
            <button type="button" className="db-btn db-btn--plain" disabled={busy} onClick={() => run(() => api.releaseDesk(sitting.id, persona.id))}>
              {busy ? 'Leaving…' : 'Leave this desk'}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
    )
  }

  if (!best) {
    return (
      <section className="tab-screen">
        <PageHeader
          title="No free desks right now"
          meta={floorDay(floor)}
          note="Desks free up when their owners post in Slack that they're out. This page updates live."
        />
      </section>
    )
  }

  return (
    <section className="tab-screen">
      <PageHeader title="Best seat for you" meta={floorDay(floor)} note={`Free desks closest to the ${persona.team} team.`} />
      <div className="db-panel seat-card">
        {zone && (
          <MapCrop box={zone}>
            <PixelOffice desks={floor.desks} selectedId={best.id} youId={persona.id} onSelect={onShowOnMap} />
          </MapCrop>
        )}
        <div className="db-panel__body screen-stack">
          <div className="screen-row">
            <h2 className="screen-desk">Desk {best.id}</h2>
            <span className="db-chip db-chip--ok">Free today</span>
          </div>
          <p className="screen-lead">
            {best.zone}, near the <strong>{persona.team}</strong> team.{' '}
            {teammatesIn > 0 && `${teammatesIn} of your teammates are in today.`}
          </p>
          <button type="button" className="db-btn screen-cta" disabled={busy} onClick={() => run(() => api.claimDesk(best.id, persona.id))}>
            {busy ? 'Taking…' : `Take ${best.id} ▶`}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>

      {others.length > 0 && (
        <div className="screen-stack">
          <h3 className="db-label">Other options</h3>
          {others.map((d) => (
            <button key={d.id} type="button" className="zone-free__item" onClick={() => onShowOnMap(d)}>
              <span>
                <strong>{d.id}</strong>
                <span className="zone-free__sub">
                  {d.zone} · {d.owner ? `${d.owner.name.split(' ')[0]} is away today` : 'Hot desk'}
                </span>
              </span>
              <span className="zone-free__go">View ▶</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
