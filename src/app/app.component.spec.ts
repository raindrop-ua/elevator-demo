import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { SIMULATION_CLOCK, type SimulationClock } from '@application/simulation-clock';
import { SimulationService } from '@application/simulation.service';
import { AppComponent } from './app.component';

class ManualClock implements SimulationClock {
  private listener: ((deltaMs: number) => void) | null = null;

  start(listener: (deltaMs: number) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  resetBaseline(): void {}

  advance(deltaMs: number): void {
    this.listener?.(deltaMs);
  }
}

describe('Simulator UI integration', () => {
  let fixture: ComponentFixture<AppComponent>;
  let root: HTMLElement;
  let clock: ManualClock;
  let service: SimulationService;

  beforeEach(async () => {
    clock = new ManualClock();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: SIMULATION_CLOCK, useValue: clock }],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    root = fixture.nativeElement as HTMLElement;
    service = TestBed.inject(SimulationService);
    fixture.detectChanges();
  });

  function buttonByLabel(label: string): HTMLButtonElement {
    const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(button, `Button with accessible label: ${label}`).not.toBeNull();
    return button!;
  }

  function buttonByText(text: string): HTMLButtonElement {
    const button = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    expect(button, `Button with text: ${text}`).toBeDefined();
    return button!;
  }

  function click(button: HTMLButtonElement): void {
    button.click();
    fixture.detectChanges();
  }

  function advance(deltaMs: number): void {
    clock.advance(deltaMs);
    fixture.detectChanges();
  }

  function metric(name: 'queue-count' | 'served-count'): string | undefined {
    return root.querySelector(`[data-testid="${name}"]`)?.textContent?.trim();
  }

  it('renders exactly eight directional hall calls and three selectable cabins', () => {
    expect(root.querySelector('h1')?.textContent).toContain('Everything under control.');
    const labels = [...root.querySelectorAll('.call-button')].map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'Floor 5: call elevator going down',
      'Floor 4: call elevator going up',
      'Floor 4: call elevator going down',
      'Floor 3: call elevator going up',
      'Floor 3: call elevator going down',
      'Floor 2: call elevator going up',
      'Floor 2: call elevator going down',
      'Floor 1: call elevator going up',
    ]);
    expect(root.querySelectorAll('.elevator-car')).toHaveLength(3);
    expect(metric('queue-count')).toBe('0');
  });

  it('shows the assigned car and keeps the hall call queued until doors fully open', () => {
    const hallCall = buttonByLabel('Floor 2: call elevator going up');
    click(hallCall);
    expect(hallCall.classList.contains('pending')).toBe(true);
    expect(hallCall.dataset['elevator']).toBe('A');
    expect(hallCall.disabled).toBe(true);
    expect(metric('queue-count')).toBe('1');
    expect(root.querySelector('.request-item')?.textContent).toContain('Elevator A');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Assigned to elevator A');

    advance(1800);
    expect(service.snapshot().elevators[0].state).toBe('opening');
    advance(599);
    expect(metric('queue-count')).toBe('1');
    advance(1);
    expect(service.snapshot().elevators[0].state).toBe('open');
    expect(metric('queue-count')).toBe('0');
    expect(metric('served-count')).toBe('1');
    expect(hallCall.disabled).toBe(false);
    expect(hallCall.classList.contains('pending')).toBe(false);
    expect(hallCall.hasAttribute('data-elevator')).toBe(false);
    expect(root.querySelector('.request-queue')).toBeNull();
  });

  it('routes a cabin destination to the selected B elevator and reflects its progress', () => {
    const tab = buttonByText('Elevator B');
    click(tab);
    expect(tab.getAttribute('aria-pressed')).toBe('true');
    expect(service.selectedId()).toBe('B');
    const destination = buttonByLabel('Elevator B: go to floor 5');
    click(destination);
    expect(destination.disabled).toBe(true);
    expect(destination.getAttribute('aria-pressed')).toBe('true');
    expect(destination.classList.contains('queued')).toBe(true);
    expect(service.snapshot().elevators[0].stops).toEqual([]);
    expect(service.snapshot().elevators[1].stops).toEqual([5]);

    advance(1800);
    expect(root.querySelector('.floor-display')?.textContent).toBe('04');
    advance(2400);
    expect(root.querySelector('.floor-display')?.textContent).toBe('05');
    expect(destination.disabled).toBe(false);
    expect(service.selectedElevator().state).toBe('open');
  });

  it('wires playback speed and pause controls to time and their accessible state', () => {
    click(buttonByLabel('Elevator A: go to floor 5'));
    const speed = buttonByLabel('Speed 4x');
    click(speed);
    expect(service.speed()).toBe(4);
    expect(speed.getAttribute('aria-pressed')).toBe('true');
    advance(100);
    expect(service.snapshot().elapsedMs).toBe(400);

    click(buttonByLabel('Pause simulation'));
    expect(service.paused()).toBe(true);
    expect(buttonByLabel('Resume simulation').getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.building-model')?.classList.contains('is-paused')).toBe(true);
    advance(5000);
    expect(service.snapshot().elapsedMs).toBe(400);

    click(buttonByLabel('Resume simulation'));
    advance(100);
    expect(service.paused()).toBe(false);
    expect(service.snapshot().elapsedMs).toBe(800);
    expect(root.querySelector('.building-model')?.classList.contains('is-paused')).toBe(false);
  });

  it('starts the demo and fully cancels its scheduled work through Reset', () => {
    click(buttonByText('Run scenario'));
    expect(service.activeCount()).toBe(3);
    expect(buttonByText('Restart scenario')).toBeDefined();
    advance(2000);
    expect(metric('queue-count')).toBe('1');
    click(buttonByText('Reset'));
    expect(service.snapshot().elevators.map((elevator) => elevator.floor)).toEqual([1, 3, 5]);
    expect(service.activeCount()).toBe(0);
    expect(service.scenarioRunning()).toBe(false);
    expect(buttonByText('Run scenario')).toBeDefined();
    expect(root.querySelectorAll('.call-button.pending')).toHaveLength(0);
    expect(root.querySelectorAll('.destination-button.queued')).toHaveLength(0);
    advance(12_000);
    expect(service.activeCount()).toBe(0);
    expect(metric('queue-count')).toBe('0');
    expect(metric('served-count')).toBe('0');
  });

  it.skipIf(
    typeof HTMLDialogElement.prototype.showModal !== 'function' ||
      typeof HTMLDialogElement.prototype.close !== 'function',
  )('opens Help and closes it only when the backdrop is clicked', () => {
    const dialog = root.querySelector('dialog')!;
    click(buttonByText('How it works'));
    expect(dialog.open).toBe(true);
    dialog.querySelector('h2')!.click();
    expect(dialog.open).toBe(true);
    dialog.click();
    expect(dialog.open).toBe(false);
  });
});
