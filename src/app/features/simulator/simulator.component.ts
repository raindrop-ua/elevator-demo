import { Component, inject, signal } from '@angular/core';
import { SimulationService } from '@application/simulation.service';
import type { Direction } from '@domain/elevator';
import { IconComponent } from '@shared/ui/icon.component';
import { BuildingComponent } from './components/building.component';
import { CabinPanelComponent } from './components/cabin-panel.component';
import { StateMachineComponent } from './components/state-machine.component';
import { EventLogComponent } from './components/event-log.component';
import { HelpDialogComponent } from './components/help-dialog.component';
import { SimulationStatsComponent } from './components/simulation-stats.component';

@Component({
  selector: 'app-simulator',
  imports: [
    IconComponent,
    BuildingComponent,
    CabinPanelComponent,
    StateMachineComponent,
    EventLogComponent,
    HelpDialogComponent,
    SimulationStatsComponent,
  ],
  templateUrl: './simulator.component.html',
  styleUrl: './simulator.component.css',
})
export class SimulatorComponent {
  protected readonly simulation = inject(SimulationService);
  protected readonly announcement = signal('');

  protected call(floor: number, direction: Direction): void {
    this.simulation.call(floor, direction);
    const assigned = this.simulation
      .snapshot()
      .requests.find((request) => request.floor === floor && request.direction === direction);
    this.announcement.set(
      `Call from floor ${floor} going ${direction} accepted${assigned ? '. Assigned to elevator ' + assigned.assignedElevatorId : ''}.`,
    );
  }

  protected goTo(floor: number): void {
    this.simulation.goTo(floor);
    this.announcement.set(
      `Floor ${floor} added to the route for elevator ${this.simulation.selectedId()}.`,
    );
  }

  protected reset(): void {
    this.simulation.reset();
    this.announcement.set('Simulation reset. Elevators are ready for calls.');
  }

  protected runScenario(): void {
    this.simulation.runScenario();
    this.announcement.set('Demo scenario started. All three elevators are moving.');
  }
}
