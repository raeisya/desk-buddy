import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Logger, NotFoundException, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { SlackStatusService } from './slack-status.service';

const STATE_COOKIE = 'slack_status_state';
const COOKIE_PATH = '/api/auth/slack';
/** User token scopes: read + set the person's own Slack status. */
const USER_SCOPES = 'users.profile:read,users.profile:write';

/**
 * "Connect Slack" on the Me page (C): the person lets DeskBuddy set their Slack status, so a status
 * changed in DeskBuddy shows in Slack too. Separate from "Sign in with Slack" (OpenID Connect can't
 * grant users.profile:write). The callback path sits under the sign-in callback URL, so the Slack app's
 * existing Redirect URL covers it. Needs SLACK_CLIENT_ID/SECRET, the two User Token Scopes above on the
 * Slack app, and SLACK_STATUS_SYNC=on. Off by default: without the scopes Slack shows an error page, so the
 * Me page hides the button. Reading statuses (Slack → DeskBuddy) works either way.
 */
@Controller()
export class SlackStatusController {
  private readonly log = new Logger(SlackStatusController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly slackStatus: SlackStatusService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** GET /api/slack/status-link?userId= → { available, connected } for the Me page. */
  @Get('slack/status-link')
  async link(@Query('userId') userId?: string): Promise<{ available: boolean; connected: boolean }> {
    if (!userId || !(await this.users.existsBy({ id: userId }))) throw new NotFoundException('No such user');
    return { available: this.available(), connected: await this.slackStatus.isConnected(userId) };
  }

  /** Two-way sync is switched on and the Slack app keys are set. */
  private available(): boolean {
    return (
      this.config.get<string>('SLACK_STATUS_SYNC') === 'on' &&
      !!this.config.get<string>('SLACK_CLIENT_ID') &&
      !!this.config.get<string>('SLACK_CLIENT_SECRET')
    );
  }

  /** GET /api/auth/slack/status — send the browser to Slack's "Allow DeskBuddy to…" page. */
  @Get('auth/slack/status')
  start(@Req() req: Request, @Res() res: Response) {
    const clientId = this.config.get<string>('SLACK_CLIENT_ID');
    if (!clientId || !this.available()) return res.redirect('/#slack-status=error');
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      path: COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.search = new URLSearchParams({ client_id: clientId, user_scope: USER_SCOPES, state, redirect_uri: this.redirectUri(req) }).toString();
    return res.redirect(url.toString());
  }

  /** GET /api/auth/slack/callback/status — Slack sends the person back with a one-time code. */
  @Get('auth/slack/callback/status')
  async callback(@Req() req: Request, @Res() res: Response, @Query('code') code?: string, @Query('state') state?: string) {
    const expected = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: COOKIE_PATH });
    try {
      if (!code || !state || !expected || !sameString(state, expected)) throw new Error('missing or mismatched state');
      const r = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.getOrThrow<string>('SLACK_CLIENT_ID'),
          client_secret: this.config.getOrThrow<string>('SLACK_CLIENT_SECRET'),
          code,
          redirect_uri: this.redirectUri(req),
        }),
      });
      const body = (await r.json()) as { ok: boolean; error?: string; authed_user?: { id?: string; access_token?: string } };
      const slackId = body.authed_user?.id;
      const token = body.authed_user?.access_token;
      if (!body.ok || !slackId || !token) throw new Error(`oauth.v2.access: ${body.error ?? 'no user token'}`);
      const user = await this.slackStatus.saveToken(slackId, token);
      if (!user) throw new Error(`Slack user ${slackId} is not linked to a DeskBuddy person`);
      this.log.log(`Slack status connected: ${slackId} → ${user.id}`);
      return res.redirect(`/#slack-status=ok`);
    } catch (err) {
      this.log.warn(`Connect Slack failed: ${(err as Error).message}`);
      return res.redirect('/#slack-status=error');
    }
  }

  private redirectUri(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? req.protocol;
    return `${proto}://${req.get('host')}/api/auth/slack/callback/status`;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
