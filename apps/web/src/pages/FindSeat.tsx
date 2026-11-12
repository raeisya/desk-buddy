import { useRef, useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { shortName } from '../components/displayName'
import { PixelOffice } from '../components/PixelOffice'
import { isFree, suggestSeat } from '../components/seating'
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

/**
 * "Find seat" tab (C): the best free desk near your team, one tap to take it.
 * "Best" is B's suggestSeat(), the same answer as the map's "Find me a seat" button.
 * The list's View swaps the card to that desk instead of leaving the page.
 */
export function FindSeat({ floor, persona, onChanged, onShowOnMap }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  const suggestion = suggestSeat(floor.desks, persona)
  const ranked = rankSeats(floor.desks, persona)
  const best = suggestion.ok ? suggestion.desk : (ranked[0] ?? null)
  // Best first, then the nearest others. Re-read from the live floor so a desk someone just took drops out.
  const options = best ? [best, ...ranked.filter((d) => d.id !== best.id)].slice(0, 4) : []
  const chosen = options.find((d) => d.id === chosenId) ?? best
  const isBest = chosen?.id === best?.id
  const zone = chosen ? zonesOf(floor.desks).find((z) => z.name === chosen.zone) : undefined

  function show(desk: FloorDesk) {
    setChosenId(desk.id)
    setError(null)
    // Phone: the list sits below the card, so bring the card back into view.
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  if (!best || !chosen) {
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
      <div className="db-panel seat-card" ref={cardRef}>
        {zone && (
          <MapCrop box={zone}>
            <PixelOffice
              desks={floor.desks}
              selectedId={chosen.id}
              youId={persona.id}
              onSelect={(d) => isFree(d) && d.owner?.id !== persona.id && show(d)}
            />
          </MapCrop>
        )}
        <div className="db-panel__body screen-stack">
          <div className="screen-row">
            <h2 className="screen-desk">Desk {chosen.id}</h2>
            <span className={`db-chip ${isBest ? 'db-chip--ok' : 'db-chip--soft'}`}>{isBest ? 'Best match' : 'Free today'}</span>
          </div>
          <p className="screen-lead">
            {isBest && suggestion.ok ? (
              suggestion.note
            ) : (
              <>
                {chosen.zone} · {chosen.owner ? `${shortName(chosen.owner.name)} is away today` : 'Hot desk, no owner'}
              </>
            )}
          </p>
          <button type="button" className="db-btn screen-cta" disabled={busy} onClick={() => run(() => api.claimDesk(chosen.id, persona.id))}>
            {busy ? 'Taking…' : `Take ${chosen.id} ▶`}
          </button>
          <button type="button" className="seat-maplink" onClick={() => onShowOnMap(chosen)}>
            See on full map
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>

      {options.length > 1 && (
        <div className="screen-stack">
          <h3 className="db-label">Options near your team</h3>
          {options.map((d) => {
            const on = d.id === chosen.id
            return (
              <button
                key={d.id}
                type="button"
                className={`zone-free__item${on ? ' zone-free__item--on' : ''}`}
                aria-current={on ? 'true' : undefined}
                onClick={() => show(d)}
              >
                <span>
                  <strong>{d.id}</strong>
                  <span className="zone-free__sub">
                    {d.id === best.id ? 'Best match · ' : ''}
                    {d.zone} · {d.owner ? `${shortName(d.owner.name)} is away today` : 'Hot desk'}
                  </span>
                </span>
                <span className="zone-free__go">{on ? 'Showing' : 'View ▶'}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

