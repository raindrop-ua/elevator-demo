import { Component, input, output } from '@angular/core';
import type { ElevatorId, ElevatorSnapshot } from '@domain/elevator';
import { STATE_LABELS } from '../simulator.presentation';

@Component({
  selector: 'app-elevator-shaft',
  templateUrl: './elevator-shaft.component.html',
  styleUrl: './elevator-shaft.component.css',
})
export class ElevatorShaftComponent {
  readonly elevator = input.required<ElevatorSnapshot>();
  readonly selected = input(false);
  readonly select = output<ElevatorId>();
  protected readonly stateLabels = STATE_LABELS;
}
