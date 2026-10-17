import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import type { SimulationSnapshot } from '@domain/elevator';
import { IconComponent } from '@shared/ui/icon.component';

@Component({
  selector: 'app-simulation-stats',
  imports: [DecimalPipe, IconComponent],
  templateUrl: './simulation-stats.component.html',
  styleUrl: './simulation-stats.component.css',
})
export class SimulationStatsComponent {
  readonly snapshot = input.required<SimulationSnapshot>();
}
