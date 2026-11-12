/**
 * Coordinate space = the map image's own pixels (origin top-left). desks.json x/y/w/h are in that space.
 * Scaling happens only in CSS (percentages), so the office stays crisp at any width.
 * When C's map image lands: set `src` and its real width/height here.
 */
export const OFFICE_MAP: { width: number; height: number; src: string | null } = {
  width: 800, // placeholder: fits the 10-desk stub (max x 750, max y 206); replace with the real image size
  height: 260,
  src: null, // e.g. '/office-map.png'
}
