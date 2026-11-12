import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UserSummary } from '../common/contracts';
import { User } from '../entities';

@Controller('users')
export class UsersController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** GET /api/users — for the persona switcher. */
  @Get()
  async list(): Promise<UserSummary[]> {
    const users = await this.users.find({ order: { team: 'ASC', name: 'ASC' } });
    return users.map(({ id, name, team, role }) => ({ id, name, team, role }));
  }
}
