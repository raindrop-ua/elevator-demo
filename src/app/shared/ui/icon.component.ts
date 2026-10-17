import { Component, input } from '@angular/core';

const ICONS = {
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  help: 'M9.2 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  close: 'm6 6 12 12M6 18 18 6',
  clock: 'M12 6v6l4 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'm5 12 4 4L19 6',
  queue:
    'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-5a6 6 0 0 1 12 0v5ZM17 3a3 3 0 0 1 0 6M18 12a5 5 0 0 1 4 5v4',
} as const;
export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="icons[name()]" [attr.fill]="name() === 'play' ? 'currentColor' : 'none'" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 1.25rem;
      height: 1.25rem;
      flex: 0 0 auto;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly icons = ICONS;
}
