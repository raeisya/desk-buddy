import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { Booking, User } from '../entities';
import { EventsService } from '../events/events.service';
import { FloorService } from '../floor/floor.service';

export interface BookingResult {
  id: number;
  deskId: string;
  userId: string;
  date: string;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Taking a desk is ONE action: the booking is created already checked in, so the desk turns
 * occupied / hot-seated immediately (agreed: no separate "reserved" state).
 *
 * Double-booking is blocked by partial unique indexes on the bookings table (one active booking per
 * desk per day, one per user per day), so two people tapping the same desk at once can't both win.
 * The checks below only turn the common cases into friendly messages.
 */
@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly floor: FloorService,
    private readonly clock: ClockService,
    private readonly events: EventsService,
  ) {}

  async claim(deskId: string, userId: string): Promise<BookingResult> {
    const date = this.clock.today();
    if (!(await this.users.existsBy({ id: userId }))) throw new NotFoundException(`No user ${userId}`);

    const { desks } = await this.floor.getFloor(date);
    const desk = desks.find((d) => d.id === deskId);
    if (!desk) throw new NotFoundException(`No desk ${deskId}`);

    const isOwner = desk.owner?.id === userId;
    const free = desk.state === 'available' || desk.state === 'unassigned';
    // The owner may always sit at their own desk (that's checking in), unless they already are.
    if (!free && !(isOwner && desk.state !== 'occupied')) {
      throw new ConflictException(this.whyNot(desk.state));
    }

    const existing = await this.bookings.findOneBy({ userId, date, releasedAt: IsNull() });
    if (existing) throw new ConflictException(`You already have ${existing.deskId} today. Leave it first.`);

    try {
      const saved = await this.bookings.save(this.bookings.create({ deskId, userId, date, checkedInAt: this.clock.now() }));
      this.events.emit({ type: 'floor-changed', date });
      return { id: saved.id, deskId, userId, date };
    } catch (e) {
      // Lost a race: someone else took this desk (or this user booked elsewhere) between our check and insert.
      if (e instanceof QueryFailedError && (e as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('Someone just took that desk. Pick another one.');
      }
      throw e;
    }
  }

  async release(deskId: string, userId: string): Promise<{ released: true }> {
    const date = this.clock.today();
    const booking = await this.bookings.findOneBy({ deskId, date, releasedAt: IsNull() });
    if (!booking) throw new NotFoundException(`Nobody is booked on ${deskId} today`);
    if (booking.userId !== userId) throw new ForbiddenException('That desk is booked by someone else');

    await this.bookings.update(booking.id, { releasedAt: this.clock.now() });
    this.events.emit({ type: 'floor-changed', date });
    return { released: true };
  }

  private whyNot(state: string): string {
    switch (state) {
      case 'away':
        return `The owner hasn't checked in yet. The desk frees up at ${this.clock.releaseCutoff} if they don't show.`;
      case 'occupied':
      case 'hot-seated':
        return 'Someone is already sitting there.';
      default:
        return 'That desk is not free.';
    }
  }
}
