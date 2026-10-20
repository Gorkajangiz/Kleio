import { Injectable } from '@angular/core';
import {
  doc,
  getDoc,
  getFirestore,
  setDoc
} from 'firebase/firestore';
import { app } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  private db = getFirestore(app);
  private masterKey: CryptoKey | null = null;

  private readonly PBKDF2_ITERATIONS = 600_000;


  private readonly STORAGE_KEY = 'diary.masterKey.v1';

  async setup(uid: string, password: string): Promise<void> {
    const masterKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await this.deriveKey(password, salt);

    const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivBuffer = this.toArrayBuffer(iv);

    const wrappedKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      wrappingKey,
      masterKeyRaw
    );

    await setDoc(
      doc(this.db, 'users', uid),
      {
        crypto: {
          salt: this.arrayToBase64(salt),
          iv: this.arrayToBase64(iv),
          wrappedKey: this.arrayToBase64(new Uint8Array(wrappedKey))
        }
      }
    );

    this.masterKey = masterKey;
    this.persistKeyBytes(masterKeyRaw);
  }

  async unlock(uid: string, password: string): Promise<void> {
    const userDoc = await getDoc(doc(this.db, 'users', uid));

    if (!userDoc.exists()) {
      throw new Error('No existe la configuración de cifrado.');
    }

    const data = userDoc.data()['crypto'];
    const salt = this.base64ToArray(data.salt);
    const iv = this.base64ToArray(data.iv);
    const wrappedKey = this.base64ToArray(data.wrappedKey);

    const wrappingKey = await this.deriveKey(password, salt);

    try {
      const ivBuffer = this.toArrayBuffer(iv);
      const wrappedKeyBuffer = this.toArrayBuffer(wrappedKey);

      const masterKeyRaw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        wrappingKey,
        wrappedKeyBuffer
      );

      this.masterKey = await crypto.subtle.importKey(
        'raw',
        masterKeyRaw,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      this.persistKeyBytes(masterKeyRaw);
    } catch {
      throw new Error('No se pudo desbloquear la clave de cifrado.');
    }
  }


  async restoreKey(): Promise<boolean> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return false;

    try {
      const bytes = this.base64ToArray(stored);

      this.masterKey = await crypto.subtle.importKey(
        'raw',
        this.toArrayBuffer(bytes),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      return true;
    } catch (err) {
      console.warn('No se pudo restaurar la clave maestra:', err);
      localStorage.removeItem(this.STORAGE_KEY);
      this.masterKey = null;
      return false;
    }
  }


  hasStoredKey(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  async encrypt(text: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('La clave de cifrado no está desbloqueada.');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);

    const ivBuffer = this.toArrayBuffer(iv);
    const encodedBuffer = this.toArrayBuffer(encoded);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      this.masterKey,
      encodedBuffer
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return this.arrayToBase64(result);
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('La clave de cifrado no está desbloqueada.');
    }

    const data = this.base64ToArray(encryptedText);
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    const ivBuffer = this.toArrayBuffer(iv);
    const encryptedBuffer = this.toArrayBuffer(encrypted);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      this.masterKey,
      encryptedBuffer
    );

    return new TextDecoder().decode(decrypted);
  }


  clearKey(): void {
    this.masterKey = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const saltBuffer = this.toArrayBuffer(salt);

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private persistKeyBytes(raw: ArrayBuffer): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        this.arrayToBase64(new Uint8Array(raw))
      );
    } catch (err) {
      console.warn('No se pudo persistir la clave maestra:', err);
    }
  }

  private toArrayBuffer(array: Uint8Array): ArrayBuffer {
    return array.buffer.slice(
      array.byteOffset,
      array.byteOffset + array.byteLength
    ) as ArrayBuffer;
  }

  private arrayToBase64(array: Uint8Array): string {
    let binary = '';
    array.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  private base64ToArray(base64: string): Uint8Array {
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }
}
