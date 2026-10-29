import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CryptoService } from '../services/crypto.service';

export const unlockedGuard: CanActivateFn = () => {
  const crypto = inject(CryptoService);
  const router = inject(Router);

  return crypto.isUnlocked() ? true : router.createUrlTree(['/unlock']);
};

export const lockedGuard: CanActivateFn = () => {
  const crypto = inject(CryptoService);
  const router = inject(Router);

  return crypto.isUnlocked() ? router.createUrlTree(['/diario']) : true;
};

export const pinConfiguredGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const crypto = inject(CryptoService);
  const router = inject(Router);

  const user = await auth.waitForAuthReady();
  if (!user) return router.createUrlTree(['/login']);

  return crypto.hasLocalPin(user.uid)
    ? true
    : router.createUrlTree(['/pin-setup']);
};
