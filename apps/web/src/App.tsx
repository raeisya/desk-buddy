import { useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'

export default function App() {
  const { floor, error, live } = useFloor()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null

  return (
    <div className="app">
      <header className="topbar">
        <h1>DeskBuddy</h1>
        <span className="muted">{floor ? `${floor.date} · auto-release at ${floor.releaseCutoff}` : 'Loading…'}</span>
        <span className={`live ${live ? 'on' : ''}`}>{live ? '● Live' : '○ Offline'}</span>
      </header>

      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
        <Legend />
        {floor && (
          <div className={`workspace${selected ? ' with-panel' : ''}`}>
            <PixelOffice desks={floor.desks} selectedId={selectedId} onSelect={(d) => setSelectedId(d.id)} />
            {selected && <DeskPanel desk={selected} onClose={() => setSelectedId(null)} />}
          </div>
        )}
      </main>
    </div>
  )
}
