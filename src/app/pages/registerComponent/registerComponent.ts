import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';

type Theme = 'dark' | 'cushy';

@Component({
  selector: 'app-register-component',
  imports: [RouterLink],
  templateUrl: './registerComponent.html',
  styleUrls: ['./registerComponent.css', './registerComponentCushy.css'],
  host: { '[class.cushy-theme]': 'isCushy()' },
})
export class RegisterComponent {
  authService = inject(AuthService);
  router = inject(Router);

  theme = signal<Theme>(this.readStoredTheme());
  isCushy = computed(() => this.theme() === 'cushy');

  toggleTheme() {
    this.theme.update(t => (t === 'dark' ? 'cushy' : 'dark'));
    try {
      localStorage.setItem('kleio-theme', this.isCushy() ? 'cushy' : 'default');
    } catch { }
  }

  onRegister(name: string, email: string, password: string) {
    this.authService.register(name, email, password)
      .then(() => this.router.navigate(['/diario']))
      .catch(err => console.log('error', err));
  }

  private readStoredTheme(): Theme {
    try {
      const stored = localStorage.getItem('kleio-theme');
      return stored === 'cushy' ? 'cushy' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
