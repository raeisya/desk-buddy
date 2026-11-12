import { useState } from 'react'
import { DeskPanel } from './components/DeskPanel'
import { Legend } from './components/Legend'
import { PixelOffice } from './components/PixelOffice'
import { useFloor } from './hooks/useFloor'
import { usePersona } from './persona/personaContext'
import { PersonaSwitcher } from './persona/PersonaSwitcher'
import { DrawingFooter, MapFrame, PanelHint, TitleBlock } from './theme/Chrome'

export default function App() {
  const { floor, error, live, reload } = useFloor()
  const { persona, users } = usePersona()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Look the desk up in the latest floor so the panel updates live when state changes.
  const selected = floor?.desks.find((d) => d.id === selectedId) ?? null

  return (
    <div className="app">
      <TitleBlock floor={floor} live={live} persona={persona}>
        <PersonaSwitcher />
      </TitleBlock>

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
