import { Component, input } from '@angular/core';
import type { SimulationEvent } from '@domain/elevator';
import { formatTime } from '../simulator.presentation';

@Component({
  selector: 'app-event-log',
  templateUrl: './event-log.component.html',
  styleUrl: './event-log.component.css',
})
export class EventLogComponent {
  readonly events = input.required<readonly SimulationEvent[]>();
  readonly paused = input(false);
  protected readonly formatTime = formatTime;
}
