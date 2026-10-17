import {
  ELEVATOR_CONFIG,
  type Direction,
  type ElevatorId,
  type ElevatorSnapshot,
} from './elevator.models';

export interface DispatchStrategy {
  choose(elevators: readonly ElevatorSnapshot[], floor: number, direction: Direction): ElevatorId;
}

/** Nearest suitable car, with penalties for a reversal and already committed stops. */
export class NearestRouteDispatchStrategy implements DispatchStrategy {
  choose(elevators: readonly ElevatorSnapshot[], floor: number, direction: Direction): ElevatorId {
    if (elevators.length === 0) {
      throw new Error('Dispatch requires at least one elevator.');
    }
    return [...elevators].sort(
      (left, right) =>
        this.cost(left, floor, direction) - this.cost(right, floor, direction) ||
        left.id.localeCompare(right.id),
    )[0].id;
  }

  private cost(car: ElevatorSnapshot, floor: number, direction: Direction): number {
    const distance = Math.abs(car.position - floor);
    if (car.state === 'idle') {
      return distance;
    }
    if (
      car.floor === floor &&
      (car.state === 'opening' || car.state === 'open') &&
      car.direction === direction
    ) {
      return 0;
    }
    const ahead = car.direction === 'up' ? floor >= car.position : floor <= car.position;
    const onRoute = ahead && car.direction === direction;
    const queuedStops = car.stops.filter((stop) =>
      car.direction === 'up'
        ? stop >= car.position && stop <= floor
        : stop <= car.position && stop >= floor,
    ).length;
    const doorDelay =
      car.state === 'opening' || car.state === 'open' || car.state === 'closing' ? 1 : 0;
    return (
      distance +
      doorDelay +
      (onRoute ? queuedStops * 0.8 : ELEVATOR_CONFIG.maxFloor + car.stops.length * 1.2)
    );
  }
}
