import { useLang } from '../i18n/lang'

/**
 * Only what you can't tell by looking: occupied is obvious (someone is sitting there), and
 * "available" vs "unassigned" look the same on the map and mean the same to the viewer —
 * you can take it. Swatches are outlines, matching the desk markers on the map.
 */
const ENTRIES = [
  { label: 'legendAvailable', color: 'var(--desk-available)' },
  { label: 'legendHot', color: 'var(--desk-hot)' },
] as const

export function Legend() {
  const { t } = useLang()
  return (
    <ul className="legend">
      {ENTRIES.map((e) => (
        <li key={e.label}>
          <span className="swatch" style={{ background: 'transparent', boxShadow: `inset 0 0 0 3px ${e.color}` }} />
          {t(e.label)}
        </li>
      ))}
    </ul>
  )
}
