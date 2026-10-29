import { Injectable } from '@angular/core';
import { WrappedKey } from '../utils/crypto';

export interface PinEnvelope extends WrappedKey {
  version: 2;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class LocalKeyStore {
  private readonly PREFIX = 'kleio.lock.v2.';

  get(uid: string): PinEnvelope | null {
    const raw = localStorage.getItem(this.key(uid));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<PinEnvelope>;
      if (
        parsed.version !== 2 ||
        typeof parsed.salt !== 'string' ||
        typeof parsed.iv !== 'string' ||
        typeof parsed.wrappedKey !== 'string'
      ) {
        return null;
      }

      return parsed as PinEnvelope;
    } catch {
      return null;
    }
  }

  save(uid: string, envelope: PinEnvelope): void {
    localStorage.setItem(this.key(uid), JSON.stringify(envelope));
  }

  has(uid: string): boolean {
    return this.get(uid) !== null;
  }

  remove(uid: string): void {
    localStorage.removeItem(this.key(uid));
  }

  private key(uid: string): string {
    return `${this.PREFIX}${uid}`;
  }
}
