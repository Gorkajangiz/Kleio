import { Component, inject } from '@angular/core';
import { ToastService, ToastType } from '../../services/toast.service';
import { PreferencesService } from '../../services/preference.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
  host: {
    '[class.cushy-theme]': 'prefs.theme() === "cushy"',
  },
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
  readonly prefs = inject(PreferencesService);

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}

