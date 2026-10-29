import { TestBed } from '@angular/core/testing';
import { LocalKeyStore } from './local-key.store';

describe('LocalKeyStore', () => {
  let store: LocalKeyStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(LocalKeyStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saves, reads and removes an envelope', () => {
    const envelope = {
      version: 2 as const,
      salt: 'salt',
      iv: 'iv',
      wrappedKey: 'wrapped',
      createdAt: 123,
    };

    store.save('user-1', envelope);

    expect(store.has('user-1')).toBe(true);
    expect(store.get('user-1')).toEqual(envelope);

    store.remove('user-1');
    expect(store.has('user-1')).toBe(false);
  });

  it('ignores invalid stored data', () => {
    localStorage.setItem('kleio.lock.v2.user-1', 'not-json');
    expect(store.get('user-1')).toBeNull();
  });
});
