import { DOCUMENT, afterNextRender, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'level-theme';

function preference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selected = signal<ThemePreference>('system');
  private media: MediaQueryList | undefined;

  readonly preference = this.selected.asReadonly();

  constructor() {
    // The head script handles first paint; browser state is read after the initial render.
    afterNextRender(() => {
      const browser = this.document.defaultView;
      if (!browser) return;

      this.media = browser.matchMedia?.('(prefers-color-scheme: dark)');
      let initial = preference(this.document.documentElement.getAttribute('data-theme'));
      try {
        initial = preference(browser.localStorage.getItem(THEME_STORAGE_KEY));
      } catch {
        // Storage may be unavailable; the preference still works for this page.
      }
      this.apply(initial);

      const onSystemChange = () => {
        if (this.selected() === 'system') this.apply('system');
      };
      const onStorage = (event: StorageEvent) => {
        if (event.key === THEME_STORAGE_KEY || event.key === null) {
          this.apply(preference(event.newValue));
        }
      };
      this.media?.addEventListener('change', onSystemChange);
      browser.addEventListener('storage', onStorage);
      this.destroyRef.onDestroy(() => {
        this.media?.removeEventListener('change', onSystemChange);
        browser.removeEventListener('storage', onStorage);
      });
    });
  }

  select(value: ThemePreference): void {
    this.apply(value);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Do not block switching when storage is disabled or full.
    }
  }

  private apply(value: ThemePreference): void {
    this.selected.set(value);
    this.document.documentElement.setAttribute('data-theme', value);
    this.document.documentElement.style.colorScheme = value === 'system' ? 'light dark' : value;
    const dark = value === 'dark' || (value === 'system' && this.media?.matches);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#10131b' : '#f5f6f9');
  }
}
