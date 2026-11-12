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

    // Only free desks can be taken. An owner who said they're out but came in anyway sees their own
    // desk as free and simply takes it back (it shows as occupied, since owner === booker).
    if (desk.state !== 'available' && desk.state !== 'unassigned') {
      throw new ConflictException(this.whyNot(desk.state));
    }

    // One seat per person. "Seated" includes owners who haven't posted (silent = in the office) — they
    // have no booking, so a bookings-only check would let them appear at two desks at once.
    const seatedAt = desks.find(
      (d) => d.occupant?.id === userId || (d.state === 'occupied' && !d.occupant && d.owner?.id === userId),
    );
    if (seatedAt) {
      throw new ConflictException(
        seatedAt.occupant?.id === userId
          ? `You already have ${seatedAt.id} today. Leave it first.`
          : `You're at your own desk ${seatedAt.id} today.`,
      );
    }

    try {
      const saved = await this.bookings.save(this.bookings.create({ deskId, userId, date, checkedInAt: this.clock.now() }));
      this.events.emit({ type: 'floor-changed', date });
      return { id: saved.id, deskId, userId, date };
    } catch (e) {
      // Lost a race between our checks and the insert; the partial unique indexes decide who wins.
      if (e instanceof QueryFailedError && (e as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        const err = e as QueryFailedError & { constraint?: string; driverError?: { constraint?: string } };
        const constraint = err.driverError?.constraint ?? err.constraint;
        throw new ConflictException(
          constraint === 'uq_bookings_active_user'
            ? 'You already have a desk today. Leave it first.'
            : 'Someone just took that desk. Pick another one.',
        );
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
      case 'occupied':
      case 'hot-seated':
        return 'Someone is already sitting there.';
      default:
        return 'That desk is not free.';
    }
  }
}
