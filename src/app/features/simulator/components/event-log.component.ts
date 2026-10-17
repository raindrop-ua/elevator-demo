import { Component, input } from '@angular/core';
import type { SimulationEvent } from '@domain/elevator';
import { formatTime } from '../simulator.presentation';

@Component({
  selector: 'app-event-log',
  template: ` <section class="panel event-panel" aria-labelledby="event-title">
    <div class="panel-heading">
      <h2 id="event-title">Event log</h2>
      <span class="live-label"
        ><i [class.paused]="paused()"></i>{{ paused() ? 'Paused' : 'Live updates' }}</span
      >
    </div>
    <div class="event-list" tabindex="0" role="region" aria-label="Recent simulation events">
      @for (event of events(); track event.id) {
        <div class="event-row">
          <time>{{ formatTime(event.time) }}</time
          ><span class="event-elevator" [attr.data-elevator]="event.elevatorId">{{
            event.elevatorId ?? 'SYS'
          }}</span
          ><span class="event-message">{{ event.message }}</span>
        </div>
      } @empty {
        <div class="event-row">
          <time>00:00.0</time><span class="event-elevator">SYS</span
          ><span>Ready for the first call</span>
        </div>
      }
    </div>
  </section>`,
  styles: `
    :host {
      display: block;
    }
    .event-panel {
      padding: 18px 20px 14px;
    }
    .live-label {
      color: var(--muted);
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .live-label i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }
    .live-label i.paused {
      background: #a9afbc;
    }
    .event-list {
      height: 52px;
      overflow-y: auto;
      margin-top: 14px;
      border-top: 1px solid var(--line);
      scrollbar-width: thin;
      scrollbar-color: #d3cce8 transparent;
    }
    .event-row {
      display: grid;
      grid-template-columns: 62px 30px 1fr;
      align-items: start;
      gap: 16px;
      font: 10px/1.6 var(--mono);
      color: #4d586b;
      padding: 9px 2px;
      border-bottom: 1px solid #f0f1f5;
    }
    .event-row time {
      color: #757e91;
      font-variant-numeric: tabular-nums;
    }
    .event-elevator {
      font-size: 9px;
      font-weight: 600;
      padding: 0 4px;
      text-align: center;
      border-radius: 3px;
      background: var(--elevator-soft, #f0f2f6);
      color: var(--elevator-ink, #657084);
    }
    @media (max-width: 600px) {
      .event-panel {
        padding: 16px;
      }
      .live-label {
        font-size: 9px;
        gap: 5px;
      }
      .event-row {
        column-gap: 8px;
        font-size: 9px;
        grid-template-columns: 48px 26px 1fr;
      }
      .event-list {
        height: 132px;
      }
    }
  `,
})
export class EventLogComponent {
  readonly events = input.required<readonly SimulationEvent[]>();
  readonly paused = input(false);
  protected readonly formatTime = formatTime;
}
