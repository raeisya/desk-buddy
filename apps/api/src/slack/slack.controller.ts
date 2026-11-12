import { BadRequestException, Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { SlackService } from './slack.service';

@Controller('slack')
export class SlackController {
  constructor(
    private readonly slack: SlackService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** GET /api/slack/status → { configured, connected }. Quick check that Railway is talking to Slack. */
  @Get('status')
  status() {
    return this.slack.status();
  }

  /** POST /api/slack/daily-prompt: the bot posts today's "where are you working" message. */
  @Post('daily-prompt')
  dailyPrompt() {
    return this.slack.postDailyPrompt();
  }

  /** POST /api/slack/status-sync: re-read everyone's Slack profile status now (demo helper; needs users:read). */
  @Post('status-sync')
  statusSync() {
    return this.slack.syncStatuses();
  }

  /** POST /api/slack/inject { userId, text }: demo fallback (plan P2), no Slack needed. */
  @Post('inject')
  async inject(@Body() body: { userId?: string; text?: string }) {
    if (!body?.userId || !body?.text?.trim()) throw new BadRequestException('userId and text are required');
    if (!(await this.users.existsBy({ id: body.userId }))) throw new NotFoundException(`No user ${body.userId}`);
    return this.slack.injectText(body.userId, body.text);
  }
}
