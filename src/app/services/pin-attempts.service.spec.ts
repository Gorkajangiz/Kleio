import { TestBed } from '@angular/core/testing';
import { PinAttemptsService } from './pin-attempts.service';

describe('PinAttemptsService', () => {
  let service: PinAttemptsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PinAttemptsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('blocks after five failures and resets on success', () => {
    expect(service.remainingMs('user-1')).toBe(0);

    for (let i = 0; i < 4; i++) {
      expect(service.registerFailure('user-1')).toBe(0);
    }

    expect(service.registerFailure('user-1')).toBeGreaterThan(0);
    expect(service.remainingMs('user-1')).toBeGreaterThan(0);

    service.reset('user-1');
    expect(service.remainingMs('user-1')).toBe(0);
  });
});
