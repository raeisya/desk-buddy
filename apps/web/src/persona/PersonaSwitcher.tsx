import type { UserSummary } from '../api/contracts'
import { usePersona } from './personaContext'

/** Stand-in for C's login page: pick who you are for the demo. */
export function PersonaSwitcher() {
  const { persona, users, setPersona } = usePersona()

  const byTeam = new Map<string, UserSummary[]>()
  for (const u of users) byTeam.set(u.team, [...(byTeam.get(u.team) ?? []), u])

  return (
    <label className="persona-switcher">
      <span className="muted">Viewing as</span>
      <select
        value={persona?.id ?? ''}
        onChange={(e) => setPersona(users.find((u) => u.id === e.target.value) ?? null)}
      >
        <option value="">— pick who you are —</option>
        {[...byTeam].map(([team, members]) => (
          <optgroup key={team} label={team}>
            {members.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.role === 'hod' ? ' (HOD)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
