import { Component, inject } from '@angular/core';
import { ThemeService, type ThemePreference } from '../theme/theme.service';
import { IconComponent, type IconName } from './icon.component';

@Component({
  selector: 'app-theme-switcher',
  imports: [IconComponent],
  templateUrl: './theme-switcher.component.html',
  styleUrl: './theme-switcher.component.css',
})
export class ThemeSwitcherComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly modes = [
    { value: 'system', label: 'System', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ] as const satisfies readonly { value: ThemePreference; label: string; icon: IconName }[];
}
