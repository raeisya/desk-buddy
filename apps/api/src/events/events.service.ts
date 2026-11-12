import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import type { PresenceSource, PresenceStatus, StreamEvent } from '../common/contracts';

/** Server-side only (never sent to browsers): one person's presence changed. */
export interface PresenceChanged {
  userId: string;
  date: string;
  status: PresenceStatus;
  source: PresenceSource;
}

/** In-process pub/sub for live updates. Call emit() after any write that changes the map. */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<StreamEvent>();
  private readonly presence = new Subject<PresenceChanged>();

  /** In-process hook for side effects of a presence write (e.g. mirror it to Slack status). */
  presenceChanged(event: PresenceChanged): void {
    this.presence.next(event);
  }

  onPresenceChanged(): Observable<PresenceChanged> {
    return this.presence.asObservable();
  }

  emit(event: StreamEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<MessageEvent> {
    const events = this.subject.pipe(map((data): MessageEvent => ({ data })));
    // Heartbeat keeps proxies / load balancers from closing an idle connection.
    const heartbeat = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    return merge(events, heartbeat);
  }
}
