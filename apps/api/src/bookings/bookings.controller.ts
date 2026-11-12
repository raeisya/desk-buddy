import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';

interface BookingBody {
  deskId?: string;
  userId?: string;
}

/**
 * Identity comes from `userId` in the body for now (persona picker).
 * When C's cookie login lands, replace it with the logged-in user from the session here, so a
 * client can't book as someone else. The frontend doesn't need to change.
 */
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** POST /api/bookings { deskId, userId } — take a desk for today (booked + checked in). */
  @Post()
  claim(@Body() body: BookingBody) {
    const { deskId, userId } = required(body);
    return this.bookings.claim(deskId, userId);
  }

  /** POST /api/bookings/release { deskId, userId } — leave the desk you took today. */
  @Post('release')
  @HttpCode(200)
  release(@Body() body: BookingBody) {
    const { deskId, userId } = required(body);
    return this.bookings.release(deskId, userId);
  }
}

function required(body: BookingBody | undefined): { deskId: string; userId: string } {
  if (!body?.deskId || !body?.userId) throw new BadRequestException('deskId and userId are required');
  return { deskId: body.deskId, userId: body.userId };
}
