import { ElevatorSimulation } from './elevator-simulation';
import { ElevatorStateMachine } from './elevator-state-machine';
import type { DispatchStrategy } from './dispatch-strategy';
import type { Direction, ElevatorId, SimulationSnapshot } from './elevator.models';

const singleCar: DispatchStrategy = { choose: () => 'A' };
const car = (snapshot: SimulationSnapshot, id: ElevatorId = 'A') =>
  snapshot.elevators.find((item) => item.id === id)!;

describe('ElevatorSimulation', () => {
  it('starts three independent cars on floors 1, 3, and 5 and protects published state', () => {
    const simulation = new ElevatorSimulation();
    const initial = simulation.snapshot();
    expect(initial.elevators.map((item) => [item.id, item.floor, item.state])).toEqual([
      ['A', 1, 'idle'],
      ['B', 3, 'idle'],
      ['C', 5, 'idle'],
    ]);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.elevators)).toBe(true);
    expect(Object.isFrozen(initial.elevators[0].stops)).toBe(true);
    simulation.requestHall(1, 'up');
    expect(initial.requests).toHaveLength(0);
    expect(car(initial).state).toBe('idle');
    expect(Object.isFrozen(simulation.snapshot().requests[0])).toBe(true);
  });

  it('assigns concurrent nearby calls to separate cars and deduplicates active calls', () => {
    const simulation = new ElevatorSimulation();
    simulation.requestHall(1, 'up');
    simulation.requestHall(3, 'up');
    simulation.requestHall(5, 'down');
    const beforeDuplicate = simulation.snapshot();
    expect(beforeDuplicate.requests.map((item) => item.assignedElevatorId)).toEqual([
      'A',
      'B',
      'C',
    ]);
    simulation.requestHall(3, 'up');
    expect(simulation.snapshot()).toEqual(beforeDuplicate);
    simulation.tick(600);
    expect(simulation.snapshot().servedCalls).toBe(3);
    expect(simulation.snapshot().averageWaitMs).toBe(600);
  });

  it('serves a call only when doors are fully open and resets to idle after closing', () => {
    const simulation = new ElevatorSimulation(singleCar);
    simulation.requestHall(2, 'up');
    simulation.tick(900);
    expect(car(simulation.snapshot())).toMatchObject({
      floor: 1,
      position: 1.5,
      state: 'moving-up',
      doorProgress: 0,
    });
    simulation.tick(900);
    expect(car(simulation.snapshot())).toMatchObject({
      floor: 2,
      position: 2,
      state: 'opening',
      doorProgress: 0,
    });
    simulation.tick(599);
    expect(simulation.snapshot().requests).toHaveLength(1);
    expect(simulation.snapshot().servedCalls).toBe(0);
    simulation.tick(1);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'open',
      doorProgress: 1,
      completedStops: 1,
    });
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(simulation.snapshot().averageWaitMs).toBe(2400);
    simulation.tick(2000);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'idle',
      direction: null,
      targetFloor: null,
      doorProgress: 0,
    });
  });

  it('keeps an opposite hall call queued during the upward sweep, then serves it on return', () => {
    const simulation = new ElevatorSimulation(singleCar);
    simulation.requestCabin('A', 5);
    simulation.requestHall(3, 'up');
    simulation.requestHall(3, 'down');
    simulation.tick(4200);
    expect(car(simulation.snapshot())).toMatchObject({ floor: 3, state: 'open', direction: 'up' });
    expect(simulation.snapshot().requests.map((request) => request.direction)).toEqual(['down']);
    simulation.tick(20_000);
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(simulation.snapshot().servedCalls).toBe(2);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'idle',
      floor: 3,
      completedStops: 3,
    });
    const servedFloors = simulation
      .snapshot()
      .events.filter((event) => event.type === 'arrival')
      .reverse()
      .map((event) => event.message);
    expect(servedFloors).toEqual([
      'Floor 3 · call served',
      'Floor 5 · destination reached',
      'Floor 3 · call served',
    ]);
  });

  it.each([
    { lead: 0, duration: 1800, before: 'moving-up', after: 'opening' },
    { lead: 1800, duration: 600, before: 'opening', after: 'open' },
    { lead: 2400, duration: 1400, before: 'open', after: 'closing' },
    { lead: 3800, duration: 600, before: 'closing', after: 'idle' },
  ])(
    'finishes $before only when its physical time boundary is reached',
    ({ lead, duration, before, after }) => {
      const simulation = new ElevatorSimulation(singleCar);
      simulation.requestHall(2, 'up');
      if (lead > 0) simulation.tick(lead);
      expect(() => simulation.tick(duration - 1e-8)).not.toThrow();
      expect(car(simulation.snapshot()).state).toBe(before);
      if (before === 'opening') expect(simulation.snapshot().servedCalls).toBe(0);
      expect(() => simulation.tick(1e-7)).not.toThrow();
      expect(car(simulation.snapshot()).state).toBe(after);
    },
  );

  it('agrees with a single clock step when driven by fractional animation frames', () => {
    const whole = new ElevatorSimulation();
    const framed = new ElevatorSimulation();
    for (const simulation of [whole, framed]) {
      simulation.requestHall(4, 'down');
      simulation.requestHall(2, 'up');
      simulation.requestCabin('A', 5);
      simulation.requestCabin('B', 1);
    }
    whole.tick(5000.125);
    let remaining = 5000.125;
    while (remaining > 0) {
      const frame = Math.min(1000 / 60, remaining);
      framed.tick(frame);
      remaining -= frame;
    }
    const actual = framed.snapshot();
    const expected = whole.snapshot();
    expect(actual.elapsedMs).toBeCloseTo(expected.elapsedMs, 8);
    expect(actual.servedCalls).toBe(expected.servedCalls);
    expect(actual.averageWaitMs).toBeCloseTo(expected.averageWaitMs, 8);
    expect(actual.requests).toEqual(expected.requests);
    actual.elevators.forEach((elevator, index) => {
      const reference = expected.elevators[index];
      expect(elevator).toMatchObject({
        id: reference.id,
        floor: reference.floor,
        state: reference.state,
        direction: reference.direction,
        stops: reference.stops,
        targetFloor: reference.targetFloor,
        completedStops: reference.completedStops,
      });
      expect(elevator.position).toBeCloseTo(reference.position, 10);
      expect(elevator.doorProgress).toBeCloseTo(reference.doorProgress, 10);
    });
    expect(actual.events).toHaveLength(expected.events.length);
    actual.events.forEach((event, index) => {
      const reference = expected.events[index];
      expect(event).toMatchObject({
        id: reference.id,
        type: reference.type,
        message: reference.message,
        elevatorId: reference.elevatorId,
      });
      expect(event.time).toBeCloseTo(reference.time, 8);
    });
  });

  it('turns around before serving a down call at the top of its route', () => {
    const simulation = new ElevatorSimulation(singleCar);
    simulation.requestCabin('A', 5);
    simulation.requestHall(5, 'down');
    simulation.tick(7200);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'opening',
      direction: 'down',
      floor: 5,
    });
    expect(simulation.snapshot().requests).toHaveLength(1);
    simulation.tick(600);
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(car(simulation.snapshot()).completedStops).toBe(1);
  });

  it('accepts stops while moving, avoids reversing between floors, and deduplicates cabin stops', () => {
    const simulation = new ElevatorSimulation();
    simulation.requestCabin('A', 5);
    simulation.tick(900);
    simulation.requestCabin('A', 1);
    simulation.requestCabin('A', 3);
    simulation.requestCabin('A', 3);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'moving-up',
      position: 1.5,
      stops: [1, 3, 5],
      targetFloor: 3,
    });
    simulation.tick(30_000);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'idle',
      floor: 1,
      completedStops: 3,
      stops: [],
    });
  });

  it('serves a matching call immediately during open doors while retaining an opposite call', () => {
    const simulation = new ElevatorSimulation(singleCar);
    simulation.requestHall(2, 'up');
    simulation.tick(2400);
    simulation.requestHall(2, 'up');
    simulation.requestHall(2, 'down');
    expect(simulation.snapshot().servedCalls).toBe(2);
    expect(simulation.snapshot().requests.map((request) => request.direction)).toEqual(['down']);
    simulation.tick(2600);
    expect(car(simulation.snapshot())).toMatchObject({
      state: 'open',
      direction: 'down',
      completedStops: 2,
    });
    expect(simulation.snapshot().servedCalls).toBe(3);
  });

  it('preserves a new request arriving during closing until a subsequent opening', () => {
    const simulation = new ElevatorSimulation(singleCar);
    simulation.requestHall(1, 'up');
    simulation.tick(2200);
    expect(car(simulation.snapshot()).state).toBe('closing');
    simulation.requestHall(1, 'up');
    simulation.tick(999);
    expect(simulation.snapshot().requests).toHaveLength(1);
    simulation.tick(1);
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(car(simulation.snapshot()).completedStops).toBe(2);
  });

  it('produces identical routes, timestamps, and metrics for different clock chunk sizes', () => {
    const whole = new ElevatorSimulation();
    const sliced = new ElevatorSimulation();
    for (const simulation of [whole, sliced]) {
      simulation.requestHall(4, 'down');
      simulation.requestHall(2, 'up');
      simulation.requestCabin('A', 5);
      simulation.requestCabin('B', 1);
    }
    whole.tick(32_111);
    for (let index = 0; index < 1000; index += 1) {
      sliced.tick(32);
    }
    sliced.tick(111);
    expect(sliced.snapshot()).toEqual(whole.snapshot());
  });

  it('eventually drains a mixed burst while keeping every car within physical bounds', () => {
    const simulation = new ElevatorSimulation();
    for (let floor = 1; floor <= 5; floor += 1) {
      if (floor < 5) simulation.requestHall(floor, 'up');
      if (floor > 1) simulation.requestHall(floor, 'down');
      for (const id of ['A', 'B', 'C'] as const) simulation.requestCabin(id, floor);
    }
    for (let elapsed = 0; elapsed < 80_000; elapsed += 73) {
      simulation.tick(73);
      for (const elevator of simulation.snapshot().elevators) {
        expect(elevator.position).toBeGreaterThanOrEqual(1);
        expect(elevator.position).toBeLessThanOrEqual(5);
        expect(elevator.doorProgress).toBeGreaterThanOrEqual(0);
        expect(elevator.doorProgress).toBeLessThanOrEqual(1);
        if (elevator.state.startsWith('moving-')) expect(elevator.doorProgress).toBe(0);
        else expect(Number.isInteger(elevator.position)).toBe(true);
      }
    }
    expect(simulation.snapshot().servedCalls).toBe(8);
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(simulation.snapshot().elevators.every((elevator) => elevator.state === 'idle')).toBe(
      true,
    );
    expect(simulation.snapshot().events.length).toBeLessThanOrEqual(80);
  });

  it('reset discards active routes, history, and metrics and restores initial placement', () => {
    const simulation = new ElevatorSimulation();
    const initial = simulation.snapshot();
    simulation.requestHall(1, 'up');
    simulation.requestCabin('C', 2);
    simulation.tick(3000);
    simulation.reset();
    expect(simulation.snapshot()).toEqual(initial);
  });

  it('drains requests added across arbitrary movement and door phases without losing a call', () => {
    const simulation = new ElevatorSimulation();
    let seed = 42;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let acceptedCalls = 0;
    for (let index = 0; index < 250; index += 1) {
      const floor = 1 + Math.floor(random() * 5);
      const direction: Direction =
        floor === 1 ? 'up' : floor === 5 ? 'down' : random() > 0.5 ? 'up' : 'down';
      if (
        !simulation
          .snapshot()
          .requests.some((request) => request.floor === floor && request.direction === direction)
      ) {
        acceptedCalls += 1;
      }
      simulation.requestHall(floor, direction);
      simulation.requestCabin(
        (['A', 'B', 'C'] as const)[Math.floor(random() * 3)],
        1 + Math.floor(random() * 5),
      );
      simulation.tick(0.01 + random() * 1200);
      for (const elevator of simulation.snapshot().elevators) {
        expect(elevator.position).toBeGreaterThanOrEqual(1);
        expect(elevator.position).toBeLessThanOrEqual(5);
        if (elevator.state.startsWith('moving-')) expect(elevator.doorProgress).toBe(0);
      }
    }
    simulation.tick(100_000);
    expect(simulation.snapshot().servedCalls).toBe(acceptedCalls);
    expect(simulation.snapshot().requests).toHaveLength(0);
    expect(
      simulation
        .snapshot()
        .elevators.every((elevator) => elevator.state === 'idle' && elevator.stops.length === 0),
    ).toBe(true);
    expect(simulation.snapshot().events).toHaveLength(80);
  });

  it('rejects invalid public inputs without changing the simulation', () => {
    const simulation = new ElevatorSimulation();
    const initial = simulation.snapshot();
    for (const delta of [0, -1, NaN, Infinity])
      expect(() => simulation.tick(delta)).toThrow(RangeError);
    for (const floor of [0, 6, 2.5, NaN, Infinity]) {
      expect(() => simulation.requestHall(floor, 'up')).toThrow(RangeError);
      expect(() => simulation.requestCabin('A', floor)).toThrow(RangeError);
    }
    expect(() => simulation.requestHall(1, 'down')).toThrow(RangeError);
    expect(() => simulation.requestHall(5, 'up')).toThrow(RangeError);
    expect(() => simulation.requestHall(2, 'sideways' as Direction)).toThrow(RangeError);
    expect(() => simulation.requestCabin('D' as ElevatorId, 2)).toThrow(RangeError);
    expect(simulation.snapshot()).toEqual(initial);
  });
});

describe('ElevatorStateMachine', () => {
  it('rejects an illegal edge, movement with open doors, and movement between floors', () => {
    const machine = new ElevatorStateMachine();
    expect(() => machine.transition('open', { alignedWithFloor: true, doorProgress: 1 })).toThrow(
      /Illegal/,
    );
    expect(() =>
      machine.transition('moving-up', { alignedWithFloor: true, doorProgress: 1 }),
    ).toThrow(/Unsafe/);
    expect(() =>
      machine.transition('moving-up', { alignedWithFloor: false, doorProgress: 0 }),
    ).toThrow(/aligned/);
    expect(machine.state).toBe('idle');
    machine.transition('moving-up', { alignedWithFloor: true, doorProgress: 0 });
    expect(machine.state).toBe('moving-up');
  });
});
