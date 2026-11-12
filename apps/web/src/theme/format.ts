import type { FloorResponse } from '../api/contracts'

const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short' })

/** "Thu 12 Nov" for the floor's (demo) date, Malaysia time. */
export function floorDay(floor: FloorResponse): string {
  return fmtDay.format(new Date(floor.now))
}
