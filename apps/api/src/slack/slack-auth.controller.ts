import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { SlackUsersService } from './slack-users.service';

const STATE_COOKIE = 'slack_oauth_state';
const COOKIE_PATH = '/api/auth/slack';

/**
 * "Sign in with Slack" (OpenID Connect). Needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.
 * The demo has no sessions: on success we send the browser to `/#slack=<userId>` and the web app
 * picks that persona, exactly like clicking a persona card. On any failure: `/#slack=error`.
 */
@Controller('auth/slack')
export class SlackAuthController {
  private readonly log = new Logger(SlackAuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly slackUsers: SlackUsersService,
  ) {}

  /** GET /api/auth/slack — send the browser to Slack's sign-in page. */
  @Get()
  start(@Req() req: Request, @Res() res: Response) {
    const clientId = this.config.get<string>('SLACK_CLIENT_ID');
    if (!clientId || !this.config.get<string>('SLACK_CLIENT_SECRET')) {
      this.log.warn('Sign in with Slack disabled: set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET');
      return res.redirect('/#slack=error');
    }

    // Random state in a short-lived cookie, checked on the way back (stops forged callbacks).
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      path: COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });

    const url = new URL('https://slack.com/openid/connect/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      scope: 'openid profile',
      client_id: clientId,
      state,
      redirect_uri: this.redirectUri(req),
    }).toString();
    return res.redirect(url.toString());
  }

  /** GET /api/auth/slack/callback — Slack sends the user back here with a one-time code. */
  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const expected = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: COOKIE_PATH });

    try {
      if (!code || !state || !expected || !sameString(state, expected)) throw new Error('missing or mismatched state');

      const slackId = await this.slackUserId(code, this.redirectUri(req));
      const result = await this.slackUsers.resolve(slackId);
      if (!result) throw new Error(`no demo person available for Slack user ${slackId}`);

      this.log.log(`Slack sign-in: ${slackId} → ${result.user.id}`);
      return res.redirect(`/#slack=${encodeURIComponent(result.user.id)}`);
    } catch (err) {
      this.log.warn(`Slack sign-in failed: ${(err as Error).message}`);
      return res.redirect('/#slack=error');
    }
  }

  /** Swap the code for a token, then ask Slack who the user is. Returns the Slack member ID (U…). */
  private async slackUserId(code: string, redirectUri: string): Promise<string> {
    const tokenRes = await fetch('https://slack.com/api/openid.connect.token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>('SLACK_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('SLACK_CLIENT_SECRET'),
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = (await tokenRes.json()) as { ok: boolean; error?: string; access_token?: string };
    if (!token.ok || !token.access_token) throw new Error(`token exchange: ${token.error ?? 'no access_token'}`);

    const infoRes = await fetch('https://slack.com/api/openid.connect.userInfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = (await infoRes.json()) as { ok: boolean; error?: string; sub?: string; 'https://slack.com/user_id'?: string };
    const slackId = info['https://slack.com/user_id'] ?? info.sub;
    if (!info.ok || !slackId) throw new Error(`userInfo: ${info.error ?? 'no user id'}`);
    return slackId;
  }

  /** Must match a Redirect URL registered in the Slack app (Slack rejects anything else). */
  private redirectUri(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? req.protocol;
    return `${proto}://${req.get('host')}/api/auth/slack/callback`;
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
