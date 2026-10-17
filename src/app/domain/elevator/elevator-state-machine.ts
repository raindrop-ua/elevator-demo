import type { ElevatorState } from './elevator.models';

export interface TransitionContext {
  readonly alignedWithFloor: boolean;
  readonly doorProgress: number;
}

/** Legal edges are explicit; physical guards apply independently of the scheduler. */
export const ELEVATOR_TRANSITIONS: Readonly<Record<ElevatorState, readonly ElevatorState[]>> =
  Object.freeze({
    idle: Object.freeze<ElevatorState[]>(['moving-up', 'moving-down', 'opening']),
    'moving-up': Object.freeze<ElevatorState[]>(['opening']),
    'moving-down': Object.freeze<ElevatorState[]>(['opening']),
    opening: Object.freeze<ElevatorState[]>(['open']),
    open: Object.freeze<ElevatorState[]>(['closing']),
    closing: Object.freeze<ElevatorState[]>(['idle']),
  });

export class ElevatorStateMachine {
  private current: ElevatorState = 'idle';

  get state(): ElevatorState {
    return this.current;
  }

  transition(next: ElevatorState, context: TransitionContext): void {
    if (!ELEVATOR_TRANSITIONS[this.current].includes(next)) {
      throw new Error(`Illegal elevator transition: ${this.current} → ${next}.`);
    }
    if (!context.alignedWithFloor) {
      throw new Error('An elevator may transition only while aligned with a floor.');
    }
    const expectedDoorProgress = next === 'open' || next === 'closing' ? 1 : 0;
    if (context.doorProgress !== expectedDoorProgress) {
      throw new Error(`Unsafe door position for transition to ${next}.`);
    }
    this.current = next;
  }
}
