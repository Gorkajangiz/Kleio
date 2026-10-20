import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
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
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly theme = this.prefs.theme;
  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly keepSession = signal(this.prefs.keepSession());

  toggleTheme(): void {
    this.prefs.toggleTheme();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleKeepSession(): void {
    const nextVal = !this.keepSession();
    this.keepSession.set(nextVal);
    this.prefs.setKeepSession(nextVal);
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
      await this.authService.setSessionPersistence(this.keepSession());

      await this.authService.login(cleanEmail, pass);
      this.toast.success('¡Bienvenido de vuelta a Kleio!', 'Sesión iniciada');
      await this.router.navigate(['/diario']);
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      this.toast.error(getAuthErrorMessage(err), 'Error de acceso');
    } finally {
      this.isLoading.set(false);
    }
  }
}
