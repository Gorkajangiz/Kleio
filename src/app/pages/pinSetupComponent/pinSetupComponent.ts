import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { PinAttemptsService } from '../../services/pin-attempts.service';
import { PreferencesService } from '../../services/preference.service';
import { ToastService } from '../../services/toast.service';
import { PIN_LENGTH, isValidPin } from '../../utils/pin';

@Component({
  selector: 'app-pin-setup-component',
  imports: [SpinnerComponent],
  templateUrl: './pinSetupComponent.html',
  styleUrls: [
    '../loginComponent/loginComponent.css',
    '../loginComponent/loginComponentCushy.css',
    './pinSetupComponent.css',
  ],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class PinSetupComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly crypto = inject(CryptoService);
  private readonly attempts = inject(PinAttemptsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');
  readonly isChange = signal(false);
  readonly pin = signal('');
  readonly confirmPin = signal('');
  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly pinLength = PIN_LENGTH;

  private uid = '';

  ngOnInit(): void {
    this.uid = this.auth.getCurrentUser()?.uid ?? '';
    this.isChange.set(this.uid ? this.crypto.hasLocalPin(this.uid) : false);
  }

  toggleTheme(): void {
    this.prefs.toggleTheme();
  }

  onPinInput(event: Event, target: 'pin' | 'confirm'): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    input.value = digits;

    if (target === 'pin') {
      this.pin.set(digits);
    } else {
      this.confirmPin.set(digits);
    }

    this.error.set('');
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.uid) {
      this.error.set('No hay una sesión activa.');
      return;
    }

    if (!isValidPin(this.pin())) {
      this.error.set('El PIN debe tener exactamente 4 dígitos.');
      return;
    }

    if (this.pin() !== this.confirmPin()) {
      this.error.set('Los dos PIN no coinciden.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    try {
      await this.crypto.setPin(this.uid, this.pin());
      this.attempts.reset(this.uid);
      this.toast.success(
        this.isChange()
          ? 'Tu PIN se ha actualizado correctamente.'
          : 'Tu diario ya está protegido con un PIN.',
        'Seguridad'
      );
      await this.router.navigate(['/diario']);
    } catch (error) {
      console.error('Error guardando el PIN:', error);
      this.error.set('No se pudo guardar el PIN. Inténtalo de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/diario']);
  }
}
