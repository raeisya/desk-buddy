import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { Desk, Presence, User } from '../entities';

/**
 * Maps Slack member IDs to demo staff.
 * 1. SLACK_USER_MAP (Railway variable, never committed): "U0AAA:u-meiling,U0BBB:u-hafiz"
 * 2. A link already saved in users.slack_id
 * 3. Auto-link: an unknown Slack user gets the next free desk owner (prefers someone "in office"
 *    today, so their first reaction visibly changes a desk).
 */
@Injectable()
export class SlackUsersService {
  private readonly log = new Logger(SlackUsersService.name);
  private readonly envMap: Map<string, string>;

  constructor(
    config: ConfigService,
    private readonly clock: ClockService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Desk) private readonly desks: Repository<Desk>,
    @InjectRepository(Presence) private readonly presence: Repository<Presence>,
  ) {
    this.envMap = new Map(
      (config.get<string>('SLACK_USER_MAP') ?? '')
        .split(',')
        .map((pair) => pair.split(':').map((s) => s.trim()))
        .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]),
    );
  }

  /** Linked user, or null. Never creates a link. */
  async find(slackId: string): Promise<User | null> {
    const mapped = this.envMap.get(slackId);
    if (mapped) return this.link(slackId, mapped);
    return this.users.findOneBy({ slackId });
  }

  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Linked user, auto-linking a free demo person if needed. `isNew` is true on a fresh auto-link.
   * Runs one at a time, so two new people reacting together can't be given the same person.
   */
  resolve(slackId: string): Promise<{ user: User; isNew: boolean } | null> {
    const run = this.queue.then(() => this.resolveNow(slackId));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async resolveNow(slackId: string): Promise<{ user: User; isNew: boolean } | null> {
    const existing = await this.find(slackId);
    if (existing) return { user: existing, isNew: false };

    const candidate = await this.pickFreeDeskOwner();
    if (!candidate) {
      this.log.warn(`No free demo person left for Slack user ${slackId}`);
      return null;
    }
    const user = await this.link(slackId, candidate);
    this.log.log(`Auto-linked Slack user ${slackId} → ${user?.id}`);
    return user ? { user, isNew: true } : null;
  }

  async deskOf(userId: string): Promise<Desk | null> {
    return this.desks.findOneBy({ ownerId: userId });
  }

  private async link(slackId: string, userId: string): Promise<User | null> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      this.log.warn(`SLACK_USER_MAP points to unknown user ${userId}`);
      return null;
    }
    if (user.slackId === slackId) return user;
    await this.users.update({ slackId }, { slackId: null }); // slack_id is unique
    await this.users.update({ id: userId }, { slackId });
    return { ...user, slackId };
  }

  private async pickFreeDeskOwner(): Promise<string | null> {
    const reserved = [...this.envMap.values()];
    const owned = await this.desks.find({ where: { ownerId: Not(IsNull()) }, order: { id: 'ASC' } });
    const ownerIds = owned.map((d) => d.ownerId!).filter((id) => !reserved.includes(id));
    if (ownerIds.length === 0) return null;

    // Plain staff first: HODs are their own demo persona (dashboard).
    const freeUsers = await this.users.find({ where: { id: In(ownerIds), slackId: IsNull() }, select: { id: true, role: true } });
    const freeStaff = new Set(freeUsers.filter((u) => u.role === 'staff').map((u) => u.id));
    const free = new Set(freeUsers.map((u) => u.id));
    const inOffice = new Set(
      (await this.presence.find({ where: { userId: In(ownerIds), date: this.clock.today(), status: 'IN_OFFICE' } })).map(
        (p) => p.userId,
      ),
    );
    return (
      ownerIds.find((id) => freeStaff.has(id) && inOffice.has(id)) ??
      ownerIds.find((id) => freeStaff.has(id)) ??
      ownerIds.find((id) => free.has(id)) ??
      null
    );
  }
}
