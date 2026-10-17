export type Direction = 'up' | 'down';
export type ElevatorId = 'A' | 'B' | 'C';
export type ElevatorState = 'idle' | 'moving-up' | 'moving-down' | 'opening' | 'open' | 'closing';

export interface ElevatorSnapshot {
  readonly id: ElevatorId;
  readonly floor: number;
  readonly position: number;
  readonly state: ElevatorState;
  readonly direction: Direction | null;
  readonly targetFloor: number | null;
  readonly stops: readonly number[];
  readonly doorProgress: number;
  readonly completedStops: number;
}

export interface HallRequest {
  readonly id: string;
  readonly floor: number;
  readonly direction: Direction;
  readonly assignedElevatorId: ElevatorId;
  readonly createdAt: number;
}

export interface SimulationEvent {
  readonly id: number;
  readonly time: number;
  readonly elevatorId: ElevatorId | null;
  readonly message: string;
  readonly type: 'request' | 'dispatch' | 'state' | 'arrival' | 'system';
}

export interface SimulationSnapshot {
  readonly elevators: readonly ElevatorSnapshot[];
  readonly requests: readonly HallRequest[];
  readonly events: readonly SimulationEvent[];
  readonly elapsedMs: number;
  readonly servedCalls: number;
  readonly averageWaitMs: number;
}

export const ELEVATOR_CONFIG = Object.freeze({
  minFloor: 1,
  maxFloor: 5,
  travelMs: 1800,
  openingMs: 600,
  dwellMs: 1400,
  closingMs: 600,
  maxEvents: 80,
});

export function assertFloor(floor: number): void {
  if (
    !Number.isInteger(floor) ||
    floor < ELEVATOR_CONFIG.minFloor ||
    floor > ELEVATOR_CONFIG.maxFloor
  ) {
    throw new RangeError('Floor must be an integer between 1 and 5.');
  }
}

export function oppositeDirection(direction: Direction): Direction {
  return direction === 'up' ? 'down' : 'up';
}
