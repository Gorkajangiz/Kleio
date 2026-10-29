import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { CryptoService } from '../../services/crypto.service';
import { PreferencesService } from '../../services/preference.service';
import { ToastService } from '../../services/toast.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { getAuthErrorMessage } from '../../utils/auth-errors';

@Component({
  selector: 'app-login-component',
  imports: [RouterLink, SpinnerComponent],
  templateUrl: './loginComponent.html',
  styleUrls: [
    './loginComponent.css',
    './loginComponentCushy.css'
  ],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class LoginComponent {
  private readonly prefs = inject(PreferencesService);
  private readonly authService = inject(AuthService);
  private readonly crypto = inject(CryptoService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly theme = this.prefs.theme;
  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);

  toggleTheme(): void {
    this.prefs.toggleTheme();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  async onLogin(event: Event, email: string, pass: string): Promise<void> {
    event.preventDefault();

    const cleanEmail = email.trim();
    if (!cleanEmail || !pass) {
      this.toast.warning('Por favor, introduce tu correo y contraseña.', 'Campos requeridos');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      this.toast.warning('Introduce un correo electrónico válido.', 'Formato no válido');
      return;
    }

    this.isLoading.set(true);

    try {
      await this.authService.login(cleanEmail, pass);

      const user = this.authService.getCurrentUser();
      if (!user) {
        throw new Error('No se pudo iniciar la sesión.');
      }

      if (this.crypto.hasLocalPin(user.uid)) {
        await this.router.navigate(['/unlock']);
        return;
      }

      await this.crypto.recoverWithPassword(user.uid, pass);
      this.toast.info(
        'Este dispositivo es nuevo. Crea un PIN para desbloquear tu diario.',
        'Último paso'
      );
      await this.router.navigate(['/pin-setup']);
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      this.toast.error(getAuthErrorMessage(err), 'Error de acceso');
    } finally {
      this.isLoading.set(false);
    }
  }
}
