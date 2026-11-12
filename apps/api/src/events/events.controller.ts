import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Server-Sent Events: GET /api/stream */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.events.stream();
  }
}
