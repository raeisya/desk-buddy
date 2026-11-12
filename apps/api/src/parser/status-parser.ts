import type { PresenceStatus } from '../common/contracts';

/**
 * Free, rule-based status parsing. No LLM yet: the LLM parser can later implement the same
 * `parseStatusText` contract and fall back to this when it is unavailable.
 */

export interface ParsedStatus {
  status: PresenceStatus;
  /** Days after the base date ("esok" / "tomorrow" = 1). */
  dayOffset: number;
  /** 0..1. Below MIN_CONFIDENCE we don't write anything. */
  confidence: number;
}

export const MIN_CONFIDENCE = 0.6;

/** Slack emoji name (without colons) → status. Mirrors the daily "where are you working" thread. */
export const EMOJI_STATUS: Record<string, PresenceStatus> = {
  house: 'WFH',
  house_with_garden: 'WFH',
  briefcase: 'OUTSTATION', // alternate office: not at this desk, so it's free
  bus: 'OUTSTATION',
  airplane: 'OUTSTATION',
  // Sick emojis → MC
  face_with_thermometer: 'MC',
  mask: 'MC',
  nauseated_face: 'MC',
  sneezing_face: 'MC',
  face_with_head_bandage: 'MC',
  // Trees / holiday → annual leave
  palm_tree: 'LEAVE',
  deciduous_tree: 'LEAVE',
  evergreen_tree: 'LEAVE',
  desert_island: 'LEAVE',
  beach_with_umbrella: 'LEAVE',
  office: 'IN_OFFICE',
};

/** When one person has several status reactions, the most specific one wins. */
export const STATUS_PRIORITY: PresenceStatus[] = ['MC', 'LEAVE', 'OUTSTATION', 'WFH', 'IN_OFFICE'];

/** "house::skin-tone-2" → "house" */
export function emojiStatus(reaction: string): PresenceStatus | undefined {
  return EMOJI_STATUS[reaction.split('::')[0]];
}

// Checked in STATUS_PRIORITY order. Word boundaries keep "al" from matching "also"/"final".
const RULES: { status: PresenceStatus; re: RegExp }[] = [
  { status: 'MC', re: /\b(mc|sick|unwell|demam|sakit|medical leave)\b|🤒|😷|🤢|🤧|🤕/iu },
  // "leave" alone, but not "leave early" / "leave at 5" / "leave the office".
  { status: 'LEAVE', re: /\b(al|el|cuti|annual leave|off today|day off)\b|\bleave\b(?!\s+(early|at|by|the|office|for|after))|🌴|🌳|🌲|🏝|🏖/iu },
  {
    status: 'OUTSTATION',
    re: /\b(outstation|out station|site|site visit|event|events|alternate office|other office|travell?ing|client office)\b|🚌|💼|✈/i,
  },
  { status: 'WFH', re: /\b(wfh|work(ing)? from home|kerja dari rumah|from home)\b|🏠|🏡/i },
  { status: 'IN_OFFICE', re: /\b(wfo|in office|in the office|at the office|masuk office|in today)\b|🏢/i },
];

const TOMORROW = /\b(esok|besok|tomorrow|tmr|tmrw|tomoro)\b/i;
const TODAY = /\b(today|hari ni|harini)\b/i;

export function parseStatusText(text: string): ParsedStatus | null {
  const matches = RULES.filter((r) => r.re.test(text)).map((r) => r.status);
  if (matches.length === 0) return null;
  const distinct = new Set(matches);
  if (distinct.has('MC')) distinct.delete('LEAVE'); // "medical leave" / "sick leave" is MC
  return {
    status: matches[0],
    // "MC today, back tmr" is about today.
    dayOffset: TOMORROW.test(text) && !TODAY.test(text) ? 1 : 0,
    // Two different statuses in one message ("AL tomorrow, WFH today") is ambiguous for keywords.
    confidence: distinct.size === 1 ? 0.9 : 0.5,
  };
}

/** YYYY-MM-DD + n days (calendar math in UTC, so no timezone drift). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
