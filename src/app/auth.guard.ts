import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { Observable } from 'rxjs';
import { AuthService } from './services/auth.service';
import { CryptoService } from './services/crypto.service';
import { PreferencesService } from './services/preference.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const crypto = inject(CryptoService);
  const authService = inject(AuthService);
  const prefs = inject(PreferencesService);

  return new Observable<boolean | ReturnType<Router['createUrlTree']>>(
    subscriber => {
      const unsubscribe = onAuthStateChanged(
        authService.getAuthInstance(),
        async user => {
          // 1. Sin usuario → al login
          if (!user) {
            subscriber.next(router.createUrlTree(['/login']));
            subscriber.complete();
            return;
          }

          // 2. keepSession=false y esta pestaña NO está marcada
          //    → significa que el navegador se cerró y reabrió,
          //    o es una pestaña nueva. Forzamos logout.
          if (!prefs.keepSession() && !authService.isSessionMarked()) {
            console.warn('[AUTH GUARD] keepSession=false sin marca de sesión → logout');
            await authService.logout();
            subscriber.next(router.createUrlTree(['/login']));
            subscriber.complete();
            return;
          }

          // 3. Autenticado pero sin master key → forzar login
          if (!crypto.isUnlocked()) {
            const restored = await crypto.restoreKey();
            if (!restored) {
              console.warn('[AUTH GUARD] Sin master key → logout');
              await authService.logout();
              subscriber.next(router.createUrlTree(['/login']));
              subscriber.complete();
              return;
            }
          }

          subscriber.next(true);
          subscriber.complete();
        }
      );

      return unsubscribe;
    }
  );
};
