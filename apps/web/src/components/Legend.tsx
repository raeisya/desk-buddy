/**
 * Only what you can't tell by looking: occupied is obvious (someone is sitting there), and
 * "available" vs "unassigned" look the same on the map and mean the same to the viewer —
 * you can take it. Swatches are outlines, matching the desk markers on the map.
 */
const ENTRIES = [
  { label: 'Available', color: 'var(--desk-available)' },
  { label: 'Hot-seated', color: 'var(--desk-hot)' },
] as const

export function Legend() {
  return (
    <ul className="legend">
      {ENTRIES.map((e) => (
        <li key={e.label}>
          <span className="swatch" style={{ background: 'transparent', boxShadow: `inset 0 0 0 3px ${e.color}` }} />
          {e.label}
        </li>
      ))}
    </ul>
  )
}
