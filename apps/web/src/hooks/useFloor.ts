import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse } from '../api/contracts'

/** Today's floor, kept live: refetches on every server event and once a minute (so the release cutoff shows up). */
export function useFloor() {
  const [floor, setFloor] = useState<FloorResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    try {
      setFloor(await api.getFloor())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
    const es = new EventSource('/api/stream')
    es.onopen = () => setLive(true)
    es.onerror = () => setLive(false) // EventSource reconnects by itself
    es.onmessage = () => void load() // floor-changed / clock-changed (pings use a named event and don't land here)
    const tick = setInterval(() => void load(), 60_000)
    return () => {
      es.close()
      clearInterval(tick)
    }
  }, [load])

  return { floor, error, live, reload: load }
}
