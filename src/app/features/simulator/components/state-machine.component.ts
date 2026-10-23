import { Component, input } from '@angular/core';
import type { ElevatorSnapshot } from '@domain/elevator';
import { IconComponent } from '@shared/ui/icon.component';

@Component({
  selector: 'app-state-machine',
  imports: [IconComponent],
  templateUrl: './state-machine.component.html',
  styleUrl: './state-machine.component.css',
})
export class StateMachineComponent {
  readonly elevator = input.required<ElevatorSnapshot>();
}
