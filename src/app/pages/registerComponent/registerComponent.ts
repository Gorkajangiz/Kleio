import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { PreferencesService } from '../../services/preference.service';
import { ToastService } from '../../services/toast.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { getAuthErrorMessage } from '../../utils/auth-errors';

@Component({
  selector: 'app-register-component',
  imports: [RouterLink, SpinnerComponent],
  templateUrl: './registerComponent.html',
  styleUrls: ['./registerComponent.css', './registerComponentCushy.css'],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class RegisterComponent {
  private readonly prefs = inject(PreferencesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly theme = this.prefs.theme;
  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');

  readonly isLoading = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  toggleTheme(): void {
    this.prefs.toggleTheme();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  async onRegister(
    event: Event,
    name: string,
    email: string,
    pass: string,
    confirmPass: string
  ): Promise<void> {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !pass || !confirmPass) {
      this.toast.warning('Por favor completa todos los campos requeridos.', 'Campos incompletos');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      this.toast.warning('Introduce un correo electrónico válido.', 'Formato no válido');
      return;
    }

    if (pass.length < 6) {
      this.toast.warning('La contraseña debe tener al menos 6 caracteres.', 'Contraseña corta');
      return;
    }

    if (pass !== confirmPass) {
      this.toast.error('Las contraseñas no coinciden. Por favor, revísalas.', 'Error de verificación');
      return;
    }

    this.isLoading.set(true);

    try {
      await this.authService.register(cleanName, cleanEmail, pass);
      this.toast.success('¡Tu cuenta ha sido creada exitosamente!', 'Bienvenido a Kleio');
      await this.router.navigate(['/diario']);
    } catch (err) {
      console.error('Error al registrar usuario:', err);
      this.toast.error(getAuthErrorMessage(err), 'Error en el registro');
    } finally {
      this.isLoading.set(false);
    }
  }
}
