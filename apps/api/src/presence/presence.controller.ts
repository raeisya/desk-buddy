import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { PRESENCE_STATUSES, type PresenceStatus } from '../common/contracts';
import { User } from '../entities';
import { PresenceService } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly clock: ClockService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * GET /api/presence/:userId — that person's own status today ({ status: null } if they haven't posted).
   * For the Me page only: it shows the REASON (WFH/MC…), which the floor API deliberately never sends.
   * When cookie login lands, restrict this to the logged-in user.
   */
  @Get(':userId')
  async today(@Param('userId') userId: string): Promise<{ status: PresenceStatus | null }> {
    if (!(await this.users.existsBy({ id: userId }))) throw new NotFoundException(`No user ${userId}`);
    const row = await this.presence.find(userId, this.clock.today());
    return { status: row?.status ?? null };
  }

  /** POST /api/presence { userId, status, date? } — manual status (also handy for testing live updates). */
  @Post()
  async set(@Body() body: { userId?: string; status?: string; date?: string }) {
    if (!body?.userId) throw new BadRequestException('userId is required');
    if (!PRESENCE_STATUSES.includes(body.status as PresenceStatus)) {
      throw new BadRequestException(`status must be one of ${PRESENCE_STATUSES.join(', ')}`);
    }
    if (!(await this.users.existsBy({ id: body.userId }))) throw new NotFoundException(`No user ${body.userId}`);
    return this.presence.setPresence({ userId: body.userId, status: body.status as PresenceStatus, date: body.date });
  }
}
