import { useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { isFree, suggestSeat } from './components/seating'
import { useFloor } from './hooks/useFloor'
import { usePersona } from './persona/personaContext'
import { PersonaSwitcher } from './persona/PersonaSwitcher'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'

interface Suggestion {
  personaId: string
  deskId: string | null // null when there's nothing to suggest (already seated, floor full)
  note: string
}

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona, users } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null
  // A suggestion belongs to the persona who asked (switching persona hides it), and a desk suggestion
  // only stays up while that desk is still free — once anyone sits there, the note would be stale.
  const suggestedDesk = suggestion?.deskId ? floor?.desks.find((d) => d.id === suggestion.deskId) : undefined
  const activeSuggestion =
    suggestion && suggestion.personaId === persona?.id && (suggestion.deskId === null || (suggestedDesk && isFree(suggestedDesk)))
      ? suggestion
      : null

  function findSeat() {
    if (!floor || !persona) return
    const result = suggestSeat(floor.desks, persona)
    const suggestedId = result.ok ? result.desk.id : null
    // Open the panel on the suggestion, or on the desk you're already at.
    const focusId = suggestedId ?? (result.ok ? null : (result.deskId ?? null))
    setSuggestion({ personaId: persona.id, deskId: suggestedId, note: result.note })
    if (focusId) setSelectedId(focusId)
  }

  return (
    <div className="app">
      <TitleBlock floor={floor} live={live} persona={persona}>
        <PersonaSwitcher />
      </TitleBlock>

      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
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
              <MapFrame floor={floor} users={users} legend={<Legend />}>
                <PixelOffice
                  desks={floor.desks}
                  selectedId={selectedId}
                  youId={persona?.id ?? null}
                  suggestedId={activeSuggestion?.deskId ?? null}
                  onSelect={(d) => setSelectedId(d.id)}
                />
              </MapFrame>
            </div>
            {selected ? (
              <DeskPanel
                key={selected.id /* fresh busy/error state per desk */}
                desk={selected}
                persona={persona}
                note={activeSuggestion?.deskId === selected.id ? activeSuggestion.note : undefined}
                onClose={() => setSelectedId(null)}
                onChanged={() => void reload()}
              />
            ) : (
              <PanelHint />
            )}
          </div>
        )}
      </main>

      <DrawingFooter />
    </div>
  )
}
