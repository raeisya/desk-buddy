import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, LogLevel, type types } from '@slack/bolt';

type ReactionAddedEvent = types.ReactionAddedEvent;
type ReactionRemovedEvent = types.ReactionRemovedEvent;
import { ClockService } from '../common/clock.service';
import type { PresenceStatus } from '../common/contracts';
import { addDays, emojiStatus, MIN_CONFIDENCE, parseStatusText, STATUS_PRIORITY } from '../parser/status-parser';
import { PresenceService } from '../presence/presence.service';
import { SlackUsersService } from './slack-users.service';

/** The daily "where are you working today" message. Any bot or person may post it. */
export const DAILY_PROMPT_RE = /provide your update/i;

// Demo stand-in for the company's daily bot. Fictional offices only: the repo is public.
const DAILY_PROMPT_TEXT = [
  'Morning team, please provide your update and plans for the day in the thread below:',
  '',
  'Also do indicate where you will be working today.',
  '',
  ':house: working from home (only when necessary!) - avoid Monday and Friday',
  ':briefcase: working from alternate office (Acme Hub 2)',
  ':bus: attending events / outstation',
  ':face_with_thermometer: MC',
  ':palm_tree: annual leave (AL)',
  '',
  'You can also just reply "AL" or "MC" in the thread.',
].join('\n');

const STATUS_LABEL: Record<PresenceStatus, string> = {
  IN_OFFICE: 'in the office',
  WFH: 'working from home',
  OUTSTATION: 'out (outstation / other office)',
  MC: 'on MC',
  LEAVE: 'on leave',
};

const tsToMs = (ts: string) => Math.round(Number(ts) * 1000);

/**
 * Slack (Socket Mode) → presence. Reactions on the daily prompt and status replies become
 * presence rows through PresenceService.setPresence(), which pushes the live map update.
 * Starts only when SLACK_BOT_TOKEN, SLACK_APP_TOKEN and SLACK_CHANNEL_ID are all set.
 */
@Injectable()
export class SlackService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(SlackService.name);
  private app?: App;
  private connected = false;
  private readonly channelId?: string;
  private readonly promptCache = new Map<string, boolean>();

  constructor(
    private readonly config: ConfigService,
    private readonly clock: ClockService,
    private readonly presence: PresenceService,
    private readonly slackUsers: SlackUsersService,
  ) {
    this.channelId = config.get<string>('SLACK_CHANNEL_ID') || undefined;
  }

  onApplicationBootstrap(): void {
    // Don't block (or crash) API startup on Slack.
    void this.start().catch((err) => this.log.error(`Slack failed to start: ${(err as Error).message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connected) await this.app?.stop().catch(() => undefined);
  }

  status() {
    return { configured: !!this.app, connected: this.connected };
  }

  // ---------------------------------------------------------------- startup

  private async start(): Promise<void> {
    const token = this.config.get<string>('SLACK_BOT_TOKEN');
    const appToken = this.config.get<string>('SLACK_APP_TOKEN');
    if (!token || !appToken || !this.channelId) {
      this.log.warn('Slack disabled: set SLACK_BOT_TOKEN, SLACK_APP_TOKEN and SLACK_CHANNEL_ID to enable it');
      return;
    }

    this.app = new App({ token, appToken, socketMode: true, logLevel: LogLevel.WARN });
    this.app.event('reaction_added', ({ event }) => this.safely('reaction_added', () => this.onReactionAdded(event)));
    this.app.event('reaction_removed', ({ event }) => this.safely('reaction_removed', () => this.onReactionRemoved(event)));
    this.app.event('message', ({ event }) => this.safely('message', () => this.onMessage(event as unknown as Record<string, unknown>)));
    this.app.error(async (err) => this.log.error(`Slack error: ${err.message}`));

    await this.app.start();
    this.connected = true;
    this.log.log('Slack connected (Socket Mode)');
  }

  private async safely(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.log.error(`Slack ${name} handler failed: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------- handlers

  private async onReactionAdded(event: ReactionAddedEvent): Promise<void> {
    if (event.item.type !== 'message' || event.item.channel !== this.channelId) return;
    const status = emojiStatus(event.reaction);
    if (!status || !(await this.isDailyPrompt(event.item.ts))) return;

    const resolved = await this.slackUsers.resolve(event.user);
    if (!resolved) return;
    const date = this.clock.appDateOf(tsToMs(event.item.ts));
    await this.presence.setPresence({
      userId: resolved.user.id,
      status,
      date,
      source: 'slack',
      rawMessage: `:${event.reaction}:`,
      confidence: 1,
    });
    await this.confirm(event.user, resolved.user.id, resolved.user.name, status, date, resolved.isNew);
  }

  private async onReactionRemoved(event: ReactionRemovedEvent): Promise<void> {
    if (event.item.type !== 'message' || event.item.channel !== this.channelId) return;
    if (!emojiStatus(event.reaction) || !(await this.isDailyPrompt(event.item.ts))) return;

    const user = await this.slackUsers.find(event.user);
    if (!user) return;
    const date = this.clock.appDateOf(tsToMs(event.item.ts));

    // Only undo what this emoji set. A later text reply ("MC") must survive it.
    const current = await this.presence.find(user.id, date);
    if (current?.rawMessage !== `:${event.reaction}:`) return;

    // They may still have another status reaction on the same message: fall back to it.
    const res = await this.app!.client.reactions.get({ channel: event.item.channel, timestamp: event.item.ts, full: true });
    const remaining = (res.message?.reactions ?? [])
      .filter((r) => r.users?.includes(event.user) && emojiStatus(r.name ?? ''))
      .map((r) => ({ name: r.name!, status: emojiStatus(r.name!)! }));
    const next = STATUS_PRIORITY.map((s) => remaining.find((r) => r.status === s)).find(Boolean);

    // No status emoji left = "I'm coming in after all" (e.g. half-day leave, back after lunch).
    const status: PresenceStatus = next?.status ?? 'IN_OFFICE';
    await this.presence.setPresence({
      userId: user.id,
      status,
      date,
      source: 'slack',
      rawMessage: next ? `:${next.name}:` : `removed :${event.reaction}:`,
      confidence: 1,
    });
    await this.confirm(event.user, user.id, user.name, status, date, false);
  }

  private async onMessage(event: Record<string, unknown>): Promise<void> {
    const channel = this.channelId!;
    const ts = event.ts as string | undefined;
    const text = (event.text as string | undefined) ?? '';
    if (event.channel !== channel || !ts) return;
    const threadTs = event.thread_ts as string | undefined;

    // Remember the daily prompt: a top-level post with the phrase, whoever posted it
    // (the company bot arrives as a 'bot_message' subtype).
    if (!threadTs && DAILY_PROMPT_RE.test(text)) {
      this.rememberPrompt(ts, true);
      return;
    }
    // Only plain human messages from here: no edits, deletes, joins or bot posts.
    if (event.subtype !== undefined || event.bot_id || typeof event.user !== 'string') return;
    // Only replies under the daily prompt count. General channel chatter is ignored.
    if (!threadTs || !(await this.isDailyPrompt(threadTs))) return;

    const parsed = parseStatusText(text);
    if (!parsed || parsed.confidence < MIN_CONFIDENCE) {
      await this.ephemeral(event.user, threadTs, 'I couldn\'t tell your status from that. React on the post above, or reply "AL" / "MC".');
      return;
    }

    const resolved = await this.slackUsers.resolve(event.user);
    if (!resolved) return;
    const date = addDays(this.clock.appDateOf(tsToMs(threadTs)), parsed.dayOffset);
    await this.presence.setPresence({
      userId: resolved.user.id,
      status: parsed.status,
      date,
      source: 'slack',
      rawMessage: text,
      confidence: parsed.confidence,
    });
    await this.app!.client.reactions.add({ channel, timestamp: ts, name: 'white_check_mark' }).catch(() => undefined);
    await this.confirm(event.user, resolved.user.id, resolved.user.name, parsed.status, date, resolved.isNew, threadTs);
  }

  // ---------------------------------------------------------------- demo / P2 helpers

  /** Posts the daily prompt (stands in for the company's daily bot in the test workspace). */
  async postDailyPrompt(): Promise<{ ts: string }> {
    if (!this.app || !this.connected) throw new ServiceUnavailableException('Slack is not connected');
    const res = await this.app.client.chat.postMessage({ channel: this.channelId!, text: DAILY_PROMPT_TEXT });
    this.rememberPrompt(res.ts!, true);
    return { ts: res.ts! };
  }

  /** P2 demo fallback: same parse → presence → live map path, without Slack. */
  async injectText(userId: string, text: string) {
    const parsed = parseStatusText(text);
    if (!parsed || parsed.confidence < MIN_CONFIDENCE) return { applied: false as const, parsed };
    const date = addDays(this.clock.today(), parsed.dayOffset);
    await this.presence.setPresence({ userId, status: parsed.status, date, source: 'slack', rawMessage: text, confidence: parsed.confidence });
    return { applied: true as const, parsed, date };
  }

  // ---------------------------------------------------------------- utils

  private async isDailyPrompt(ts: string): Promise<boolean> {
    const cached = this.promptCache.get(ts);
    if (cached !== undefined) return cached;
    // Thread replies aren't returned here, so a reaction on a reply correctly comes back false.
    const res = await this.app!.client.conversations.history({
      channel: this.channelId!, latest: ts, oldest: ts, inclusive: true, limit: 1,
    });
    const msg = res.messages?.[0];
    const isPrompt = msg?.ts === ts && DAILY_PROMPT_RE.test(msg.text ?? '');
    this.rememberPrompt(ts, isPrompt);
    return isPrompt;
  }

  private rememberPrompt(ts: string, isPrompt: boolean): void {
    if (this.promptCache.size >= 500) this.promptCache.clear(); // bounded: a cache miss just re-asks Slack
    this.promptCache.set(ts, isPrompt);
  }

  private async confirm(
    slackUser: string, userId: string, name: string, status: PresenceStatus, date: string, isNew: boolean, threadTs?: string,
  ): Promise<void> {
    const desk = await this.slackUsers.deskOf(userId);
    const today = this.clock.today();
    const when = date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : date;
    const deskLine = !desk ? '' : status === 'IN_OFFICE' ? ` Desk ${desk.id} is yours.` : ` Desk ${desk.id} is now free for others :large_green_circle:`;
    const intro = isNew ? `:wave: For this demo you are *${name}*.\n` : '';
    await this.ephemeral(slackUser, threadTs, `${intro}:white_check_mark: Got it: *${name}* is ${STATUS_LABEL[status]} ${when}.${deskLine}`);
  }

  /** Only the person sees it, so MC/leave reasons stay private. */
  private async ephemeral(user: string, threadTs: string | undefined, text: string): Promise<void> {
    await this.app!.client.chat
      .postEphemeral({ channel: this.channelId!, user, text, ...(threadTs ? { thread_ts: threadTs } : {}) })
      .catch((err) => this.log.warn(`Ephemeral message failed: ${(err as Error).message}`));
  }
}
