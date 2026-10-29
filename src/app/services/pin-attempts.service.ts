import { Injectable } from '@angular/core';

interface AttemptState {
  failures: number;
  blockedUntil: number;
}

const STORAGE_PREFIX = 'kleio.pin.attempts.';
const ATTEMPTS_PER_BLOCK = 5;
const BLOCK_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class PinAttemptsService {
  remainingMs(uid: string): number {
    const state = this.read(uid);
    return Math.max(0, state.blockedUntil - Date.now());
  }

  registerFailure(uid: string): number {
    const state = this.read(uid);
    const failures = state.failures + 1;

    if (failures >= ATTEMPTS_PER_BLOCK) {
      this.write(uid, { failures: 0, blockedUntil: Date.now() + BLOCK_MS });
      return BLOCK_MS;
    }

    this.write(uid, { failures, blockedUntil: 0 });
    return 0;
  }

  reset(uid: string): void {
    localStorage.removeItem(this.key(uid));
  }

  private read(uid: string): AttemptState {
    const raw = localStorage.getItem(this.key(uid));
    if (!raw) return { failures: 0, blockedUntil: 0 };

    try {
      const parsed = JSON.parse(raw) as Partial<AttemptState>;
      return {
        failures:
          typeof parsed.failures === 'number' && parsed.failures >= 0
            ? parsed.failures
            : 0,
        blockedUntil:
          typeof parsed.blockedUntil === 'number' ? parsed.blockedUntil : 0,
      };
    } catch {
      return { failures: 0, blockedUntil: 0 };
    }
  }

  private write(uid: string, state: AttemptState): void {
    localStorage.setItem(this.key(uid), JSON.stringify(state));
  }

  private key(uid: string): string {
    return `${STORAGE_PREFIX}${uid}`;
  }
}
