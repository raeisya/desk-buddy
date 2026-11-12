import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { FloorResponse } from '../common/contracts';
import { FloorService } from './floor.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('floor')
export class FloorController {
  constructor(private readonly floor: FloorService) {}

  /** GET /api/floor?date=YYYY-MM-DD (defaults to today on the demo clock) */
  @Get()
  get(@Query('date') date?: string): Promise<FloorResponse> {
    if (date && !DATE_RE.test(date)) throw new BadRequestException('date must be YYYY-MM-DD');
    return this.floor.getFloor(date);
  }
}
