import { FloorMap } from './components/FloorMap'
import { Legend } from './components/Legend'
import { useFloor } from './hooks/useFloor'

export default function App() {
  const { floor, error, live } = useFloor()

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
        {floor && <FloorMap desks={floor.desks} />}
      </main>
    </div>
  )
}
