import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const TIME_ZONE = 'Asia/Kuala_Lumpur';

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * The single source of "now". Everything time-based (today's date, auto-release)
 * goes through here so the demo clock can fast-forward the whole app.
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;
  readonly releaseCutoff: string;

  constructor(config: ConfigService) {
    this.releaseCutoff = config.get<string>('RELEASE_CUTOFF') ?? '10:00';
  }

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  isDemoTime(): boolean {
    return this.offsetMs !== 0;
  }

  /** Jump the app clock to `iso`; time keeps ticking from there. */
  set(iso: string): void {
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) throw new Error(`Invalid date: ${iso}`);
    this.offsetMs = target - Date.now();
  }

  reset(): void {
    this.offsetMs = 0;
  }

  /** YYYY-MM-DD in Malaysia time. */
  today(): string {
    return dateFmt.format(this.now());
  }

  /** HH:MM in Malaysia time. */
  localTime(): string {
    return timeFmt.format(this.now());
  }

  /** Has the auto-release cutoff passed for `date`? */
  isPastCutoff(date: string): boolean {
    const today = this.today();
    if (date < today) return true;
    if (date > today) return false;
    return this.localTime() >= this.releaseCutoff;
  }
}
