import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import type { FloorResponse, PersonRef } from '../common/contracts';
import { Booking, Desk, Presence, User } from '../entities';
import { deriveDeskState } from './derive-desk-state';

const toRef = (u: User | null | undefined): PersonRef | null => (u ? { id: u.id, name: u.name, team: u.team } : null);

@Injectable()
export class FloorService {
  constructor(
    @InjectRepository(Desk) private readonly desks: Repository<Desk>,
    @InjectRepository(Presence) private readonly presence: Repository<Presence>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly clock: ClockService,
  ) {}

  async getFloor(date = this.clock.today()): Promise<FloorResponse> {
    const [desks, presence, bookings] = await Promise.all([
      this.desks.find({ relations: { owner: true }, order: { id: 'ASC' } }),
      this.presence.find({ where: { date } }),
      this.bookings.find({ where: { date, releasedAt: IsNull() }, relations: { user: true } }),
    ]);

    const statusByUser = new Map(presence.map((p) => [p.userId, p.status]));
    const bookingByDesk = new Map(bookings.map((b) => [b.deskId, b]));

    return {
      date,
      now: this.clock.now().toISOString(),
      releaseCutoff: this.clock.releaseCutoff,
      desks: desks.map((d) => {
        const booking = bookingByDesk.get(d.id);
        return {
          id: d.id,
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          zone: d.zone,
          facing: d.facing,
          state: deriveDeskState({
            ownerId: d.ownerId,
            ownerStatus: d.ownerId ? statusByUser.get(d.ownerId) ?? null : null,
            bookedBy: booking?.userId ?? null,
          }),
          owner: toRef(d.owner),
          occupant: toRef(booking?.user),
        };
      }),
    };
  }
}
