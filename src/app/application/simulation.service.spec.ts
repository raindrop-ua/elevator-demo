import { TestBed } from '@angular/core/testing';
import { SIMULATION_CLOCK, type SimulationClock } from './simulation-clock';
import { SimulationService } from './simulation.service';

class ManualClock implements SimulationClock {
  private listener: ((deltaMs: number) => void) | null = null;
  resets = 0;
  stopped = false;

  start(listener: (deltaMs: number) => void): () => void {
    this.listener = listener;
    return () => {
      this.stopped = true;
      this.listener = null;
    };
  }

  resetBaseline(): void {
    this.resets += 1;
  }

  advance(deltaMs: number): void {
    this.listener?.(deltaMs);
  }
}

describe('SimulationService', () => {
  let clock: ManualClock;
  let service: SimulationService;

  beforeEach(() => {
    clock = new ManualClock();
    TestBed.configureTestingModule({
      providers: [{ provide: SIMULATION_CLOCK, useValue: clock }],
    });
    service = TestBed.inject(SimulationService);
  });

  it('selects a cabin and routes commands to the domain', () => {
    service.selectElevator('C');
    service.goTo(1);
    service.call(2, 'up');

    expect(service.selectedId()).toBe('C');
    expect(service.selectedElevator().stops).toContain(1);
    expect(service.snapshot().requests).toEqual([
      expect.objectContaining({ floor: 2, direction: 'up' }),
    ]);
    expect(service.activeCount()).toBeGreaterThan(0);
  });

  it('freezes simulation time while paused and resets the frame baseline on resume', () => {
    service.goTo(5);
    clock.advance(500);
    service.togglePause();
    const pausedSnapshot = service.snapshot();
    clock.advance(30_000);
    expect(service.snapshot()).toBe(pausedSnapshot);

    service.togglePause();
    clock.advance(100);
    expect(service.snapshot().elapsedMs).toBe(600);
    expect(clock.resets).toBe(2);
  });

  it('applies playback speed to simulation time', () => {
    service.setSpeed(2);
    clock.advance(100);
    service.setSpeed(4);
    clock.advance(100);
    service.setSpeed(1);
    clock.advance(100);
    expect(service.snapshot().elapsedMs).toBe(700);
  });

  it('resets controls and cancels every scheduled scenario command', () => {
    service.runScenario();
    clock.advance(2000);
    service.setSpeed(4);
    service.selectElevator('B');
    service.togglePause();
    service.reset();

    expect(service.paused()).toBe(false);
    expect(service.speed()).toBe(1);
    expect(service.selectedId()).toBe('A');
    expect(service.snapshot().elapsedMs).toBe(0);
    expect(service.scenarioRunning()).toBe(false);
    clock.advance(30_000);
    expect(service.snapshot().requests).toHaveLength(0);
    expect(service.snapshot().events).toHaveLength(1);
    expect(service.activeCount()).toBe(0);
  });

  it('starts all three cabins and restarts the scenario without duplicated actions', () => {
    service.runScenario();
    const initial = service.snapshot();
    expect(service.activeCount()).toBe(3);
    clock.advance(3000);
    service.runScenario();
    expect(service.snapshot()).toEqual(initial);
    clock.advance(3000);
    const firstRun = service.snapshot();
    service.runScenario();
    clock.advance(1000);
    clock.advance(2000);
    expect(service.snapshot()).toEqual(firstRun);
  });

  it('schedules actions in simulation time and completes the scenario', () => {
    service.runScenario();
    clock.advance(1000);
    service.togglePause();
    clock.advance(20_000);
    expect(service.snapshot().requests).toHaveLength(0);
    service.togglePause();
    clock.advance(800);
    expect(service.snapshot().requests).toEqual([
      expect.objectContaining({ floor: 4, direction: 'down', createdAt: 1800 }),
    ]);
    clock.advance(90_000);
    expect(service.scenarioRunning()).toBe(false);
    expect(service.snapshot().servedCalls).toBe(4);
    expect(service.activeCount()).toBe(0);
  });

  it('stops the injected clock when its injector is destroyed', () => {
    service.runScenario();
    const before = service.snapshot();
    TestBed.resetTestingModule();
    clock.advance(2000);
    expect(clock.stopped).toBe(true);
    expect(service.snapshot()).toBe(before);
  });
});
