import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { ROLES, type AdminUser, type AdminUserPatch, type FloorResponse, type Role, type UserSummary } from '../api/contracts'
import { frameStyle, variantFor } from '../theme/characters'
import { PageHeader } from '../theme/Chrome'
import './admin.css'

interface Props {
  floor: FloorResponse
  persona: UserSummary
}

type Show = 'all' | 'active' | 'inactive'

const ROLE_LABEL: Record<Role, string> = { staff: 'Staff', hod: 'HOD', admin: 'Admin' }
const PAGE_SIZE = 15

/**
 * Staff page for admins (C): everyone in one table. Change team or role, deactivate people who left
 * or never onboarded (their desk goes back to the pool). Permanent desks are assigned by HODs.
 */
export function AdminPage({ floor, persona }: Props) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [show, setShow] = useState<Show>('all')
  const [page, setPage] = useState(0)

  // Refetch on live floor changes too: an HOD assigning a desk shows up here without a reload.
  useEffect(() => {
    let alive = true
    api
      .getAdminUsers(persona.id)
      .then((u) => alive && (setUsers(u), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [floor, persona.id])

  const teams = useMemo(() => [...new Set((users ?? []).map((u) => u.team))].sort(), [users])

  if (!users) return error ? <p className="error">Can't load staff: {error}</p> : <p className="muted">Loading staff…</p>

  const q = query.trim().toLowerCase()
  const rows = users.filter(
    (u) =>
      (team === 'all' || u.team === team) &&
      (show === 'all' || (show === 'active' ? u.active : !u.active)) &&
      (!q || u.name.toLowerCase().includes(q) || u.deskId?.toLowerCase() === q),
  )
  // Clamp so a shrinking list (e.g. someone deactivated) never leaves us on an empty page.
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const first = rows.length === 0 ? 0 : current * PAGE_SIZE + 1
  const last = current * PAGE_SIZE + pageRows.length

  const active = users.filter((u) => u.active).length
  const withDesk = users.filter((u) => u.deskId).length

  async function save(user: AdminUser, patch: AdminUserPatch) {
    if (patch.active === false) {
      const desk = user.deskId ? ` Their desk ${user.deskId} goes back to the pool.` : ''
      if (!window.confirm(`Deactivate ${user.name}? They disappear from sign-in and the team counts.${desk}`)) return
    }
    setBusyId(user.id)
    setError(null)
    try {
      const updated = await api.updateUser(persona.id, user.id, patch)
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="tab-screen admin">
      <PageHeader title="Staff" meta={`${active} active · ${withDesk} with a desk`} />

      <div className="db-panel">
        <div className="admin-tools">
          <label className="admin-search">
            <span className="db-label">Search</span>
            <input type="search" value={query} onChange={(e) => (setQuery(e.target.value), setPage(0))} placeholder="Name or desk (D-04)" />
          </label>
          <label>
            <span className="db-label">Team</span>
            <select value={team} onChange={(e) => (setTeam(e.target.value), setPage(0))}>
              <option value="all">All teams</option>
              {teams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="admin-show" role="group" aria-label="Show">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button key={s} type="button" className={show === s ? 'on' : undefined} aria-pressed={show === s} onClick={() => (setShow(s), setPage(0))}>
                {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Deactivated'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="error admin-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Team</th>
                <th scope="col">Role</th>
                <th scope="col">Desk</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => {
                const self = u.id === persona.id
                const busy = busyId === u.id
                return (
                  <tr key={u.id} className={u.active ? undefined : 'admin-off'} aria-busy={busy}>
                    <th scope="row">
                      <span className="admin-person">
                        <span className="admin-sprite" style={frameStyle(variantFor(u.id), 'down', 0)} aria-hidden="true" />
                        <span>
                          {u.name}
                          {self && <span className="admin-you">you</span>}
                        </span>
                      </span>
                    </th>
                    <td>
                      <select
                        aria-label={`Team for ${u.name}`}
                        value={u.team}
                        disabled={busy}
                        onChange={(e) => save(u, { team: e.target.value })}
                      >
                        {teams.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={busy || self}
                        title={self ? "You can't change your own role" : undefined}
                        onChange={(e) => save(u, { role: e.target.value as Role })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="admin-desk">{u.deskId ?? <span className="muted">No desk</span>}</td>
                    <td>
                      <span className={`db-chip ${u.active ? 'db-chip--ok' : 'db-chip--soft'}`}>{u.active ? 'Active' : 'Deactivated'}</span>
                    </td>
                    <td className="admin-act">
                      {!self && (
                        <button
                          type="button"
                          className={`db-btn ${u.active ? 'db-btn--plain' : 'db-btn--secondary'} admin-btn`}
                          disabled={busy}
                          onClick={() => save(u, { active: !u.active })}
                        >
                          {busy ? 'Saving…' : u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted admin-empty">
                    Nobody matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-foot">
          <p className="muted">
            Showing {first}–{last} of {rows.length}
            {rows.length !== users.length && ` (${users.length} in total)`}. Permanent desks are assigned by each team's HOD on the
            Team page.
          </p>
          {pageCount > 1 && (
            <nav className="admin-pager" aria-label="Staff pages">
              <button type="button" className="db-btn db-btn--plain admin-btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ‹ Prev
              </button>
              <span className="db-label">
                Page {current + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="db-btn db-btn--plain admin-btn"
                disabled={current === pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                Next ›
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
