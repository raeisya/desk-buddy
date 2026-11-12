import { Controller, Get } from '@nestjs/common';
import type { HodHeatmapResponse, HodTodayResponse } from '../common/contracts';
import { HodService } from './hod.service';

@Controller('hod')
export class HodController {
  constructor(private readonly hod: HodService) {}

  /** GET /api/hod/today — status counts per team for today (demo clock). */
  @Get('today')
  today(): Promise<HodTodayResponse> {
    return this.hod.today();
  }

  /** GET /api/hod/heatmap — % of desks used per weekday, last 4 weeks. */
  @Get('heatmap')
  heatmap(): Promise<HodHeatmapResponse> {
    return this.hod.heatmap();
  }
}
