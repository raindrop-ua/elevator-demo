import { Component, input, output } from '@angular/core';
import type { ElevatorId, ElevatorSnapshot } from '@domain/elevator';
import { floorName, STATE_LABELS } from '../simulator.presentation';

@Component({
  selector: 'app-cabin-panel',
  templateUrl: './cabin-panel.component.html',
  styleUrl: './cabin-panel.component.css',
})
export class CabinPanelComponent {
  readonly elevator = input.required<ElevatorSnapshot>();
  readonly selectElevator = output<ElevatorId>();
  readonly goTo = output<number>();
  protected readonly ids = ['A', 'B', 'C'] as const;
  protected readonly floors = [1, 2, 3, 4, 5];
  protected readonly labels = STATE_LABELS;
  protected readonly floorName = floorName;
}
