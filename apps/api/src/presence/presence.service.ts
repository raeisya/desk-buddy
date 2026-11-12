import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import type { PresenceSource, PresenceStatus } from '../common/contracts';
import { Booking, Presence } from '../entities';
import { EventsService } from '../events/events.service';

export interface SetPresenceInput {
  userId: string;
  status: PresenceStatus;
  date?: string;
  source?: PresenceSource;
  rawMessage?: string | null;
  confidence?: number | null;
}

/**
 * The one write path for presence. The Slack listener (Person A) should call
 * setPresence() too, so every source triggers the same live update.
 */
@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(Presence) private readonly repo: Repository<Presence>,
    private readonly clock: ClockService,
    private readonly events: EventsService,
  ) {}

  async setPresence(input: SetPresenceInput): Promise<Presence> {
    const date = input.date ?? this.clock.today();
    // One transaction: the status and the desk release land together, or neither does.
    await this.repo.manager.transaction(async (tx) => {
      await tx.getRepository(Presence).upsert(
        {
          userId: input.userId,
          date,
          status: input.status,
          source: input.source ?? 'manual',
          rawMessage: input.rawMessage ?? null,
          confidence: input.confidence ?? null,
        },
        ['userId', 'date'],
      );
      // Out TODAY (WFH / MC / LEAVE / OUTSTATION) means you're not at the desk you booked: release it, so
      // the map frees it (you walk out) and your status shows. Applies to Slack posts and the Me page.
      // Only today's: a status for a past day (e.g. a Slack reaction on an old prompt) must not rewrite
      // that day's booking history.
      if (input.status !== 'IN_OFFICE' && date === this.clock.today()) {
        await tx.getRepository(Booking).update({ userId: input.userId, date, releasedAt: IsNull() }, { releasedAt: this.clock.now() });
      }
    });
    this.events.emit({ type: 'floor-changed', date });
    return this.repo.findOneByOrFail({ userId: input.userId, date });
  }

  find(userId: string, date: string): Promise<Presence | null> {
    return this.repo.findOneBy({ userId, date });
  }
}
