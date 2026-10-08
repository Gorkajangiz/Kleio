import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'cushy';
export type DrawerView = 'grid' | 'calendar';

@Injectable({ providedIn: 'root' })
export class PreferencesService {

  private readonly THEME_KEY = 'kleio-theme';
  private readonly DRAWER_KEY = 'kleio-drawer-view';
  private readonly KEEP_SESSION_KEY = 'kleio-keep-session';

  readonly theme = signal<AppTheme>(this.readTheme());
  readonly drawerView = signal<DrawerView>(this.readDrawerView());
  readonly keepSession = signal<boolean>(this.readKeepSession());

  toggleTheme(): void {
    this.theme.update(t => (t === 'dark' ? 'cushy' : 'dark'));
    localStorage.setItem(this.THEME_KEY, this.theme());
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  setDrawerView(view: DrawerView): void {
    this.drawerView.set(view);
    localStorage.setItem(this.DRAWER_KEY, view);
  }

  setKeepSession(value: boolean): void {
    this.keepSession.set(value);
    localStorage.setItem(this.KEEP_SESSION_KEY, String(value));
  }

  // ── Lectura inicial ────────────────────────────────
  private readTheme(): AppTheme {
    const stored = localStorage.getItem(this.THEME_KEY);
    return stored === 'cushy' ? 'cushy' : 'dark';
  }

  private readDrawerView(): DrawerView {
    const stored = localStorage.getItem(this.DRAWER_KEY);
    return stored === 'calendar' ? 'calendar' : 'grid';
  }

  private readKeepSession(): boolean {
    const stored = localStorage.getItem(this.KEEP_SESSION_KEY);
    // Por defecto: sesión permanente
    if (stored === null) return true;
    return stored === 'true';
  }
}
