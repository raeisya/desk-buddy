import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import type { StreamEvent } from '../common/contracts';

/** In-process pub/sub for live updates. Call emit() after any write that changes the map. */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<StreamEvent>();

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
