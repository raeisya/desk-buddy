import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import type { Subscription } from 'rxjs';
import { ClockService } from '../common/clock.service';
import type { PresenceStatus } from '../common/contracts';
import { Presence, User } from '../entities';
import { EventsService } from '../events/events.service';
import { PresenceService } from '../presence/presence.service';
import { SlackUsersService } from './slack-users.service';
import { isOwnStatus, slackStatusFor, statusDates, statusFromProfile, statusLabel, type SlackProfileStatus } from './slack-status';

const dateKL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
/** Unix seconds at 23:59:59 tonight, Malaysia time (real clock: Slack expires statuses in real time). */
const endOfTodayKL = () => Math.floor(Date.parse(`${dateKL.format(new Date())}T23:59:59+08:00`) / 1000);
const statusKey = (p: SlackProfileStatus) => `${p.status_emoji ?? ''}|${p.status_text ?? ''}|${p.status_expiration ?? 0}`;
const REVOKED = new Set(['invalid_auth', 'token_revoked', 'account_inactive', 'not_authed']);

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
export class SlackStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SlackStatusService.name);
  /** Last status seen per Slack user, so repeated identical events (Slack sends a few) are no-ops. */
  private readonly lastSeen = new Map<string, string>();
  private sub?: Subscription;

  constructor(
    @InjectRepository(Presence) private readonly presenceRepo: Repository<Presence>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly presence: PresenceService,
    private readonly slackUsers: SlackUsersService,
    private readonly clock: ClockService,
    private readonly events: EventsService,
  ) {}

  // ------------------------------------------------------------ DeskBuddy → Slack (Me page changes)

  onModuleInit(): void {
    // Only today's changes made in DeskBuddy itself (Me page = source 'manual') are mirrored to Slack.
    this.sub = this.events.onPresenceChanged().subscribe((e) => {
      if (e.source === 'manual' && e.date === this.clock.today()) void this.pushToSlack(e.userId, e.status);
    });
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Is this person's Slack status synced (did they Connect Slack on the Me page)? */
  isConnected(userId: string): Promise<boolean> {
    return this.users.existsBy({ id: userId, slackUserToken: Not(IsNull()) });
  }

  /** Save the token from "Connect Slack". Returns the DeskBuddy user it belongs to, or null if not linked. */
  async saveToken(slackUserId: string, token: string): Promise<User | null> {
    const user = await this.slackUsers.find(slackUserId);
    if (!user) return null;
    await this.users.update({ id: user.id }, { slackUserToken: token });
    return user;
  }

  /** Mirror a DeskBuddy status to the person's Slack status. Best effort: failures only log. */
  private async pushToSlack(userId: string, status: PresenceStatus): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, slackId: true, slackUserToken: true } });
    if (!user?.slackUserToken || !user.slackId) return;
    const token = user.slackUserToken;
    try {
      const target = slackStatusFor(status);
      let profile: SlackProfileStatus;
      if (target) {
        profile = { status_emoji: target.emoji, status_text: target.text, status_expiration: endOfTodayKL() };
      } else {
        // Back in the office: clear only a status DeskBuddy set, never someone's own "🎧 Focusing".
        const current = await this.slackApi<{ profile?: SlackProfileStatus }>(token, 'users.profile.get', undefined);
        if (!current.profile || !isOwnStatus(current.profile)) return;
        profile = { status_emoji: '', status_text: '', status_expiration: 0 };
      }
      this.lastSeen.set(user.slackId, statusKey(profile)); // the echo from Slack is then a no-op
      await this.slackApi(token, 'users.profile.set', { profile });
      this.log.log(`Slack status ← DeskBuddy for ${userId}: ${status}`);
    } catch (err) {
      const msg = (err as Error).message;
      this.log.warn(`Slack status push failed for ${userId}: ${msg}`);
      if (REVOKED.has(msg)) await this.users.update({ id: userId }, { slackUserToken: null });
    }
  }

  private async slackApi<T>(token: string, method: string, body: object | undefined): Promise<T> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!json.ok) throw new Error(json.error ?? `${method} failed`);
    return json;
  }

  // ------------------------------------------------------------ Slack → DeskBuddy

  async apply(slackUserId: string, profile: SlackProfileStatus): Promise<StatusApplied | null> {
    const key = statusKey(profile);
    if (this.lastSeen.get(slackUserId) === key) return null;
    this.lastSeen.set(slackUserId, key);
    // A status DeskBuddy set itself: presence is already right (and may be more specific). Leave it.
    if (isOwnStatus(profile)) return null;

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
