import { createContext, useContext } from 'react'
import type { UserSummary } from '../api/contracts'

/**
 * "Who am I" for the demo. The topbar dropdown sets it today; C's login page calls
 * `setPersona(user)` from `usePersona()` and the dropdown can go.
 */
export interface PersonaState {
  persona: UserSummary | null
  users: UserSummary[]
  setPersona: (user: UserSummary | null) => void
}

export const PersonaContext = createContext<PersonaState | null>(null)

export function usePersona(): PersonaState {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error('usePersona must be used inside <PersonaProvider>')
  return ctx
}
