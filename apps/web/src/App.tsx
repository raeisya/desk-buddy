import { useState } from 'react'
import { DemoClock } from './components/DemoClock'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'
import { usePersona } from './persona/personaContext'
import { PersonaSwitcher } from './persona/PersonaSwitcher'

export default function App() {
  const { floor, error, live } = useFloor()
  const { persona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null

  return (
    <div className="app">
      <header className="topbar">
        <h1>DeskBuddy</h1>
        <span className="muted">{floor ? `${floor.date} · auto-release at ${floor.releaseCutoff}` : 'Loading…'}</span>
        <PersonaSwitcher />
        {floor && <DemoClock stamp={floor.now} releaseCutoff={floor.releaseCutoff} />}
        <span className={`live ${live ? 'on' : ''}`}>{live ? '● Live' : '○ Offline'}</span>
      </header>

      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
        <Legend />
        {floor && (
          <div className="workspace">
            <div className="map-wrap">
              <PixelOffice
                desks={floor.desks}
                selectedId={selectedId}
                youId={persona?.id ?? null}
                onSelect={(d) => setSelectedId(d.id)}
              />
            </div>
            {selected && (
              <DeskPanel
                key={selected.id /* fresh busy/error state per desk */}
                desk={selected}
                persona={persona}
                releaseCutoff={floor.releaseCutoff}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
