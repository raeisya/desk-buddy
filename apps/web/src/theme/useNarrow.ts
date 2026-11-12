import { useEffect, useState } from 'react'

const QUERY = '(max-width: 760px)' // same breakpoint as the CSS

/** True on phone-width screens; updates when the window is resized or rotated. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
