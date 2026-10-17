import { afterNextRender, Injectable, InjectionToken, inject } from '@angular/core';

/** The application receives elapsed time, never reads the wall clock itself. */
export interface SimulationClock {
  start(onFrame: (deltaMs: number) => void): () => void;
  resetBaseline(): void;
}

/** Browser adapter. No browser globals are read during server rendering. */
@Injectable({ providedIn: 'root' })
export class BrowserSimulationClock implements SimulationClock {
  private resetFrame = () => {};

  resetBaseline(): void {
    this.resetFrame();
  }

  start(onFrame: (deltaMs: number) => void): () => void {
    let stopped = false;
    let stopBrowser = () => {};
    const renderRef = afterNextRender(() => {
      if (stopped) return;

      let frameId = 0;
      let previousTime: number | null = null;
      let accumulatedMs = 0;
      const reset = () => {
        previousTime = null;
        accumulatedMs = 0;
      };
      this.resetFrame = reset;

      const frame = (time: number) => {
        if (stopped) return;
        if (document.hidden) {
          reset();
        } else if (previousTime === null) {
          previousTime = time;
        } else {
          accumulatedMs += Math.min(Math.max(time - previousTime, 0), 100);
          previousTime = time;
          // Publish at most 30 times/second; retain elapsed time between frames.
          if (accumulatedMs >= 1000 / 30) {
            const elapsed = Math.min(accumulatedMs, 100);
            accumulatedMs = 0;
            onFrame(elapsed);
          }
        }
        frameId = window.requestAnimationFrame(frame);
      };

      document.addEventListener('visibilitychange', reset);
      frameId = window.requestAnimationFrame(frame);
      stopBrowser = () => {
        window.cancelAnimationFrame(frameId);
        document.removeEventListener('visibilitychange', reset);
        this.resetFrame = () => {};
      };
    });

    return () => {
      stopped = true;
      renderRef.destroy();
      stopBrowser();
    };
  }
}

/** Tests provide a manual clock; production uses the browser adapter. */
export const SIMULATION_CLOCK = new InjectionToken<SimulationClock>('SIMULATION_CLOCK', {
  providedIn: 'root',
  factory: () => inject(BrowserSimulationClock),
});
