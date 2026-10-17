import { Component, input } from '@angular/core';
import type { ElevatorSnapshot } from '@domain/elevator';
import { IconComponent } from '@shared/ui/icon.component';

@Component({
  selector: 'app-state-machine',
  imports: [IconComponent],
  template: ` <section
    class="panel machine-panel"
    aria-labelledby="machine-title"
    [attr.data-elevator]="elevator().id"
  >
    <div class="panel-heading">
      <h2 id="machine-title">State machine</h2>
      <span class="machine-id">{{ elevator().id }}</span>
    </div>
    <div
      class="state-diagram"
      role="img"
      [attr.aria-label]="'Elevator state for ' + elevator().id + ': ' + elevator().state"
    >
      <svg class="connections" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker
            [id]="'arrow-' + elevator().id"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="m0 0 6 3-6 3" fill="#9aa3b4" />
          </marker>
        </defs>
        <g
          fill="none"
          stroke="#9aa3b4"
          stroke-width="1.15"
          [attr.marker-end]="'url(#arrow-' + elevator().id + ')'"
        >
          <path d="M113 32h26" />
          <path d="M257 32h25" />
          <path d="M383 34C412 34 403 110 362 110h-12" />
          <path d="M244 110h-61" />
          <path d="M72 110H42C-5 110-2 32 17 32" />
        </g>
      </svg>
      <div class="state-node idle" [class.active]="elevator().state === 'idle'">
        Idle<span>idle</span>
      </div>
      <div class="state-node moving" [class.active]="elevator().state.startsWith('moving')">
        Moving<span>{{ elevator().state === 'moving-down' ? 'moving-down' : 'moving-up' }}</span>
      </div>
      <div class="state-node opening" [class.active]="elevator().state === 'opening'">
        Opening<span>opening</span>
      </div>
      <div class="state-node open" [class.active]="elevator().state === 'open'">
        Boarding<span>open</span>
      </div>
      <div class="state-node closing" [class.active]="elevator().state === 'closing'">
        Closing<span>closing</span>
      </div>
    </div>
    <p class="panel-note">
      <app-icon name="info" /><span>Select an elevator to watch its state transitions.</span>
    </p>
  </section>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
      flex: 1;
    }
    .machine-panel {
      padding: 20px 20px 0;
      height: 100%;
    }
    .machine-id {
      background: var(--elevator-soft);
      color: var(--elevator-ink);
      font: 600 11px var(--mono);
      border-radius: 5px;
      padding: 4px 7px;
    }
    .state-diagram {
      height: 120px;
      margin: 16px -7px 0;
      position: relative;
    }
    .connections {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .state-node {
      position: absolute;
      width: 26%;
      height: 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 1px solid #cbd1dd;
      border-radius: 8px;
      background: linear-gradient(#fff, #f5f6f9);
      color: #31394a;
      font-size: 10px;
      transition:
        background 0.2s,
        border-color 0.2s;
    }
    .state-node span {
      font: 8px var(--mono);
      color: var(--muted);
    }
    .state-node.active {
      border-color: var(--elevator-color);
      background: var(--elevator-soft);
      color: var(--elevator-ink);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--elevator-soft), transparent 50%);
    }
    .state-node.active span {
      color: var(--elevator-ink);
    }
    .idle {
      top: 4px;
      left: 4%;
    }
    .moving {
      top: 4px;
      left: 37%;
    }
    .opening {
      top: 4px;
      right: 4%;
    }
    .open {
      top: 72px;
      right: 13%;
    }
    .closing {
      top: 72px;
      left: 18%;
    }
    .panel-note {
      min-height: 48px;
      font-size: 10px;
    }
    @media (max-width: 1120px) {
      .machine-panel {
        padding: 16px 16px 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .state-node {
        transition: none;
      }
    }
  `,
})
export class StateMachineComponent {
  readonly elevator = input.required<ElevatorSnapshot>();
}
