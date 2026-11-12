import { BadRequestException, Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import type { ClockResponse } from './contracts';
import { ClockService } from './clock.service';

// Demo clock: lets the presenter fast-forward past the release cutoff on stage.
@Controller('clock')
export class ClockController {
  constructor(private readonly clock: ClockService, private readonly events: EventsService) {}

  @Get()
  get(): ClockResponse {
    return {
      now: this.clock.now().toISOString(),
      today: this.clock.today(),
      localTime: this.clock.localTime(),
      releaseCutoff: this.clock.releaseCutoff,
      isDemoTime: this.clock.isDemoTime(),
    };
  }

  @Put()
  set(@Body() body: { now?: string }): ClockResponse {
    if (!body?.now) throw new BadRequestException('Body must be { "now": "<ISO timestamp>" }');
    try {
      this.clock.set(body.now);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    this.events.emit({ type: 'clock-changed', now: this.clock.now().toISOString() });
    return this.get();
  }

  @Delete()
  reset(): ClockResponse {
    this.clock.reset();
    this.events.emit({ type: 'clock-changed', now: this.clock.now().toISOString() });
    return this.get();
  }
}
