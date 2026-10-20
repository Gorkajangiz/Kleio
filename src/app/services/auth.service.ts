import { inject, Injectable } from '@angular/core';

import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';

import { app } from '../firebase.config';
import { CryptoService } from './crypto.service';
import { PreferencesService } from './preference.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly auth = getAuth(app);
  private readonly crypto = inject(CryptoService);
  private readonly prefs = inject(PreferencesService);

  private readonly SESSION_FLAG = 'kleio-session-active';

  private async applyPersistence(): Promise<void> {
    const persistence = this.prefs.keepSession()
      ? browserLocalPersistence
      : browserSessionPersistence;

    await setPersistence(this.auth, persistence);
  }

  async setSessionPersistence(keepSession: boolean): Promise<void> {
    const persistence = keepSession
      ? browserLocalPersistence
      : browserSessionPersistence;

    await setPersistence(this.auth, persistence);
  }

  async login(email: string, password: string) {
    await this.applyPersistence();

    const credentials = await signInWithEmailAndPassword(this.auth, email, password);



    sessionStorage.setItem(this.SESSION_FLAG, '1');

    await this.crypto.unlock(credentials.user.uid, password);

    return credentials;
  }

  async register(name: string, email: string, password: string) {
    await this.applyPersistence();

    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await this.crypto.setup(credential.user.uid, password);


    sessionStorage.setItem(this.SESSION_FLAG, '1');

    return credential.user;
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  getAuthInstance() {
    return this.auth;
  }


  isSessionMarked(): boolean {
    return sessionStorage.getItem(this.SESSION_FLAG) === '1';
  }


  clearSessionMark(): void {
    sessionStorage.removeItem(this.SESSION_FLAG);
  }

  waitForAuthReady(): Promise<User | null> {
    return new Promise(resolve => {
      const unsub = onAuthStateChanged(this.auth, user => {
        unsub();
        resolve(user);
      });
    });
  }

  async tryRestoreCryptoKey(): Promise<boolean> {
    return this.crypto.restoreKey();
  }

  async logout(): Promise<void> {
    this.clearSessionMark();
    this.crypto.clearKey();
    await this.auth.signOut();
  }
}
