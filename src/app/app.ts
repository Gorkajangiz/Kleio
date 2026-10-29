import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast.component';
import { PreferencesService } from './services/preference.service';
import { PlatformService } from './services/platform.service';
import { AndroidShellComponent } from './android/android-shell/android-shell.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, AndroidShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[class.cushy-theme]': 'isCushy()',
    '[class.is-android]': 'isAndroid',
  },
})
export class App implements OnInit {
  private readonly prefs = inject(PreferencesService);
  private readonly platform = inject(PlatformService);
  protected readonly title = signal('Kleio');
  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');
  readonly isAndroid = this.platform.isAndroid;

  async ngOnInit() {
    if (this.platform.isAndroid) {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Light });
      await SplashScreen.hide();
    }
  }
}
