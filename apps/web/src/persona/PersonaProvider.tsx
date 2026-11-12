import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [personaId, setPersonaId] = useState<string | null>(readSaved)

  useEffect(() => {
    api.getUsers().then(setUsers, () => setUsers([]))
  }, [])

  const setPersona = useCallback((user: UserSummary | null) => {
    setPersonaId(user?.id ?? null)
    save(user?.id ?? null)
  }, [])

  const persona = users.find((u) => u.id === personaId) ?? null
  const value = useMemo(() => ({ persona, users, setPersona }), [persona, users, setPersona])

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}
