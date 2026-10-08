import { Routes } from '@angular/router';

import { LoginComponent } from './pages/loginComponent/loginComponent';
import { RegisterComponent } from './pages/registerComponent/registerComponent';
import { DiaryComponent } from './pages/diaryComponent/diaryComponent';

import { authGuard } from './auth.guard';

export const routes: Routes = [

  {
    path: 'login',
    component: LoginComponent,
  },

  {
    path: 'register',
    component: RegisterComponent,
  },

  {
    path: 'diario',
    component: DiaryComponent,
    canActivate: [authGuard],
  },

  {
    path: '**',
    redirectTo: 'login',
  },

];
