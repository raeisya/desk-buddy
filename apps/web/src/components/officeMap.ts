/**
 * Coordinate space = the map image's own pixels (origin top-left). desks.json x/y/w/h are in that space.
 * Scaling happens only in CSS (percentages), so the office stays crisp at any width.
 * When C's map image lands: set `src` and its real width/height here.
 */
export const OFFICE_MAP: { width: number; height: number; src: string | null } = {
  width: 1280, // matches scripts/generate-floor.mjs (40×24 tiles of 32 px)
  height: 768,
  src: null, // e.g. '/office-map.png'
}
