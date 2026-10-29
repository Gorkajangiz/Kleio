import { inject, Injectable } from '@angular/core';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';

import { app } from '../firebase.config';
import { CryptoService } from './crypto.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getAuth(app);
  private readonly crypto = inject(CryptoService);

  async login(email: string, password: string) {
    await setPersistence(this.auth, browserLocalPersistence);
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(name: string, email: string, password: string) {
    await setPersistence(this.auth, browserLocalPersistence);

    const credential = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
    await updateProfile(credential.user, { displayName: name });

    return credential.user;
  }

  async reauthenticate(password: string): Promise<User> {
    const user = this.auth.currentUser;
    if (!user?.email) {
      throw new Error('No hay una sesión activa.');
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    return user;
  }

  async deleteCurrentUser(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    await deleteUser(user);
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  getAuthInstance() {
    return this.auth;
  }

  waitForAuthReady(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async logout(): Promise<void> {
    // Keep the device PIN envelope so returning to this browser only requires
    // the PIN again. The encrypted envelope stays protected by the PIN.
    this.crypto.lock();
    await this.auth.signOut();
  }
}
