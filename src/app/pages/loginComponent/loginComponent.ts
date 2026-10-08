import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { PreferencesService } from '../../services/preference.service';

@Component({
  selector: 'app-login-component',
  imports: [RouterLink],
  templateUrl: './loginComponent.html',
  styleUrls: [
    './loginComponent.css',
    './loginComponentCushy.css'
  ],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class LoginComponent {

  // Orden importante: `prefs` primero porque `theme` y `isCushy` dependen de él.
  private readonly prefs = inject(PreferencesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Signal COMPARTIDO con el resto de la app. */
  readonly theme = this.prefs.theme;

  readonly isCushy = computed(() => this.prefs.theme() === 'cushy');

  toggleTheme(): void {
    // Actualiza el signal de PreferencesService Y localStorage a la vez.
    this.prefs.toggleTheme();
  }

  onLogin(email: string, password: string): void {
    this.authService.login(email, password)
      .then(() => this.router.navigate(['/diario']))
      .catch(err => console.error('Error al iniciar sesión:', err));
  }
}
