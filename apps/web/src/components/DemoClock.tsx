import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ClockResponse } from '../api/contracts'

interface Props {
  /** floor.now — changes whenever the server clock moves, so this refetches on every clock-changed event. */
  stamp: string | undefined
  releaseCutoff: string
}

/** HH:MM plus one minute ("10:00" → "10:01"). */
function minuteAfter(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + 1) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Presenter tool: jump the shared app clock to before / after the auto-release cutoff, today only.
 * The clock is SHARED by every viewer (and A's Slack date logic), so: only same-day jumps, a loud
 * DEMO TIME badge whenever it isn't real time, and a one-click way back.
 */
export function DemoClock({ stamp, releaseCutoff }: Props) {
  const [clock, setClock] = useState<ClockResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getClock().then(setClock, (e: Error) => setError(e.message))
  }, [stamp])

  async function run(action: () => Promise<ClockResponse>) {
    setBusy(true)
    setError(null)
    try {
      setClock(await action())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Malaysia is UTC+8 all year (no DST), so a fixed offset is safe.
  const jump = (hhmm: string) => () => run(() => api.setClock(`${clock!.today}T${hhmm}:00+08:00`))
  const before = '09:00'
  const after = minuteAfter(releaseCutoff)
  const isDemo = clock?.isDemoTime ?? false

  return (
    <div className="demo-clock">
      <button
        type="button"
        className={`demo-clock-chip${isDemo ? ' is-demo' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Demo clock"
      >
        {clock ? clock.localTime : '--:--'}
        {isDemo && <strong> · DEMO TIME</strong>}
      </button>
      {open && clock && (
        <div className="demo-clock-menu" role="group" aria-label="Demo clock">
          <p className="muted">Demo clock · today only · moves the time for everyone</p>
          <button type="button" className="px-button" onClick={jump(before)} disabled={busy}>
            {before} · before cutoff
          </button>
          <button type="button" className="px-button" onClick={jump(after)} disabled={busy}>
            {after} · after cutoff
          </button>
          <button type="button" className="px-button" onClick={() => run(api.resetClock)} disabled={busy || !isDemo}>
            Real time
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
