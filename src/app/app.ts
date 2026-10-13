import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast.component';
import { PreferencesService } from './services/preference.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[class.cushy-theme]': 'isCushy()',
  },
})
export class App {
  private readonly prefs = inject(PreferencesService);
  protected readonly title = signal('Kleio');
  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');
}
