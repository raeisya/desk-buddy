import type { PresenceStatus } from '../common/contracts';
import { addDays, emojiStatus, MIN_CONFIDENCE, parseStatusText } from '../parser/status-parser';

/**
 * Slack profile status → presence (C). People already set "🌴 Vacationing · until Friday" in Slack;
 * that covers planned absence without an HR feed. Pure rules here; SlackStatusService writes them.
 */

/** Emoji that look like a status in a daily-prompt reaction but mean nothing for a profile status. */
const IGNORED_STATUS_EMOJI = new Set([
  'bus', // Slack's "Commuting" preset: on the way in, not outstation
  'car',
  'spiral_calendar_pad', // "In a meeting"
  'calendar',
  'headphones', // "Focusing"
  'office', // "in the office" is the default anyway
]);

/** Suffix on statuses DeskBuddy sets in Slack, so the echo back to us is recognised and ignored. */
export const OWN_SUFFIX = '· DeskBuddy';

export function isOwnStatus(profile: SlackProfileStatus): boolean {
  return (profile.status_text ?? '').trim().endsWith(OWN_SUFFIX);
}

/** What DeskBuddy writes to Slack for a status set on the Me page (null = clear it). */
export function slackStatusFor(status: PresenceStatus): { emoji: string; text: string } | null {
  switch (status) {
    case 'WFH':
      return { emoji: ':house_with_garden:', text: `Working remotely ${OWN_SUFFIX}` };
    case 'MC':
      return { emoji: ':face_with_thermometer:', text: `Out sick ${OWN_SUFFIX}` };
    case 'LEAVE':
      return { emoji: ':palm_tree:', text: `On leave ${OWN_SUFFIX}` };
    case 'OUTSTATION':
      return { emoji: ':briefcase:', text: `Outstation ${OWN_SUFFIX}` };
    case 'IN_OFFICE':
      return null;
  }
}

/** Longest stretch one status can cover, in calendar days from today. */
export const MAX_STATUS_DAYS = 14;

export interface SlackProfileStatus {
  status_text?: string;
  status_emoji?: string;
  /** Unix seconds; 0 = "Don't clear". */
  status_expiration?: number;
}

/** Status from a Slack profile status, or null when it says nothing about where they work. */
export function statusFromProfile(profile: SlackProfileStatus): PresenceStatus | null {
  const text = (profile.status_text ?? '').trim();
  // ":palm_tree::skin-tone-2:" → "palm_tree"
  const emoji = (profile.status_emoji ?? '').replace(/^:|:$/g, '').split('::')[0];
  // Text first: "Out sick" / "Cuti" / "WFH" says more than the emoji someone happened to pick.
  const parsed = text ? parseStatusText(text) : null;
  if (parsed && parsed.confidence >= MIN_CONFIDENCE && parsed.status !== 'IN_OFFICE') return parsed.status;
  if (emoji && !IGNORED_STATUS_EMOJI.has(emoji)) {
    const fromEmoji = emojiStatus(emoji);
    if (fromEmoji && fromEmoji !== 'IN_OFFICE') return fromEmoji;
  }
  return null;
}

const isWeekend = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};

/**
 * Working days the status covers: today up to its expiry date (inclusive), weekends skipped,
 * capped at MAX_STATUS_DAYS. "Don't clear" (no expiry) = today only; it is re-read the next time
 * the app connects or the status changes.
 */
export function statusDates(today: string, expiryDate: string | null): string[] {
  const last = expiryDate && expiryDate > today ? expiryDate : today;
  const out: string[] = [];
  for (let i = 0; i < MAX_STATUS_DAYS; i++) {
    const date = addDays(today, i);
    if (date > last) break;
    if (!isWeekend(date)) out.push(date);
  }
  // A status set on a weekend still counts for that day.
  return out.length ? out : [today];
}

/** Label for the confirmation: "🌴 Vacationing". */
export function statusLabel(profile: SlackProfileStatus): string {
  return [profile.status_emoji, profile.status_text].filter(Boolean).join(' ').trim();
}
