import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CryptoService } from '../services/crypto.service';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const crypto = inject(CryptoService);
  const router = inject(Router);

  const user = await auth.waitForAuthReady();
  if (!user) return true;

  if (!crypto.isUnlocked()) {
    return router.createUrlTree(['/unlock']);
  }

  return crypto.hasLocalPin(user.uid)
    ? router.createUrlTree(['/diario'])
    : router.createUrlTree(['/pin-setup']);
};
