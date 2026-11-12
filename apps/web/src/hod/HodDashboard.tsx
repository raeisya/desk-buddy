import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, HodHeatmapResponse, HodTodayResponse, UserSummary } from '../api/contracts'
import { PageHeader } from '../theme/Chrome'
import { AssignSeats } from './AssignSeats'
import { capacity, heatStep, teamRows, WEEKDAYS } from './capacity'
import { RemoveSeats } from './RemoveSeats'
import './hod.css'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Active people, for "Give a permanent desk". */
  users: UserSummary[]
  onChanged: () => void
}

const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const fmtWeek = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

/**
 * HOD dashboard (C): today per team, 4-week desk use, and room for new joiners.
 * Privacy: counts per team only, never names. Absence reasons appear here and nowhere else.
 */
export function HodDashboard({ floor, persona, users, onChanged }: Props) {
  const [today, setToday] = useState<HodTodayResponse | null>(null)
  const [heat, setHeat] = useState<HodHeatmapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refetch whenever the live floor changes (a Slack post, a desk taken), so the counts move on stage.
  useEffect(() => {
    let alive = true
    Promise.all([api.getHodToday(), api.getHodHeatmap()])
      .then(([t, h]) => {
        if (!alive) return
        setToday(t)
        setHeat(h)
        setError(null)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [floor])

  if (error) return <p className="error">Can't load the dashboard: {error}</p>
  if (!today || !heat) return <p className="muted">Loading dashboard…</p>

  const rows = teamRows(today)
  const cap = capacity(floor, today, heat, persona.team)
  const inToday = rows.reduce((s, r) => s + r.inOffice, 0)
  const awayToday = rows.reduce((s, r) => s + r.away, 0)
  const silent = rows.reduce((s, r) => s + r.noUpdate, 0)

  return (
    <section className="hod">
      <PageHeader title="Team today" meta={fmtDay.format(day(today.date))} />

      <div className="hod-tiles">
        <Tile label="In office" value={inToday} sub={`of ${cap.staff} staff · ${silent} didn't post, counted in`} />
        <Tile label="Away" value={awayToday} sub="WFH, MC, leave or outstation" />
        <Tile label="Desks free now" value={cap.freeNow} sub={`of ${cap.desks} desks`} />
        <Tile
          label="Busiest day"
          value={cap.busiest ? `${cap.busiest.pct}%` : '–'}
          sub={cap.busiest ? `${cap.busiest.day}, last 4 weeks` : 'No history yet'}
        />
      </div>

      <div className="hod-grid">
        <div className="db-panel">
          <div className="db-panel__head">
            <h2 className="db-panel__title">By team</h2>
          </div>
          <div className="db-panel__body">
            <table className="hod-table">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col" className="hod-num">In</th>
                  <th scope="col" className="hod-num">WFH</th>
                  <th scope="col" className="hod-num">MC</th>
                  <th scope="col" className="hod-num">Leave</th>
                  <th scope="col" className="hod-num">
                    <abbr title="Outstation">Out</abbr>
                  </th>
                  <th scope="col" className="hod-bar-col">
                    <span className="sr-only">In office share</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.team} className={r.team === persona.team ? 'hod-mine' : undefined}>
                    <th scope="row">
                      {r.team}
                      {r.team === persona.team && <span className="hod-you">your team</span>}
                    </th>
                    <td className="hod-num hod-strong">
                      {r.inOffice}
                      <span className="muted">/{r.total}</span>
                    </td>
                    <td className="hod-num">{r.wfh || '·'}</td>
                    <td className="hod-num">{r.mc || '·'}</td>
                    <td className="hod-num">{r.leave || '·'}</td>
                    <td className="hod-num">{r.outstation || '·'}</td>
                    <td className="hod-bar-col">
                      <span
                        className="hod-bar"
                        title={`${r.team}: ${r.inOffice} in, ${r.away} away`}
                        aria-label={`${Math.round((r.inOffice / r.total) * 100)}% in office`}
                      >
                        <span className="hod-bar__in" style={{ flexGrow: r.inOffice }} />
                        <span className="hod-bar__away" style={{ flexGrow: r.away }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hod-key">
              <span className="hod-swatch hod-swatch--in" /> In office <span className="hod-swatch hod-swatch--away" /> Away
            </p>
          </div>
        </div>

        <div className="db-panel">
          <div className="db-panel__head">
            <h2 className="db-panel__title">Seats for new joiners</h2>
          </div>
          <div className="db-panel__body hod-joiner">
            <dl>
              <div>
                <dt className="db-label">Free today near {persona.team}</dt>
                <dd>
                  <strong>{cap.freeNearTeam}</strong> desks
                </dd>
              </div>
              <div>
                <dt className="db-label">Free today, whole floor</dt>
                <dd>
                  <strong>{cap.freeNow}</strong> desks to hot-seat
                </dd>
              </div>
              <div>
                <dt className="db-label">No owner: assign permanently</dt>
                <dd>
                  <strong>{cap.unowned}</strong> desks
                </dd>
              </div>
            </dl>
            <AssignSeats floor={floor} persona={persona} users={users} onChanged={onChanged} />
            <RemoveSeats floor={floor} persona={persona} users={users} onChanged={onChanged} />
            <div className="hod-callout">
              <p className="hod-callout__big">
                Room for <strong>~{cap.roomForMore}</strong> more staff
              </p>
              <p className="muted">
                With hot-seating, before {cap.busiest ? cap.busiest.day : 'the busiest day'} run out of desks. Sized on the
                busiest weekday, assuming new joiners come in as often as everyone else.
              </p>
            </div>
          </div>
        </div>
      </div>


      <div className="db-panel">
        <div className="db-panel__head">
          <h2 className="db-panel__title">Desk use, last 4 weeks</h2>
        </div>
        <div className="db-panel__body">
          <table className="hod-heat">
            <caption className="sr-only">Percent of desks used per weekday</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.weeks.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row">{fmtWeek.format(day(w.weekStart))}</th>
                  {w.days.map((d) => (
                    <td key={d.date}>
                      {d.occupancy === null ? (
                        <span className="hod-cell hod-cell--none" title={`${fmtDay.format(day(d.date))}: not yet`}>
                          –
                        </span>
                      ) : (
                        <span
                          className={`hod-cell hod-cell--${heatStep(d.occupancy)}`}
                          title={`${fmtDay.format(day(d.date))}: ${d.inOffice} in, ${d.occupancy}% of desks`}
                        >
                          {d.occupancy}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Average</th>
                {cap.byWeekday.map((pct, i) => (
                  <td key={WEEKDAYS[i]} className="hod-avg">
                    {pct === null ? '–' : `${pct}%`}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <div className="hod-heat-foot">
            <p className="hod-scale" aria-hidden="true">
              <span className="hod-cell hod-cell--1">&lt;50</span>
              <span className="hod-cell hod-cell--2">50+</span>
              <span className="hod-cell hod-cell--3">70+</span>
              <span className="hod-cell hod-cell--4">85+</span>
              <span className="hod-cell hod-cell--5">95+</span>
            </p>
            {cap.busiest && cap.quietest && cap.busiest.day !== cap.quietest.day && (
              <p className="hod-insight">
                {cap.busiest.day} average <strong>{cap.busiest.pct}%</strong>, {cap.quietest.day} only{' '}
                <strong>{cap.quietest.pct}%</strong>. Moving one team's office day from {cap.busiest.day} to{' '}
                {cap.quietest.day} frees desks where they're tightest.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="hod-tile">
      <span className="db-label">{label}</span>
      <span className="hod-tile__value">{value}</span>
      <span className="hod-tile__sub">{sub}</span>
    </div>
  )
}
