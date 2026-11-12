import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PRESENCE_STATUSES, type PresenceStatus } from '../common/contracts';
import { User } from '../entities';
import { PresenceService } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

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
