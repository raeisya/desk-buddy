import { useCallback, useEffect, useState } from 'react'
import type { FloorResponse } from './api/contracts'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { isFree, suggestSeat } from './components/seating'
import { planKopiRun } from './components/kopi'
import { presenceWalks, walkDuration } from './components/walking'
import { useFloor } from './hooks/useFloor'
import { useWalkers } from './hooks/useWalkers'
import { FindSeat } from './pages/FindSeat'
import { Login } from './pages/Login'
import { Me } from './pages/Me'
import { usePersona } from './persona/personaContext'
import { AppNav, type AppTab } from './theme/AppNav'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'
import { useNarrow } from './theme/useNarrow'

interface Suggestion {
  personaId: string
  deskId: string | null // null when there's nothing to suggest (already seated, floor full)
  note: string
}

export default function App() {
  const { walkers, hiddenSeated, start: startWalks, cancelAll: cancelWalks } = useWalkers()
  // People who arrive walk in from the door, leavers walk out, desk-switchers walk across.
  const onFloorChange = useCallback(
    (prev: FloorResponse, next: FloorResponse) => {
      const { walks, bulk } = presenceWalks(prev.desks, next.desks)
      if (bulk) return cancelWalks()
      startWalks(walks.map((w) => ({ personId: w.personId, name: w.name, walk: w.walk, hideSeated: w.direction === 'in' })))
    },
    [startWalks, cancelWalks],
  )
  const { floor, error, live, reload } = useFloor(onFloorChange)
  const { persona, users, setPersona } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [tab, setTab] = useState<AppTab>('map')
  const [kopiMessage, setKopiMessage] = useState<string | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null
  const narrow = useNarrow()
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

  // Kopi Easter Egg (challenge round): click the KOPI counter → your teammates who are in walk over
  // for a kopi and back. One run at a time.
  function kopiRun() {
    if (!floor || !persona || kopiMessage) return
    const run = planKopiRun(floor.desks, persona)
    startWalks(run.crew.map((c) => ({ personId: c.person.id, name: c.person.name, walk: c.walk, hideSeated: true })))
    setKopiMessage(run.message)
    const longest = Math.max(4000, ...run.crew.map((c) => walkDuration(c.walk)))
    window.setTimeout(() => setKopiMessage(null), longest + 300)
  }

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

  // B's "Find me a seat near <team>" (#10): marks the desk on the map and opens the panel.
  const findSeatBar = floor && (
    <div className="find-seat">
      <button type="button" className="px-button primary" onClick={findSeat}>
        Find me a seat near {persona.team}
      </button>
      {activeSuggestion && <p aria-live="polite">{activeSuggestion.note}</p>}
    </div>
  )

  const map = floor && (
    <div className="map-wrap">
      <MapFrame floor={floor} users={users} legend={<Legend />} homeTeam={persona.team} onSelectDesk={(d) => setSelectedId(d.id)}>
        <PixelOffice
          desks={floor.desks}
          selectedId={selectedId}
          youId={persona.id}
          suggestedId={activeSuggestion?.deskId ?? null}
          walkers={walkers}
          hiddenSeated={hiddenSeated}
          kopiMessage={kopiMessage}
          onKopi={kopiRun}
          onSelect={(d) => setSelectedId(d.id)}
        />
      </MapFrame>
    </div>
  )

  const panel = selected ? (
    <DeskPanel
      key={selected.id /* fresh busy/error state per desk */}
      desk={selected}
      persona={persona}
      note={activeSuggestion?.deskId === selected.id ? activeSuggestion.note : undefined}
      onClose={() => setSelectedId(null)}
      onChanged={() => void reload()}
      onOpenMe={() => setTab('me')}
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
            <>
              {findSeatBar}
              <div className="workspace">
                {map}
                {panel}
              </div>
            </>
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
        {tab === 'map' && (
          <>
            {findSeatBar}
            {map}
          </>
        )}
      </main>
      <DrawingFooter />
    </div>
  )
}
