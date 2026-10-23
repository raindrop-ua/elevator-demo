import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeSwitcherComponent } from '../ui/theme-switcher.component';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('Theme preferences', () => {
  let fixture: ComponentFixture<ThemeSwitcherComponent> | undefined;
  let service: ThemeService;
  let dark: boolean;
  let changes: EventTarget;
  let media: MediaQueryList;
  let meta: HTMLMetaElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    dark = true;
    changes = new EventTarget();
    media = {
      get matches() {
        return dark;
      },
      addEventListener: vi.fn(changes.addEventListener.bind(changes)),
      removeEventListener: vi.fn(changes.removeEventListener.bind(changes)),
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    TestBed.configureTestingModule({ imports: [ThemeSwitcherComponent] });
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    meta.remove();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(ThemeSwitcherComponent);
    service = TestBed.inject(ThemeService);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('defaults to the system and follows live OS changes without saving an override', () => {
    render();
    expect(service.preference()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(meta.content).toBe('#10131b');
    expect(document.documentElement.style.colorScheme).toBe('light dark');
    dark = false;
    changes.dispatchEvent(new Event('change'));
    expect(meta.content).toBe('#f5f6f9');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('restores a saved override and exposes three accessible, working buttons', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const root = render();
    expect(meta.content).toBe('#f5f6f9');
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'System theme',
      'Light theme',
      'Dark theme',
    ]);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[2].click();
    fixture!.detectChanges();
    expect(service.preference()).toBe('dark');
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    dark = false;
    changes.dispatchEvent(new Event('change'));
    expect(meta.content).toBe('#10131b');
    buttons[0].click();
    expect(service.preference()).toBe('system');
    expect(meta.content).toBe('#f5f6f9');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('falls back to the system for an invalid saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    render();
    expect(service.preference()).toBe('system');
    expect(meta.content).toBe('#10131b');
  });

  it('keeps theme switching usable when storage reads and writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    render();
    expect(service.preference()).toBe('system');
    expect(() => service.select('light')).not.toThrow();
    expect(meta.content).toBe('#f5f6f9');
    expect(service.preference()).toBe('light');
  });

  it('syncs changes and resets from another tab, then removes browser listeners', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    render();
    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }),
    );
    expect(service.preference()).toBe('light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'dark' }));
    expect(service.preference()).toBe('light');
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(service.preference()).toBe('system');
    fixture!.destroy();
    fixture = undefined;
    TestBed.resetTestingModule();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }),
    );
    expect(service.preference()).toBe('system');
  });
});
