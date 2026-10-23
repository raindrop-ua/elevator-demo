import { Component, input } from '@angular/core';

const ICONS = {
  monitor: 'M3 3h18v13H3ZM12 16v5M8 21h8',
  sun: 'M12 3V1M12 23v-2M3 12H1M23 12h-2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',
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
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.css',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly icons = ICONS;
}
