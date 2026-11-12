import { useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { suggestSeat } from './components/seating'
import { useFloor } from './hooks/useFloor'
import { usePersona } from './persona/personaContext'
import { PersonaSwitcher } from './persona/PersonaSwitcher'

interface Suggestion {
  personaId: string
  deskId: string | null // null when there's nothing to suggest (already seated, floor full)
  note: string
}

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null
  // A suggestion belongs to the persona who asked; switching persona hides it.
  const activeSuggestion = suggestion && suggestion.personaId === persona?.id ? suggestion : null

  function findSeat() {
    if (!floor || !persona) return
    const result = suggestSeat(floor.desks, persona)
    const deskId = result.ok ? result.desk.id : (result.deskId ?? null)
    setSuggestion({ personaId: persona.id, deskId: result.ok ? deskId : null, note: result.note })
    if (deskId) setSelectedId(deskId)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>DeskBuddy</h1>
        <span className="muted">{floor ? floor.date : 'Loading…'}</span>
        <PersonaSwitcher />
        <span className={`live ${live ? 'on' : ''}`}>{live ? '● Live' : '○ Offline'}</span>
      </header>

      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
        <Legend />
        {floor && persona && (
          <div className="find-seat">
            <button type="button" className="px-button primary" onClick={findSeat}>
              Find me a seat near {persona.team}
            </button>
            {activeSuggestion && <p aria-live="polite">{activeSuggestion.note}</p>}
          </div>
        )}
        {floor && (
          <div className="workspace">
            <div className="map-wrap">
              <PixelOffice
                desks={floor.desks}
                selectedId={selectedId}
                youId={persona?.id ?? null}
                suggestedId={activeSuggestion?.deskId ?? null}
                onSelect={(d) => setSelectedId(d.id)}
              />
            </div>
            {selected && (
              <DeskPanel
                key={selected.id /* fresh busy/error state per desk */}
                desk={selected}
                persona={persona}
                note={activeSuggestion?.deskId === selected.id ? activeSuggestion.note : undefined}
                onClose={() => setSelectedId(null)}
                onChanged={() => void reload()}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
