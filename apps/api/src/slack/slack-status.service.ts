import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import type { PresenceStatus } from '../common/contracts';
import { Presence } from '../entities';
import { EventsService } from '../events/events.service';
import { PresenceService } from '../presence/presence.service';
import { SlackUsersService } from './slack-users.service';
import { statusDates, statusFromProfile, statusLabel, type SlackProfileStatus } from './slack-status';

export const STATUS_SOURCE = 'slack-status' as const;

export interface StatusApplied {
  userId: string;
  name: string;
  /** null = the status was cleared (or says nothing about where they work). */
  status: PresenceStatus | null;
  dates: string[];
  label: string;
  deskId: string | null;
}

/**
 * Writes a Slack profile status into presence (C), through the same setPresence() path as posts,
 * so the map updates live. Latest signal wins: a new status overwrites those days whatever set them.
 * On clear or change, only rows this source wrote (today onwards) are removed: posts and Me-page
 * fixes stay. Never auto-links: only people already linked to a DeskBuddy user count.
 */
@Injectable()
export class SlackStatusService {
  private readonly log = new Logger(SlackStatusService.name);
  /** Last status seen per Slack user, so repeated identical events (Slack sends a few) are no-ops. */
  private readonly lastSeen = new Map<string, string>();

  constructor(
    @InjectRepository(Presence) private readonly presenceRepo: Repository<Presence>,
    private readonly presence: PresenceService,
    private readonly slackUsers: SlackUsersService,
    private readonly clock: ClockService,
    private readonly events: EventsService,
  ) {}

  async apply(slackUserId: string, profile: SlackProfileStatus): Promise<StatusApplied | null> {
    const key = `${profile.status_emoji ?? ''}|${profile.status_text ?? ''}|${profile.status_expiration ?? 0}`;
    if (this.lastSeen.get(slackUserId) === key) return null;
    this.lastSeen.set(slackUserId, key);

    const user = await this.slackUsers.find(slackUserId);
    if (!user) return null;

    const today = this.clock.today();
    const status = statusFromProfile(profile);
    const expiry = profile.status_expiration ? this.clock.appDateOf(profile.status_expiration * 1000) : null;
    const dates = status ? statusDates(today, expiry) : [];

    // Replace whatever an earlier status wrote from today on; other sources are left alone.
    const removed = await this.presenceRepo.delete({ userId: user.id, source: STATUS_SOURCE, date: MoreThanOrEqual(today) });
    for (const date of dates) {
      await this.presence.setPresence({ userId: user.id, status: status!, date, source: STATUS_SOURCE, rawMessage: statusLabel(profile), confidence: 1 });
    }
    if (!dates.length && removed.affected) this.events.emit({ type: 'floor-changed', date: today });
    if (!dates.length && !removed.affected) return null; // nothing to say: e.g. "In a meeting"

    const desk = await this.slackUsers.deskOf(user.id);
    this.log.log(`Slack status ${user.id}: ${status ?? 'cleared'} ${dates.join(',')}`);
    return { userId: user.id, name: user.name, status, dates, label: statusLabel(profile), deskId: desk?.id ?? null };
  }
}
