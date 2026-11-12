import { DESK_STATES } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'

export function Legend() {
  return (
    <ul className="legend">
      {DESK_STATES.map((s) => (
        <li key={s}>
          <span className="swatch" style={{ background: DESK_STATE_STYLE[s].color }} />
          {DESK_STATE_STYLE[s].label}
        </li>
      ))}
    </ul>
  )
}
