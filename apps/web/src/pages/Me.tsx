import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, PresenceStatus, UserSummary } from '../api/contracts'
import { PageHeader } from '../theme/Chrome'
import { DeskPickerMap } from '../theme/DeskPickerMap'
import { Modal } from '../theme/Modal'
import { useNarrow } from '../theme/useNarrow'
import { floorDay } from '../theme/format'
import './screens.css'
import { AvatarPicker } from '../components/AvatarPicker'
import { avatarFor, personFrameStyle } from '../components/characterArt'
import { sceneUrl, type SceneName } from '../components/statusScenes'
import { useLang, type StringKey } from '../i18n/lang'

/**
 * Your own status as a little pixel scene, drawn in your own look (components/statusScenes.ts). Private: only on your own Me page — colleagues only ever see "Away".
 */
const SCENES: Partial<Record<PresenceStatus, { file: SceneName; alt: string }>> = {
  WFH: { file: 'wfh', alt: 'At home in pyjamas at a desk with a laptop' },
  MC: { file: 'mc', alt: 'In bed under a blanket with an ice pack and a thermometer' },
  OUTSTATION: { file: 'outstation', alt: 'On a bus, holding the pole with a bag in the other hand' },
  LEAVE: { file: 'leave', alt: 'On holiday at the beach with sunglasses and a coconut drink' },
}

const STATUSES: { id: PresenceStatus; label: StringKey }[] = [
  { id: 'IN_OFFICE', label: 'st_IN_OFFICE' },
  { id: 'WFH', label: 'st_WFH' },
  { id: 'MC', label: 'st_MC' },
  { id: 'LEAVE', label: 'st_LEAVE' },
  { id: 'OUTSTATION', label: 'st_OUTSTATION' },
]

interface Props {
  floor: FloorResponse
  persona: UserSummary
  onChanged: () => void
  /** Jump to the Find seat tab (people without a desk of their own). */
  onFindSeat?: () => void
}

/**
 * "Me" tab (C): one card answering "what does DeskBuddy think I'm doing today?", with one-tap fixes.
 * The usual way to update is still a Slack post; this is for when the AI got it wrong.
 * Privacy: only you see your own reason here; colleagues see "Away".
 */
export function Me({ floor, persona, onChanged, onFindSeat }: Props) {
  const { t } = useLang()
  const [busy, setBusy] = useState<PresenceStatus | null>(null)
  const [lastSet, setLastSet] = useState<PresenceStatus | null>(null)
  // Your real status today (incl. one set by a Slack post); the floor only says in/out.
  // App remounts this page per persona (key), so it can never show someone else's reason.
  const [serverStatus, setServerStatus] = useState<PresenceStatus | null>(null)
  useEffect(() => {
    let cancelled = false
    api.getMyPresence(persona.id).then(
      (r) => {
        if (cancelled) return
        setServerStatus(r.status)
        // A tap stays until the server reports the same thing, so no lookup (early or late) can undo it.
        setLastSet((tapped) => (tapped === r.status ? null : tapped))
      },
      () => undefined, // keep the last known status on a flaky network
    )
    return () => {
      cancelled = true
    }
  }, [persona.id, floor.now])
  const [message, setMessage] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [moveBusy, setMoveBusy] = useState<string | null>(null)
  const [moveMsg, setMoveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const narrow = useNarrow()

  const own = floor.desks.find((d) => d.owner?.id === persona.id) ?? null
  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  // The floor API says in/out but never the reason, so after a refresh an absent owner shows as "Away".
  const ownerOut = own !== null && own.state === 'available' && !sitting
  // What to show, in order of trust:
  // 1. what you just tapped, until the server reports it too;
  // 2. at a desk you booked today → in office (beats a stale WFH from this morning);
  // 3. your status from the server (incl. Slack) — except "in office" while the floor says your own desk is free;
  // 4. the floor alone: at your own desk → in office, otherwise unknown (shown as Away / No desk).
  const atDesk = !!sitting || (own !== null && !ownerOut)
  const fromServer = serverStatus === 'IN_OFFICE' && ownerOut ? null : serverStatus
  const active: PresenceStatus | null = lastSet ?? (sitting ? 'IN_OFFICE' : fromServer) ?? (atDesk ? 'IN_OFFICE' : null)
  const sceneDef = active ? SCENES[active] : undefined
  // '' if this browser can't draw the scene (canvas blocked/unavailable): show your character instead.
  const sceneSrc = sceneDef ? sceneUrl(sceneDef.file, avatarFor(persona.id)) : ''
  const scene = sceneDef && sceneSrc ? sceneDef : undefined
  const headline = active ? t(STATUSES.find((s) => s.id === active)!.label) : ownerOut ? t('away') : t('noDeskYet')
  const out = active !== null ? active !== 'IN_OFFICE' : ownerOut
  const tone = active === 'IN_OFFICE' ? ' me-status--in' : out ? ' me-status--out' : ''

  // Desks you could move your permanent seat to: any with no owner.
  const movable = floor.desks.filter((d) => !d.owner)
  const target = movable.find((d) => d.id === targetId) ?? null

  async function move(deskId: string) {
    setMoveBusy(deskId)
    setMoveMsg(null)
    try {
      const r = await api.moveMyDesk(persona.id, deskId)
      setMoveMsg({ ok: true, text: `Moved. ${r.to} is your desk now; ${r.from} is free for someone else.` })
      setMoving(false)
      setTargetId(null)
      onChanged()
    } catch (e) {
      setMoveMsg({ ok: false, text: (e as Error).message })
    } finally {
      setMoveBusy(null)
    }
  }

  async function set(status: PresenceStatus) {
    setBusy(status)
    setMessage(null)
    try {
      await api.setPresence(persona.id, status)
      setLastSet(status)
      setMessage(t('saved'))
      onChanged()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tab-screen">
      <PageHeader title={t('meTitle')} meta={floorDay(floor)} />

      <div className="db-panel me-card">
        <div className="me-id">
          {scene ? (
            <span
              className="me-scene"
              role="img"
              aria-label={scene.alt}
              style={{ backgroundImage: `url("${sceneSrc}")` }}
            />
          ) : (
            <span className="me-sprite" style={personFrameStyle(persona.id, 'down', 0)} aria-hidden="true" />
          )}
          <div className="me-id__text">
            <span className="db-label">
              {persona.name} · {persona.team}
            </span>
            <p className={`me-status${tone}`} aria-live="polite">
              {headline}
            </p>
            <p className="me-desk">
              {own ? (
                out ? (
                  <>
                    <strong>{own.id}</strong>
                    {t('meDeskOutTail')}
                  </>
                ) : (
                  <>
                    {t('meDeskInHead')}
                    <strong>{own.id}</strong>
                    {t('meDeskInTail', { zone: own.zone })}
                  </>
                )
              ) : sitting ? (
                <>
                  {t('meSittingHead')}
                  <strong>{sitting.id}</strong>
                  {t('meSittingTail', { zone: sitting.zone })}
                </>
              ) : (
                <>{t('meNoDesk')}</>
              )}
            </p>
            {!own && !sitting && onFindSeat && (
              <button type="button" className="db-btn me-find" onClick={onFindSeat}>
                {t('findSeatBtn')}
              </button>
            )}
          </div>
        </div>

        <AvatarPicker persona={persona} onSaved={onChanged} />

        {own && (
          <div className="me-move">
            <div className="me-move__head">
              <h2 className="db-label">Permanent desk: {own.id}</h2>
              <button
                type="button"
                className="db-btn db-btn--secondary me-move__toggle"
                aria-haspopup="dialog"
                onClick={() => {
                  setMoving(true)
                  setMoveMsg(null)
                }}
              >
                Change desk
              </button>
            </div>
            {moveMsg?.ok && (
              <p className="me-msg" role="status">
                {moveMsg.text}
              </p>
            )}
          </div>
        )}

        {own && (
          <Modal
            open={moving}
            title="Change your desk"
            onClose={() => {
              setMoving(false)
              setTargetId(null)
            }}
          >
            {movable.length === 0 ? (
              <p className="muted">Every desk has an owner right now. Ask your HOD.</p>
            ) : (
              <>
                <p className="muted modal__hint">
                  {narrow ? 'Pick a desk below the map to move there.' : 'Click a green desk to move there.'} Yours is{' '}
                  <strong>{own.id}</strong>, outlined in red.
                </p>
                <DeskPickerMap
                  floor={floor}
                  candidates={movable}
                  team={persona.team}
                  currentId={own.id}
                  youId={persona.id}
                  selectedId={target?.id ?? null}
                  onSelect={(d) => {
                    setTargetId(d?.id ?? null)
                    setMoveMsg(null)
                  }}
                  popover={
                    target && (
                      <div className="pick-card" role="group" aria-label={`Move to ${target.id}`}>
                        <div className="pick-card__head">
                          <h3>Desk {target.id}</h3>
                          <span className="db-chip db-chip--ok">No owner</span>
                        </div>
                        <p className="pick-card__sub">
                          Move from <strong>{own.id}</strong> to <strong>{target.id}</strong> ({target.zone})? {own.id} becomes free for
                          someone else.
                        </p>
                        <div className="pick-card__actions">
                          <button type="button" className="db-btn" disabled={moveBusy !== null} onClick={() => move(target.id)}>
                            {moveBusy ? 'Moving…' : 'Move here'}
                          </button>
                          <button type="button" className="db-btn db-btn--plain" onClick={() => setTargetId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }
                />
                {moveMsg && !moveMsg.ok && (
                  <p className="error" role="alert">
                    {moveMsg.text}
                  </p>
                )}
              </>
            )}
          </Modal>
        )}

        <div className="me-fix">
          <h2 className="db-label">{t('notRight')}</h2>
          <div className="me-seg" role="group" aria-label="Today's status">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`me-seg__btn${active === s.id ? ' on' : ''}`}
                aria-pressed={active === s.id}
                disabled={busy !== null}
                onClick={() => set(s.id)}
              >
                {busy === s.id ? t('saving') : t(s.label)}
              </button>
            ))}
          </div>
          {message && (
            <p className="me-msg" role="status">
              {message}
            </p>
          )}
        </div>

        <p className="me-slack">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 3h14v9H7l-4 3v-3H2z" />
          </svg>
          <span>
            {t('slackTipHead')}
            <q>WFH today</q>
            {t('slackTipTail')}
          </span>
        </p>
      </div>
    </section>
  )
}
