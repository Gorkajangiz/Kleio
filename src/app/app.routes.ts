import { Routes } from '@angular/router';

import { LoginComponent } from './pages/loginComponent/loginComponent';
import { RegisterComponent } from './pages/registerComponent/registerComponent';
import { DiaryComponent } from './pages/diaryComponent/diaryComponent';
import { UnlockComponent } from './pages/unlockComponent/unlockComponent';
import { PinSetupComponent } from './pages/pinSetupComponent/pinSetupComponent';

import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import {
  lockedGuard,
  pinConfiguredGuard,
  unlockedGuard,
} from './guards/crypto.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },

  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard],
  },

  {
    path: 'unlock',
    component: UnlockComponent,
    canActivate: [authGuard, lockedGuard],
  },

  {
    path: 'pin-setup',
    component: PinSetupComponent,
    canActivate: [authGuard, unlockedGuard],
  },

  {
    path: 'diario',
    component: DiaryComponent,
    canActivate: [authGuard, unlockedGuard, pinConfiguredGuard],
  },

  {
    path: '',
    redirectTo: 'diario',
    pathMatch: 'full',
  },

  {
    path: '**',
    redirectTo: 'diario',
  },
];
