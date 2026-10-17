import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  ElevatorSimulation,
  type Direction,
  type ElevatorId,
  type SimulationSnapshot,
} from '@domain/elevator';
import { SIMULATION_CLOCK } from './simulation-clock';

export type SimulationSpeed = 1 | 2 | 4;

type ScenarioAction =
  | {
      readonly at: number;
      readonly kind: 'hall';
      readonly floor: number;
      readonly direction: Direction;
    }
  | {
      readonly at: number;
      readonly kind: 'cabin';
      readonly id: ElevatorId;
      readonly floor: number;
    };

const DEMO_SCENARIO: readonly ScenarioAction[] = [
  { at: 0, kind: 'cabin', id: 'A', floor: 5 },
  { at: 0, kind: 'cabin', id: 'B', floor: 1 },
  { at: 0, kind: 'cabin', id: 'C', floor: 2 },
  { at: 1800, kind: 'hall', floor: 4, direction: 'down' },
  { at: 2600, kind: 'hall', floor: 2, direction: 'up' },
  { at: 4400, kind: 'hall', floor: 5, direction: 'down' },
  { at: 6000, kind: 'hall', floor: 1, direction: 'up' },
  { at: 8000, kind: 'cabin', id: 'B', floor: 5 },
  { at: 10000, kind: 'cabin', id: 'C', floor: 4 },
];

/** Application facade: owns commands, reactive views, and scenario orchestration. */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly simulation = new ElevatorSimulation();
  private readonly clock = inject(SIMULATION_CLOCK);
  private readonly snapshotState = signal<SimulationSnapshot>(this.simulation.snapshot());
  private readonly pausedState = signal(false);
  private readonly speedState = signal<SimulationSpeed>(1);
  private readonly selectedIdState = signal<ElevatorId>('A');
  private readonly scenarioState = signal(false);
  private pendingActions: ScenarioAction[] = [];

  readonly snapshot = this.snapshotState.asReadonly();
  readonly paused = this.pausedState.asReadonly();
  readonly speed = this.speedState.asReadonly();
  readonly selectedId = this.selectedIdState.asReadonly();
  readonly scenarioRunning = this.scenarioState.asReadonly();
  readonly selectedElevator = computed(() =>
    this.snapshot().elevators.find((elevator) => elevator.id === this.selectedId())!,
  );
  readonly activeCount = computed(
    () => this.snapshot().elevators.filter((elevator) => elevator.state !== 'idle').length,
  );

  constructor() {
    const stopClock = this.clock.start((deltaMs) => this.advance(deltaMs));
    inject(DestroyRef).onDestroy(stopClock);
  }

  selectElevator(id: ElevatorId): void {
    this.selectedIdState.set(id);
  }

  call(floor: number, direction: Direction): void {
    this.simulation.requestHall(floor, direction);
    this.publish();
  }

  goTo(floor: number): void {
    this.simulation.requestCabin(this.selectedId(), floor);
    this.publish();
  }

  togglePause(): void {
    this.pausedState.update((paused) => !paused);
    this.clock.resetBaseline();
  }

  setSpeed(speed: SimulationSpeed): void {
    this.speedState.set(speed);
    this.clock.resetBaseline();
  }

  reset(): void {
    this.pendingActions = [];
    this.scenarioState.set(false);
    this.pausedState.set(false);
    this.speedState.set(1);
    this.selectedIdState.set('A');
    this.simulation.reset();
    this.clock.resetBaseline();
    this.publish();
  }

  runScenario(): void {
    this.reset();
    this.pendingActions = [...DEMO_SCENARIO];
    this.scenarioState.set(true);
    this.advanceScenario(0);
    this.publish();
  }

  private advance(deltaMs: number): void {
    if (this.paused() || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.advanceScenario(deltaMs * this.speed());
    this.publish();
  }

  /** Split ticks at scenario boundaries so playback is independent of frame rate. */
  private advanceScenario(deltaMs: number): void {
    // The published snapshot already contains the previous tick's clock value.
    // Reuse it instead of cloning all cars, stops, and history twice per frame.
    let elapsed = this.snapshot().elapsedMs;
    const until = elapsed + deltaMs;
    while (this.pendingActions.length && this.pendingActions[0].at <= until) {
      const action = this.pendingActions.shift()!;
      if (action.at > elapsed) {
        this.simulation.tick(action.at - elapsed);
        elapsed = action.at;
      }
      if (action.kind === 'hall') {
        this.simulation.requestHall(action.floor, action.direction);
      } else {
        this.simulation.requestCabin(action.id, action.floor);
      }
    }
    if (until > elapsed) this.simulation.tick(until - elapsed);
  }

  private publish(): void {
    const snapshot = this.simulation.snapshot();
    this.snapshotState.set(snapshot);
    if (
      this.scenarioRunning() &&
      this.pendingActions.length === 0 &&
      snapshot.requests.length === 0 &&
      snapshot.elevators.every((elevator) => elevator.state === 'idle')
    ) {
      this.scenarioState.set(false);
    }
  }
}
