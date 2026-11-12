import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import type { DeskFacing, PresenceStatus, Role } from '../common/contracts';
import { Desk, Presence, User } from '../entities';
import desksJson from './data/desks.json';
import presenceTodayJson from './data/presence-today.json';
import usersJson from './data/users.json';

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
    }

    const today = this.clock.today();
    if ((await this.presence.countBy({ date: today })) === 0) {
      await this.presence.insert(
        presenceTodayJson.map((p) => ({ userId: p.userId, status: p.status as PresenceStatus, date: today, source: 'seed' as const })),
      );
      this.log.log(`Seeded ${presenceTodayJson.length} presence rows for ${today}`);
    }
  }
}
