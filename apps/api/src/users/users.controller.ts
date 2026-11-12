import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { HAIR_STYLES, PANTS_COLOURS, SKIN_TONES, type AvatarConfig, type UserSummary } from '../common/contracts';
import { User } from '../entities';
import { EventsService } from '../events/events.service';

const HEX = /^#[0-9a-f]{6}$/i;

/** Validates a look from the client; returns a clean copy (no extra fields stored). */
function parseAvatar(body: unknown): AvatarConfig {
  const b = (body ?? {}) as Partial<Record<keyof AvatarConfig, unknown>>;
  const bad = (field: string) => new BadRequestException(`avatar.${field} is invalid`);
  if (!HAIR_STYLES.includes(b.style as never)) throw bad('style');
  if (typeof b.hair !== 'string' || !HEX.test(b.hair)) throw bad('hair');
  if (!SKIN_TONES.includes(b.skin as never)) throw bad('skin');
  if (typeof b.shirt !== 'string' || !HEX.test(b.shirt)) throw bad('shirt');
  if (!PANTS_COLOURS.includes(b.pants as never)) throw bad('pants');
  return {
    style: b.style as AvatarConfig['style'],
    hair: (b.hair as string).toLowerCase(),
    skin: b.skin as AvatarConfig['skin'],
    shirt: (b.shirt as string).toLowerCase(),
    pants: b.pants as AvatarConfig['pants'],
  };
}

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly events: EventsService,
    private readonly clock: ClockService,
  ) {}

  /** GET /api/users — for the persona switcher. Active people only (admin page lists everyone). */
  @Get()
  async list(): Promise<UserSummary[]> {
    const users = await this.users.find({ where: { active: true }, order: { team: 'ASC', name: 'ASC' } });
    return users.map(({ id, name, team, role, avatar }) => ({ id, name, team, role, avatar: avatar ?? null }));
  }

  /**
   * PUT /api/users/:id/avatar { style, hair, skin, shirt, pants } — save your character look.
   * Body { reset: true } goes back to the default preset. Every open map updates live.
   * Like bookings/presence, identity comes from the request until server-side login lands.
   */
  @Put(':id/avatar')
  async setAvatar(@Param('id') id: string, @Body() body: unknown): Promise<{ avatar: AvatarConfig | null }> {
    if (!(await this.users.existsBy({ id }))) throw new NotFoundException(`No user ${id}`);
    const reset = typeof body === 'object' && body !== null && (body as { reset?: unknown }).reset === true;
    const avatar = reset ? null : parseAvatar(body);
    await this.users.update(id, { avatar });
    this.events.emit({ type: 'floor-changed', date: this.clock.today() });
    return { avatar };
  }
}
