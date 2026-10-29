import { inject, Injectable, signal } from '@angular/core';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { app } from '../firebase.config';
import {
  CryptoError,
  PBKDF2_ITERATIONS,
  WrappedKey,
  decryptText,
  encryptText,
  generateMasterKey,
  importMasterKey,
  unwrapMasterKey,
  wrapMasterKey,
} from '../utils/crypto';
import { LocalKeyStore } from './local-key.store';

interface StoredCrypto {
  recovery?: WrappedKey;
  salt?: string;
  iv?: string;
  wrappedKey?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private readonly db = getFirestore(app);
  private readonly localKeys = inject(LocalKeyStore);

  private masterKey: CryptoKey | null = null;
  readonly unlocked = signal(false);

  async createRecovery(uid: string, password: string): Promise<void> {
    const key = await generateMasterKey();
    const raw = await crypto.subtle.exportKey('raw', key);

    await this.writeRecovery(uid, raw, password);
    await this.useMasterKey(raw);
  }

  async unlockWithPin(uid: string, pin: string): Promise<void> {
    const envelope = this.localKeys.get(uid);
    if (!envelope) {
      throw new CryptoError(
        'PIN_NOT_CONFIGURED',
        'Este dispositivo todavía no tiene un PIN configurado.'
      );
    }

    const raw = await unwrapMasterKey(envelope, pin);
    await this.useMasterKey(raw);
  }

  async recoverWithPassword(uid: string, password: string): Promise<void> {
    const snapshot = await getDoc(doc(this.db, 'users', uid));
    if (!snapshot.exists()) {
      throw new CryptoError(
        'RECOVERY_NOT_FOUND',
        'No existe una copia de recuperación para esta cuenta.'
      );
    }

    const stored = snapshot.data()['crypto'] as StoredCrypto | undefined;
    const recovery = stored?.recovery ?? this.legacyRecovery(stored);

    if (!recovery) {
      throw new CryptoError(
        'RECOVERY_NOT_FOUND',
        'No existe una copia de recuperación para esta cuenta.'
      );
    }

    const raw = await unwrapMasterKey(recovery, password);
    await this.useMasterKey(raw);
  }

  async setPin(uid: string, pin: string): Promise<void> {
    const raw = await this.exportMasterKey();
    const wrapped = await wrapMasterKey(raw, pin);

    this.localKeys.save(uid, {
      version: 2,
      ...wrapped,
      createdAt: Date.now(),
    });
    this.clearLegacyStorage();
  }

  async rewrapRecovery(uid: string, password: string): Promise<void> {
    const raw = await this.exportMasterKey();
    await this.writeRecovery(uid, raw, password);
  }

  hasLocalPin(uid: string): boolean {
    return this.localKeys.has(uid);
  }

  removeLocalPin(uid: string): void {
    this.localKeys.remove(uid);
  }

  lock(): void {
    this.masterKey = null;
    this.unlocked.set(false);
  }

  isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  async encrypt(text: string): Promise<string> {
    return encryptText(this.requireMasterKey(), text);
  }

  async decrypt(encryptedText: string): Promise<string> {
    return decryptText(this.requireMasterKey(), encryptedText);
  }

  private async writeRecovery(
    uid: string,
    rawMasterKey: ArrayBuffer,
    password: string
  ): Promise<void> {
    const recovery = await wrapMasterKey(rawMasterKey, password);

    await setDoc(
      doc(this.db, 'users', uid),
      {
        crypto: {
          version: 2,
          kdf: {
            name: 'PBKDF2',
            hash: 'SHA-256',
            iterations: PBKDF2_ITERATIONS,
          },
          recovery,
        },
      },
      { merge: true }
    );
  }

  private async useMasterKey(raw: ArrayBuffer): Promise<void> {
    this.masterKey = await importMasterKey(raw);
    this.unlocked.set(true);
    this.clearLegacyStorage();
  }

  private async exportMasterKey(): Promise<ArrayBuffer> {
    if (!this.masterKey) {
      throw new CryptoError(
        'KEY_NOT_UNLOCKED',
        'La clave de cifrado no está desbloqueada.'
      );
    }

    return crypto.subtle.exportKey('raw', this.masterKey);
  }

  private requireMasterKey(): CryptoKey {
    if (!this.masterKey) {
      throw new CryptoError(
        'KEY_NOT_UNLOCKED',
        'La clave de cifrado no está desbloqueada.'
      );
    }

    return this.masterKey;
  }

  private legacyRecovery(stored?: StoredCrypto): WrappedKey | null {
    if (!stored?.salt || !stored.iv || !stored.wrappedKey) {
      return null;
    }

    return {
      salt: stored.salt,
      iv: stored.iv,
      wrappedKey: stored.wrappedKey,
    };
  }

  private clearLegacyStorage(): void {
    localStorage.removeItem('diary.masterKey.v1');
  }
}
