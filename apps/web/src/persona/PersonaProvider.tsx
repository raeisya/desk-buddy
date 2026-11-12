import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { UserSummary } from '../api/contracts'
import { PersonaContext } from './personaContext'

const STORAGE_KEY = 'deskbuddy.personaId'

// Browser storage can throw (private mode, blocked site data) — persona just isn't remembered then.
function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function save(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* not remembered; fine for a demo */
  }
}

/** After "Sign in with Slack" the API redirects to `/#slack=<userId>`: take that as the persona. */
function readSlackSignIn(): string | null {
  const match = /^#slack=(.+)$/.exec(window.location.hash)
  if (!match || match[1] === 'error') return null // the login page shows the error
  const id = decodeURIComponent(match[1])
  history.replaceState(null, '', window.location.pathname + window.location.search)
  save(id)
  return id
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [personaId, setPersonaId] = useState<string | null>(() => readSlackSignIn() ?? readSaved())

  useEffect(() => {
    api.getUsers().then(setUsers, () => setUsers([]))
  }, [])
  // Refetch (e.g. after someone saves a new look). Keeps the current list if the request fails, and
  // ignores a response older than the last one applied (overlapping refetches can land out of order).
  const requested = useRef(0)
  const applied = useRef(0)
  const refreshUsers = useCallback(() => {
    const seq = ++requested.current
    api.getUsers().then((list) => {
      if (seq < applied.current) return
      applied.current = seq
      setUsers(list)
    }, () => undefined)
  }, [])

  const setPersona = useCallback((user: UserSummary | null) => {
    setPersonaId(user?.id ?? null)
    save(user?.id ?? null)
  }, [])

  const persona = users.find((u) => u.id === personaId) ?? null
  const value = useMemo(() => ({ persona, users, setPersona, refreshUsers }), [persona, users, setPersona, refreshUsers])

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}
