import { useRef, useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { shortName } from '../components/displayName'
import { PixelOffice } from '../components/PixelOffice'
import { isFree, suggestSeat } from '../components/seating'
import { MapCrop, PageHeader } from '../theme/Chrome'
import { floorDay } from '../theme/format'
import { rankSeats, zonesOf } from '../theme/zones'
import { useLang } from '../i18n/lang'
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

  const { lang, t } = useLang()
  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  const suggestion = suggestSeat(floor.desks, persona, lang)
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
          title={t('sortedTitle')}
          meta={floorDay(floor)}
          note={t('sortedNote')}
        />
        <div className="db-panel">
          <div className="db-panel__head">
            <h2 className="db-panel__title">{t('deskN', { desk: sitting.id })}</h2>
            <span className="db-chip db-chip--ok">{t('yoursToday')}</span>
          </div>
          <div className="db-panel__body screen-stack">
            <p className="screen-lead">{t('seeYou', { zone: sitting.zone })}</p>
            <button type="button" className="db-btn db-btn--secondary" onClick={() => onShowOnMap(sitting)}>
              {t('showOnMap')}
            </button>
            <button type="button" className="db-btn db-btn--plain" disabled={busy} onClick={() => run(() => api.releaseDesk(sitting.id, persona.id))}>
              {busy ? t('leaving') : t('leaveThisDesk')}
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
          title={t('noFreeTitle')}
          meta={floorDay(floor)}
          note={t('noFreeNote')}
        />
      </section>
    )
  }

  return (
    <section className="tab-screen">
      <PageHeader title={t('bestTitle')} meta={floorDay(floor)} note={t('bestNote', { team: persona.team })} />
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
            <h2 className="screen-desk">{t('deskN', { desk: chosen.id })}</h2>
            <span className={`db-chip ${isBest ? 'db-chip--ok' : 'db-chip--soft'}`}>{isBest ? t('bestMatch') : t('freeToday')}</span>
          </div>
          <p className="screen-lead">
            {isBest && suggestion.ok ? (
              suggestion.note
            ) : (
              <>
                {chosen.zone} · {chosen.owner ? t('isAway', { name: shortName(chosen.owner.name) }) : t('hotNoOwner')}
              </>
            )}
          </p>
          <button type="button" className="db-btn screen-cta" disabled={busy} onClick={() => run(() => api.claimDesk(chosen.id, persona.id))}>
            {busy ? t('taking') : t('takeN', { desk: chosen.id })}
          </button>
          <button type="button" className="seat-maplink" onClick={() => onShowOnMap(chosen)}>
            {t('seeFullMap')}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </div>

      {options.length > 1 && (
        <div className="screen-stack">
          <h3 className="db-label">{t('optionsNear')}</h3>
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
                    {d.id === best.id ? `${t('bestMatch')} · ` : ''}
                    {d.zone} · {d.owner ? t('isAway', { name: shortName(d.owner.name) }) : t('hotDesk')}
                  </span>
                </span>
                <span className="zone-free__go">{on ? t('showing') : t('view')}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

