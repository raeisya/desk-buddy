/**
 * Short name for map tags. Malay, Indian and Western names lead with the given name ("Hafiz Rahim" → Hafiz),
 * but Chinese names are usually surname-first ("Tan Mei Ling" → Mei Ling).
 * Heuristic tuned to the fictional seed data; full names stay in the tooltip and the desk panel.
 */
const SURNAME_FIRST = new Set([
  'Chan', 'Cheah', 'Chew', 'Chin', 'Chong', 'Chua', 'Foo', 'Goh', 'Ho', 'Khoo', 'Koh', 'Kwan', 'Lai', 'Lau', 'Lee',
  'Leong', 'Lim', 'Loh', 'Low', 'Ng', 'Ong', 'Ooi', 'Tan', 'Tay', 'Teh', 'Teoh', 'Tey', 'Thong', 'Wong', 'Yap', 'Yeoh',
])

// Malay names often start with a prefix the person isn't called by ("Siti Aisyah" goes by Aisyah).
const MALAY_PREFIX = new Set(['Mohd', 'Muhammad', 'Muhd', 'Nor', 'Nur', 'Nurul', 'Siti'])

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 3 && SURNAME_FIRST.has(parts[0])) return `${parts[1]} ${parts[2]}`
  if (parts.length >= 2 && MALAY_PREFIX.has(parts[0])) return parts[1]
  return parts[0] ?? fullName
}
