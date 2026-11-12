import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  /** GET /api/health — point your host's health check here. */
  @Get()
  async check() {
    await this.db.query('SELECT 1');
    return { ok: true };
  }
}
