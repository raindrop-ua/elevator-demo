import { Component, input, output } from '@angular/core';
import type { Direction, ElevatorId, ElevatorSnapshot, HallRequest } from '@domain/elevator';
import { IconComponent } from '@shared/ui/icon.component';
import { FLOORS, STATE_LABELS } from '../simulator.presentation';
import { ElevatorShaftComponent } from './elevator-shaft.component';

@Component({
  selector: 'app-building',
  imports: [IconComponent, ElevatorShaftComponent],
  templateUrl: './building.component.html',
  styleUrl: './building.component.css',
})
export class BuildingComponent {
  readonly elevators = input.required<readonly ElevatorSnapshot[]>();
  readonly requests = input.required<readonly HallRequest[]>();
  readonly selectedId = input.required<ElevatorId>();
  readonly paused = input(false);
  readonly speed = input(1);
  readonly hallCall = output<{ floor: number; direction: Direction }>();
  readonly selectElevator = output<ElevatorId>();
  readonly togglePause = output<void>();
  readonly changeSpeed = output<1 | 2 | 4>();
  protected readonly floors = FLOORS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly speeds = [1, 2, 4] as const;
  protected pending(floor: number, direction: Direction): HallRequest | undefined {
    return this.requests().find(
      (request) => request.floor === floor && request.direction === direction,
    );
  }
}
