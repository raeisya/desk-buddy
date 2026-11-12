import { useEffect, useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'
import { FindSeat } from './pages/FindSeat'
import { Login } from './pages/Login'
import { Me } from './pages/Me'
import { usePersona } from './persona/personaContext'
import { BottomNav, type PhoneTab } from './theme/BottomNav'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'
import { useNarrow } from './theme/useNarrow'

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona, users, setPersona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<PhoneTab>('map')
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null
  const narrow = useNarrow()

  // Phone: the desk panel sits below the map, so bring it into view when a desk is picked.
  useEffect(() => {
    if (narrow && tab === 'map' && selectedId) {
      document.querySelector('.desk-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [narrow, tab, selectedId])

  // Users load async; until then a saved persona can't resolve, so don't flash the login page.
  if (users.length === 0) {
    return (
      <div className="app">
        <p className={error ? 'error' : 'muted'}>{error ? `Can't reach the API: ${error}` : 'Loading…'}</p>
      </div>
    )
  }
  if (!persona) return <Login />

  const header = (
    <TitleBlock
      floor={floor}
      live={live}
      persona={persona}
      onLogout={() => {
        setSelectedId(null)
        setTab('map')
        setPersona(null) // → login page
      }}
    />
  )

  const workspace = floor && (
    <div className="workspace">
      <div className="map-wrap">
        <MapFrame floor={floor} users={users} legend={<Legend />} homeTeam={persona.team} onSelectDesk={(d) => setSelectedId(d.id)}>
          <PixelOffice desks={floor.desks} selectedId={selectedId} youId={persona.id} onSelect={(d) => setSelectedId(d.id)} />
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
  )

  // Phone: one tab at a time, bottom navigation (Map · Find seat · Me).
  if (narrow) {
    return (
      <div className="app app--phone">
        {header}
        <main>
          {error && <p className="error">Can't reach the API: {error}</p>}
          {tab === 'map' && workspace}
          {tab === 'seat' && floor && (
            <FindSeat
              floor={floor}
              persona={persona}
              onChanged={() => void reload()}
              onShowOnMap={(d) => {
                setSelectedId(d.id)
                setTab('map')
              }}
            />
          )}
          {tab === 'me' && floor && <Me floor={floor} persona={persona} onChanged={() => void reload()} />}
        </main>
        <BottomNav tab={tab} onTab={setTab} />
      </div>
    )
  }

  return (
    <div className="app">
      {header}
      <main>
        {error && <p className="error">Can't reach the API: {error}</p>}
        {workspace}
      </main>
      <DrawingFooter />
    </div>
  )
}
