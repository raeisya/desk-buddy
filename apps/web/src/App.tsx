import { useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'
import { Login } from './pages/Login'
import { usePersona } from './persona/personaContext'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona, users, setPersona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null

  // Users load async; until then a saved persona can't resolve, so don't flash the login page.
  if (users.length === 0) {
    return (
      <div className="app">
        <p className={error ? 'error' : 'muted'}>{error ? `Can't reach the API: ${error}` : 'Loading…'}</p>
      </div>
    )
  }
  if (!persona) return <Login />

  return (
    <div className="app">
      <TitleBlock
        floor={floor}
        live={live}
        persona={persona}
        onLogout={() => {
          setSelectedId(null)
          setPersona(null) // → login page
        }}
      />

      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
        {floor && (
          <div className="workspace">
            <div className="map-wrap">
              <MapFrame floor={floor} users={users} legend={<Legend />}>
                <PixelOffice
                  desks={floor.desks}
                  selectedId={selectedId}
                  youId={persona?.id ?? null}
                  onSelect={(d) => setSelectedId(d.id)}
                />
              </MapFrame>
            </div>
            {selected ? (
              <DeskPanel
                key={selected.id /* fresh busy/error state per desk */}
                desk={selected}
                persona={persona}
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
