import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import {
  PRESENCE_STATUSES,
  type HodHeatmapResponse,
  type HodTeamToday,
  type HodTodayResponse,
  type PresenceStatus,
} from '../common/contracts';
import { Desk, Presence, User } from '../entities';

const DAY_MS = 86_400_000;
const WEEKS = 4;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

@Injectable()
export class HodService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Desk) private readonly desks: Repository<Desk>,
    @InjectRepository(Presence) private readonly presence: Repository<Presence>,
    private readonly clock: ClockService,
  ) {}

  /** Per-team status counts for today. */
  async today(): Promise<HodTodayResponse> {
    const date = this.clock.today();
    const [users, rows] = await Promise.all([
      this.users.find({ where: { active: true }, select: { id: true, team: true } }),
      this.presence.find({ where: { date }, select: { userId: true, status: true } }),
    ]);
    const statusByUser = new Map(rows.map((r) => [r.userId, r.status]));

    const teams = new Map<string, HodTeamToday>();
    for (const u of users) {
      let t = teams.get(u.team);
      if (!t) {
        const counts = Object.fromEntries(PRESENCE_STATUSES.map((s) => [s, 0])) as Record<PresenceStatus, number>;
        t = { team: u.team, total: 0, counts, noUpdate: 0 };
        teams.set(u.team, t);
      }
      t.total++;
      const status = statusByUser.get(u.id);
      if (status) t.counts[status]++;
      else t.noUpdate++;
    }
    return { date, teams: [...teams.values()].sort((a, b) => a.team.localeCompare(b.team)) };
  }

  /** Desk occupancy per weekday for the last 4 weeks (this week included; today onwards is null). */
  async heatmap(): Promise<HodHeatmapResponse> {
    const today = this.clock.today();
    const t = toDate(today).getTime();
    const thisMonday = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS;
    const firstMonday = thisMonday - (WEEKS - 1) * 7 * DAY_MS;

    const [totalDesks, rows] = await Promise.all([
      this.desks.count(),
      this.presence
        .createQueryBuilder('p')
        // ::text — a raw DATE comes back as a JS Date at server-local midnight, which shifts a day in UTC.
        .select('p.date::text', 'date')
        .addSelect('COUNT(*)::int', 'n')
        .where({ status: 'IN_OFFICE', date: Between(fmt(firstMonday), fmt(t - DAY_MS)) })
        .groupBy('p.date')
        .getRawMany<{ date: string; n: number }>(),
    ]);
    const inOfficeByDate = new Map(rows.map((r) => [r.date, r.n]));

    const weeks = Array.from({ length: WEEKS }, (_, w) => {
      const monday = firstMonday + w * 7 * DAY_MS;
      return {
        weekStart: fmt(monday),
        days: Array.from({ length: 5 }, (_, d) => {
          const date = fmt(monday + d * DAY_MS);
          if (date >= today) return { date, inOffice: null, occupancy: null };
          const inOffice = inOfficeByDate.get(date) ?? 0;
          const occupancy = totalDesks ? Math.round((Math.min(inOffice, totalDesks) / totalDesks) * 100) : 0;
          return { date, inOffice, occupancy };
        }),
      };
    });
    return { totalDesks, weeks };
  }
}
