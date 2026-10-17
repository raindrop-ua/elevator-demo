import { NearestRouteDispatchStrategy, type DispatchStrategy } from './dispatch-strategy';
import { ElevatorCar, type CarEvent } from './elevator-car';
import {
  assertFloor,
  ELEVATOR_CONFIG,
  type Direction,
  type ElevatorId,
  type ElevatorState,
  type HallRequest,
  type SimulationEvent,
  type SimulationSnapshot,
} from './elevator.models';

const STATE_LABELS: Readonly<Record<ElevatorState, string>> = Object.freeze({
  idle: 'Ready for the next call',
  'moving-up': 'Moving up',
  'moving-down': 'Moving down',
  opening: 'Opening doors',
  open: 'Doors open',
  closing: 'Closing doors',
});

/** Aggregate root: owns time, cars, hall requests, dispatch, metrics, and bounded event history. */
export class ElevatorSimulation {
  private cars: ElevatorCar[] = [];
  private readonly requests = new Map<string, HallRequest>();
  private events: SimulationEvent[] = [];
  private elapsedMs = 0;
  private servedCalls = 0;
  private totalWaitMs = 0;
  private nextRequestId = 1;
  private nextEventId = 1;

  constructor(private readonly dispatcher: DispatchStrategy = new NearestRouteDispatchStrategy()) {
    this.reset();
  }

  snapshot(): SimulationSnapshot {
    return Object.freeze({
      elevators: Object.freeze(this.cars.map((car) => car.snapshot())),
      requests: Object.freeze([...this.requests.values()]),
      events: Object.freeze([...this.events]),
      elapsedMs: this.elapsedMs,
      servedCalls: this.servedCalls,
      averageWaitMs: this.servedCalls === 0 ? 0 : this.totalWaitMs / this.servedCalls,
    });
  }

  tick(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || !Number.isFinite(this.elapsedMs + deltaMs)) {
      throw new RangeError('Time delta must be finite and greater than zero.');
    }
    let remaining = deltaMs;
    while (remaining > 0) {
      const step = Math.min(remaining, ...this.cars.map((car) => car.timeToBoundary));
      this.elapsedMs += step;
      for (const car of this.cars) {
        car.advance(step);
      }
      remaining -= step;
    }
  }

  requestHall(floor: number, direction: Direction): void {
    assertFloor(floor);
    if (
      (direction !== 'up' && direction !== 'down') ||
      (floor === ELEVATOR_CONFIG.minFloor && direction === 'down') ||
      (floor === ELEVATOR_CONFIG.maxFloor && direction === 'up')
    ) {
      throw new RangeError('The requested direction is not available on this floor.');
    }
    const key = this.requestKey(floor, direction);
    if (this.requests.has(key)) {
      return;
    }
    const assignedElevatorId = this.dispatcher.choose(
      this.cars.map((car) => car.snapshot()),
      floor,
      direction,
    );
    const request = Object.freeze({
      id: `call-${this.nextRequestId++}`,
      floor,
      direction,
      assignedElevatorId,
      createdAt: this.elapsedMs,
    });
    this.requests.set(key, request);
    this.addEvent(
      'request',
      null,
      `Floor ${floor} · call going ${direction === 'up' ? 'up' : 'down'}`,
    );
    this.addEvent(
      'dispatch',
      assignedElevatorId,
      `Assigned to floor ${floor} · ${direction === 'up' ? '↑' : '↓'}`,
    );
    this.carById(assignedElevatorId).addHallRequest(request.id, floor, direction);
  }

  requestCabin(id: ElevatorId, floor: number): void {
    assertFloor(floor);
    const car = this.carById(id);
    // Both cabin and hall requests can share a stop; the cabin intent is maintained by the car.
    car.addCabinRequest(floor);
  }

  reset(): void {
    this.requests.clear();
    this.events = [];
    this.elapsedMs = 0;
    this.servedCalls = 0;
    this.totalWaitMs = 0;
    this.nextRequestId = 1;
    this.nextEventId = 1;
    this.cars = (['A', 'B', 'C'] as const).map(
      (id, index) => new ElevatorCar(id, 1 + index * 2, (event) => this.handleCarEvent(id, event)),
    );
    this.addEvent('system', null, 'System ready · 3 elevators, 5 floors');
  }

  private handleCarEvent(id: ElevatorId, event: CarEvent): void {
    if (event.type === 'state') {
      this.addEvent('state', id, `${STATE_LABELS[event.state]} · floor ${event.floor}`);
      return;
    }
    for (const requestId of event.servedHallIds) {
      const request = [...this.requests.values()].find((item) => item.id === requestId);
      if (request) {
        this.totalWaitMs += this.elapsedMs - request.createdAt;
        this.servedCalls += 1;
        this.requests.delete(this.requestKey(request.floor, request.direction));
      }
    }
    this.addEvent(
      'arrival',
      id,
      `Floor ${event.floor} · ${event.servedHallIds.length > 0 ? 'call served' : 'destination reached'}`,
    );
  }

  private addEvent(
    type: SimulationEvent['type'],
    elevatorId: ElevatorId | null,
    message: string,
  ): void {
    this.events.unshift(
      Object.freeze({ id: this.nextEventId++, time: this.elapsedMs, elevatorId, message, type }),
    );
    if (this.events.length > ELEVATOR_CONFIG.maxEvents) {
      this.events.length = ELEVATOR_CONFIG.maxEvents;
    }
  }

  private carById(id: ElevatorId): ElevatorCar {
    const car = this.cars.find((item) => item.id === id);
    if (!car) {
      throw new RangeError('Elevator id must be A, B, or C.');
    }
    return car;
  }

  private requestKey(floor: number, direction: Direction): string {
    return `${floor}:${direction}`;
  }
}
