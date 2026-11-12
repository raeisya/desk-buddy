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

  const map = floor && (
    <div className="map-wrap">
      <MapFrame floor={floor} users={users} legend={<Legend />} homeTeam={persona.team} onSelectDesk={(d) => setSelectedId(d.id)}>
        <PixelOffice desks={floor.desks} selectedId={selectedId} youId={persona.id} onSelect={(d) => setSelectedId(d.id)} />
      </MapFrame>
    </div>
  )

  const panel = selected ? (
    <DeskPanel
      key={selected.id /* fresh busy/error state per desk */}
      desk={selected}
      persona={persona}
      onClose={() => setSelectedId(null)}
      onChanged={() => void reload()}
    />
  ) : (
    <PanelHint />
  )

  const pages = (
    <>
      {error && <p className="error">Can't reach the API: {error}</p>}
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
    </>
  )

  // One tab at a time on every screen size: Map · Find seat · Me.
  // Phone: nav fixed at the bottom (thumb reach), desk panel under the map.
  if (narrow) {
    return (
      <div className="app app--phone">
        {header}
        <main>
          {pages}
          {tab === 'map' && floor && (
            <div className="workspace">
              {map}
              {panel}
            </div>
          )}
        </main>
        <AppNav tab={tab} onTab={setTab} placement="bottom" />
      </div>
    )
  }

  // Desktop: left column = nav + desk panel, so the map gets the whole right side.
  return (
    <div className="app app--desktop">
      {header}
      <div className="app-side">
        <AppNav tab={tab} onTab={setTab} placement="side" />
        {tab === 'map' && floor && panel}
      </div>
      <main>
        {pages}
        {tab === 'map' && map}
      </main>
      <DrawingFooter />
    </div>
  )
}
