import { ElevatorStateMachine } from './elevator-state-machine';
import {
  ELEVATOR_CONFIG,
  oppositeDirection,
  type Direction,
  type ElevatorId,
  type ElevatorSnapshot,
  type ElevatorState,
} from './elevator.models';

interface FloorStop {
  cabin: boolean;
  readonly hall: Map<string, Direction>;
}

export type CarEvent =
  | { readonly type: 'state'; readonly state: ElevatorState; readonly floor: number }
  | {
      readonly type: 'arrival';
      readonly floor: number;
      readonly servedHallIds: readonly string[];
      readonly cabinServed: boolean;
    };

/** One physical car, its route, and its guarded state machine. No wall-clock dependencies. */
export class ElevatorCar {
  private readonly machine = new ElevatorStateMachine();
  private readonly stops = new Map<number, FloorStop>();
  private floor: number;
  private position: number;
  private doorProgress = 0;
  private direction: Direction | null = null;
  private phaseMs = 0;
  private completedStops = 0;

  constructor(
    readonly id: ElevatorId,
    initialFloor: number,
    private readonly emit: (event: CarEvent) => void,
  ) {
    this.floor = initialFloor;
    this.position = initialFloor;
  }

  get timeToBoundary(): number {
    return this.duration - this.phaseMs;
  }

  addHallRequest(id: string, floor: number, direction: Direction): void {
    this.stopAt(floor).hall.set(id, direction);
    if (this.floor === floor && this.direction === null && this.machine.state === 'opening') {
      this.direction = direction;
    }
    this.reactToRequest();
  }

  addCabinRequest(floor: number): void {
    this.stopAt(floor).cabin = true;
    this.reactToRequest();
  }

  /** The simulation advances every car to the same next boundary before processing the next slice. */
  advance(deltaMs: number): void {
    if (this.machine.state === 'idle') {
      return;
    }
    this.phaseMs += deltaMs;
    const progress = Math.min(1, this.phaseMs / this.duration);
    if (this.machine.state === 'moving-up' || this.machine.state === 'moving-down') {
      this.position = this.floor + (this.direction === 'up' ? progress : -progress);
    } else if (this.machine.state === 'opening') {
      this.doorProgress = progress;
    } else if (this.machine.state === 'closing') {
      this.doorProgress = 1 - progress;
    }
    // Never transition early: the FSM guards require the physical phase to be complete.
    if (this.phaseMs < this.duration) {
      return;
    }
    this.phaseMs = 0;
    switch (this.machine.state) {
      case 'moving-up':
      case 'moving-down':
        this.floor += this.direction === 'up' ? 1 : -1;
        this.onFloorReached();
        break;
      case 'opening':
        this.transition('open');
        this.completedStops += 1;
        this.serveCurrentFloor();
        break;
      case 'open':
        this.transition('closing');
        break;
      case 'closing':
        this.transition('idle');
        this.planNextLeg();
        break;
    }
  }

  snapshot(): ElevatorSnapshot {
    const state = this.machine.state;
    const sign = state === 'moving-up' ? 1 : state === 'moving-down' ? -1 : 0;
    return Object.freeze({
      id: this.id,
      floor: this.floor,
      position: this.position,
      state,
      direction: this.direction,
      targetFloor: state === 'idle' ? null : sign === 0 ? this.floor : this.nextTarget(),
      stops: Object.freeze([...this.stops.keys()].sort((a, b) => a - b)),
      doorProgress: this.doorProgress,
      completedStops: this.completedStops,
    });
  }

  private get duration(): number {
    switch (this.machine.state) {
      case 'idle':
        return Infinity;
      case 'moving-up':
      case 'moving-down':
        return ELEVATOR_CONFIG.travelMs;
      case 'opening':
        return ELEVATOR_CONFIG.openingMs;
      case 'open':
        return ELEVATOR_CONFIG.dwellMs;
      case 'closing':
        return ELEVATOR_CONFIG.closingMs;
    }
  }

  private stopAt(floor: number): FloorStop {
    let stop = this.stops.get(floor);
    if (!stop) {
      stop = { cabin: false, hall: new Map() };
      this.stops.set(floor, stop);
    }
    return stop;
  }

  private reactToRequest(): void {
    if (this.machine.state === 'idle') {
      this.planNextLeg();
    } else if (this.machine.state === 'open') {
      if (this.direction === null) {
        this.direction = this.stops.get(this.floor)?.hall.values().next().value ?? null;
      }
      this.serveCurrentFloor();
    }
  }

  private planNextLeg(): void {
    if (this.stops.size === 0) {
      this.direction = null;
      return;
    }
    if (this.direction === null) {
      const nearest = [...this.stops.keys()].sort(
        (a, b) => Math.abs(a - this.floor) - Math.abs(b - this.floor) || a - b,
      )[0];
      this.direction =
        nearest === this.floor
          ? (this.stops.get(nearest)!.hall.values().next().value ?? null)
          : nearest > this.floor
            ? 'up'
            : 'down';
    }
    if (this.canServe(this.floor, this.direction)) {
      this.transition('opening');
      return;
    }
    if (this.direction && this.floorsAhead(this.direction).length > 0) {
      this.transition(this.direction === 'up' ? 'moving-up' : 'moving-down');
      return;
    }
    this.direction = this.direction
      ? oppositeDirection(this.direction)
      : (this.stops.get(this.floor)?.hall.values().next().value ?? null);
    if (this.canServe(this.floor, this.direction)) {
      this.transition('opening');
    } else {
      this.transition(this.direction === 'up' ? 'moving-up' : 'moving-down');
    }
  }

  private onFloorReached(): void {
    const stop = this.stops.get(this.floor);
    // At the end of a sweep, commit to the return direction before opening the doors.
    if (
      this.direction &&
      this.floorsAhead(this.direction).length === 0 &&
      stop &&
      ![...stop.hall.values()].includes(this.direction) &&
      [...stop.hall.values()].includes(oppositeDirection(this.direction))
    ) {
      this.direction = oppositeDirection(this.direction);
    }
    if (this.canServe(this.floor, this.direction)) {
      this.transition('opening');
      return;
    }
    if (this.direction && this.floorsAhead(this.direction).length === 0) {
      this.direction = oppositeDirection(this.direction);
      this.transition('opening');
    }
  }

  private canServe(floor: number, direction: Direction | null): boolean {
    const stop = this.stops.get(floor);
    return (
      !!stop &&
      (stop.cabin ||
        [...stop.hall.values()].some((requestedDirection) => requestedDirection === direction))
    );
  }

  private floorsAhead(direction: Direction): number[] {
    return [...this.stops.keys()].filter((floor) =>
      direction === 'up' ? floor > this.floor : floor < this.floor,
    );
  }

  private nextTarget(): number | null {
    if (!this.direction) {
      return null;
    }
    const ahead = this.floorsAhead(this.direction).sort((a, b) =>
      this.direction === 'up' ? a - b : b - a,
    );
    return ahead.find((floor) => this.canServe(floor, this.direction)) ?? ahead.at(-1) ?? null;
  }

  private serveCurrentFloor(): void {
    const stop = this.stops.get(this.floor);
    if (!stop || this.machine.state !== 'open') {
      return;
    }
    const servedHallIds = [...stop.hall.entries()]
      .filter(([, direction]) => direction === this.direction)
      .map(([id]) => id);
    const cabinServed = stop.cabin;
    stop.cabin = false;
    for (const id of servedHallIds) {
      stop.hall.delete(id);
    }
    if (!stop.cabin && stop.hall.size === 0) {
      this.stops.delete(this.floor);
    }
    if (cabinServed || servedHallIds.length > 0) {
      this.emit({ type: 'arrival', floor: this.floor, servedHallIds, cabinServed });
    }
  }

  private transition(state: ElevatorState): void {
    this.machine.transition(state, {
      alignedWithFloor: Number.isInteger(this.position) && this.position === this.floor,
      doorProgress: this.doorProgress,
    });
    this.phaseMs = 0;
    this.emit({ type: 'state', state, floor: this.floor });
  }
}
