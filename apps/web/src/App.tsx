import { useEffect, useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'
import { FindSeat } from './pages/FindSeat'
import { Login } from './pages/Login'
import { Me } from './pages/Me'
import { usePersona } from './persona/personaContext'
import { AppNav, type AppTab } from './theme/AppNav'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'
import { useNarrow } from './theme/useNarrow'

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona, users, setPersona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<AppTab>('map')
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

  // One tab at a time on every screen size: Map · Find seat · Me.
  // Phone puts the nav at the bottom (thumb reach); desktop puts it under the title block.
  return (
    <div className={narrow ? 'app app--phone' : 'app'}>
      {header}
      {!narrow && <AppNav tab={tab} onTab={setTab} placement="top" />}
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
      {narrow ? <AppNav tab={tab} onTab={setTab} placement="bottom" /> : <DrawingFooter />}
    </div>
  )
}
