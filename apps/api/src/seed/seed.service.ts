import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import type { DeskFacing, PresenceStatus, Role } from '../common/contracts';
import { Desk, Presence, User } from '../entities';
import desksJson from './data/desks.json';
import presenceTodayJson from './data/presence-today.json';
import usersJson from './data/users.json';
import { generateHistory } from './history';

/** Team names before the rename. The live DB was seeded with these; map them over on boot. */
const TEAM_RENAMES: Record<string, string> = {
  Platform: 'CityOS',
  Data: 'SpatialQ',
  Mobile: 'ModelChecker',
  'Product & Design': 'Product',
  QA: 'DevOps',
  Corporate: 'Business Development',
};

/**
 * Stub seed (10 desks) so the frontend has something to render.
 * Person C replaces data/*.json with the full fictional floor + history.
 * Idempotent: only inserts into empty tables / an empty day.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Desk) private readonly desks: Repository<Desk>,
    @InjectRepository(Presence) private readonly presence: Repository<Presence>,
    private readonly clock: ClockService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.users.count()) === 0) {
      await this.users.insert(usersJson.map((u) => ({ ...u, role: u.role as Role })));
      await this.desks.insert(desksJson.map((d) => ({ ...d, facing: d.facing as DeskFacing })));
      this.log.log(`Seeded ${usersJson.length} users and ${desksJson.length} desks`);
    } else {
      await this.syncSeedUsers();
    }

    const today = this.clock.today();
    if ((await this.presence.countBy({ date: today })) === 0) {
      await this.presence.insert(
        presenceTodayJson.map((p) => ({ userId: p.userId, status: p.status as PresenceStatus, date: today, source: 'seed' as const })),
      );
      this.log.log(`Seeded ${presenceTodayJson.length} presence rows for ${today}`);
    }

    // 4 weeks of history for the HOD heatmap. ON CONFLICT DO NOTHING on (user_id, date):
    // fills gaps only, never overwrites real (Slack/manual) rows, safe to run every boot.
    const users = await this.users.find({ select: { id: true, role: true } });
    const history = generateHistory(users, today).map((h) => ({ ...h, source: 'seed' as const }));
    const result = await this.presence.createQueryBuilder().insert().values(history).orIgnore().execute();
    const inserted = result.identifiers.filter(Boolean).length;
    if (inserted) this.log.log(`Seeded ${inserted} presence history rows (past 20 weekdays)`);
  }

  /**
   * An existing DB keeps its users, so carry seed renames over: old team names → new ones, and display
   * names from users.json. Teams are renamed (not reset), so an admin's team changes survive. Safe every boot.
   */
  private async syncSeedUsers(): Promise<void> {
    for (const [from, to] of Object.entries(TEAM_RENAMES)) await this.users.update({ team: from }, { team: to });
    const current = new Map((await this.users.find({ select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const renamed = usersJson.filter((u) => current.has(u.id) && current.get(u.id) !== u.name);
    for (const u of renamed) await this.users.update({ id: u.id }, { name: u.name });
    if (renamed.length) this.log.log(`Updated ${renamed.length} seed user names`);
    // People added to users.json later (e.g. John). Never re-adds anyone: users are deactivated, not deleted.
    const added = usersJson.filter((u) => !current.has(u.id));
    if (added.length) {
      await this.users.insert(added.map((u) => ({ ...u, role: u.role as Role })));
      this.log.log(`Added ${added.length} new seed users`);
    }
  }
}
