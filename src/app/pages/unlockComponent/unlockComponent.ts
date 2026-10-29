import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { PinAttemptsService } from '../../services/pin-attempts.service';
import { PreferencesService } from '../../services/preference.service';
import { ToastService } from '../../services/toast.service';
import { getAuthErrorMessage } from '../../utils/auth-errors';
import { CryptoError } from '../../utils/crypto';
import { PIN_LENGTH, isValidPin } from '../../utils/pin';

@Component({
  selector: 'app-unlock-component',
  imports: [SpinnerComponent],
  templateUrl: './unlockComponent.html',
  styleUrls: [
    '../loginComponent/loginComponent.css',
    '../loginComponent/loginComponentCushy.css',
    './unlockComponent.css',
  ],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class UnlockComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly crypto = inject(CryptoService);
  private readonly attempts = inject(PinAttemptsService);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');
  readonly email = signal('');
  readonly hasPin = signal(true);
  readonly pin = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly showRecovery = signal(false);
  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly blockedSeconds = signal(0);
  readonly pinLength = PIN_LENGTH;

  private uid = '';
  private countdown?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.uid = user?.uid ?? '';
    this.email.set(user?.email ?? '');
    this.hasPin.set(this.crypto.hasLocalPin(this.uid));
    this.showRecovery.set(!this.hasPin());
    this.refreshBlock();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  toggleTheme(): void {
    this.prefs.toggleTheme();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  onPinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    input.value = digits;
    this.pin.set(digits);
    this.error.set('');
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  async unlock(event: Event): Promise<void> {
    event.preventDefault();

    if (this.blockedSeconds() > 0) {
      this.error.set(
        `Espera ${this.blockedSeconds()} s antes de volver a intentarlo.`
      );
      return;
    }

    if (!isValidPin(this.pin())) {
      this.error.set('Introduce un PIN de 4 dígitos.');
      return;
    }

    if (!this.uid) {
      this.error.set('No hay una sesión activa.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    try {
      await this.crypto.unlockWithPin(this.uid, this.pin());
      this.attempts.reset(this.uid);
      await this.router.navigate(['/diario']);
    } catch (error) {
      if (error instanceof CryptoError && error.code === 'PIN_NOT_CONFIGURED') {
        this.hasPin.set(false);
        this.showRecovery.set(true);
        this.error.set(
          'Este dispositivo no tiene un PIN guardado. Recupera el acceso con tu contraseña.'
        );
        return;
      }

      const waitMs = this.attempts.registerFailure(this.uid);
      this.error.set(
        waitMs > 0
          ? `Demasiados intentos. Espera ${Math.ceil(waitMs / 1000)} s.`
          : 'PIN incorrecto. Inténtalo de nuevo.'
      );
      this.pin.set('');
      this.startCountdown();
    } finally {
      this.isLoading.set(false);
    }
  }

  async recover(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.uid) {
      this.error.set('No hay una sesión activa.');
      return;
    }

    if (!this.password()) {
      this.error.set('Introduce la contraseña de tu cuenta.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    try {
      await this.auth.reauthenticate(this.password());
      await this.crypto.recoverWithPassword(this.uid, this.password());
      this.attempts.reset(this.uid);
      this.password.set('');
      this.toast.success(
        'Acceso recuperado. Crea un nuevo PIN para este dispositivo.',
        'Recuperación completada'
      );
      await this.router.navigate(['/pin-setup']);
    } catch (error) {
      this.error.set(getAuthErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  private refreshBlock(): void {
    if (!this.uid) return;

    const remaining = this.attempts.remainingMs(this.uid);
    this.blockedSeconds.set(Math.ceil(remaining / 1000));

    if (remaining > 0) {
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.updateCountdown();
    this.countdown = setInterval(() => this.updateCountdown(), 1000);
  }

  private updateCountdown(): void {
    if (!this.uid) return;

    const remaining = this.attempts.remainingMs(this.uid);
    this.blockedSeconds.set(Math.ceil(remaining / 1000));

    if (remaining <= 0) {
      this.stopCountdown();
    }
  }

  private stopCountdown(): void {
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = undefined;
    }
  }
}
