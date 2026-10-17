import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserSimulationClock } from './simulation-clock';

@Component({ template: '' })
class ClockHostComponent {}

describe('BrowserSimulationClock', () => {
  let clock: BrowserSimulationClock;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let hidden: boolean;
  let stop: () => void;

  beforeEach(() => {
    frames = new Map();
    nextFrameId = 0;
    hidden = false;
    stop = () => {};
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrameId, callback);
      return nextFrameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    TestBed.configureTestingModule({ imports: [ClockHostComponent] });
    clock = TestBed.inject(BrowserSimulationClock);
  });

  afterEach(() => {
    stop();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function frame(time: number): void {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  }

  function start(): ReturnType<typeof vi.fn<(deltaMs: number) => void>> {
    const listener = vi.fn<(deltaMs: number) => void>();
    stop = TestBed.runInInjectionContext(() => clock.start(listener));
    TestBed.createComponent(ClockHostComponent).detectChanges();
    return listener;
  }

  it('starts after rendering, limits update frequency, and caps stalled frame deltas', () => {
    const listener = vi.fn();
    const addListener = vi.spyOn(document, 'addEventListener');
    stop = TestBed.runInInjectionContext(() => clock.start(listener));
    expect(addListener.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(false);
    TestBed.createComponent(ClockHostComponent).detectChanges();
    expect(frames.size).toBe(1);

    frame(0);
    frame(16);
    frame(32);
    expect(listener).not.toHaveBeenCalled();
    frame(48);
    expect(listener).toHaveBeenLastCalledWith(48);
    frame(64);
    frame(80);
    expect(listener).toHaveBeenCalledTimes(1);
    frame(96);
    expect(listener).toHaveBeenCalledTimes(2);
    frame(10_000);
    expect(listener).toHaveBeenLastCalledWith(100);
  });

  it('discards hidden-tab time and establishes a fresh visible baseline', () => {
    const listener = start();
    frame(0);
    frame(40);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    frame(20_000);
    expect(listener).toHaveBeenCalledTimes(1);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    frame(30_000);
    expect(listener).toHaveBeenCalledTimes(1);
    frame(30_040);
    expect(listener).toHaveBeenLastCalledWith(40);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('discards accumulated partial frames when controls reset the baseline', () => {
    const listener = start();
    frame(0);
    frame(20);
    clock.resetBaseline();
    frame(10_000);
    expect(listener).not.toHaveBeenCalled();
    frame(10_040);
    expect(listener).toHaveBeenCalledExactlyOnceWith(40);
  });

  it('cancels the frame and removes its visibility listener on teardown', () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const listener = start();
    const visibilityListener = addListener.mock.calls.find(
      ([type]) => type === 'visibilitychange',
    )?.[1];
    expect(visibilityListener).toBeDefined();
    stop();
    expect(frames.size).toBe(0);
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith('visibilitychange', visibilityListener);
    frame(20_000);
    expect(listener).not.toHaveBeenCalled();
  });

  it('can be stopped before the first browser render without starting a frame', () => {
    const addListener = vi.spyOn(document, 'addEventListener');
    stop = TestBed.runInInjectionContext(() => clock.start(vi.fn()));
    stop();
    TestBed.createComponent(ClockHostComponent).detectChanges();
    expect(frames.size).toBe(0);
    expect(addListener.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(false);
  });
});
