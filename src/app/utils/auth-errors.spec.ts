import { getAuthErrorMessage } from './auth-errors';

describe('getAuthErrorMessage', () => {
  it('should return default message for null/undefined', () => {
    expect(getAuthErrorMessage(null)).toContain('error inesperado');
  });

  it('should translate invalid credentials', () => {
    expect(getAuthErrorMessage({ code: 'auth/invalid-credential' })).toContain('incorrectos');
  });

  it('should translate email already in use', () => {
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toContain('Ya existe una cuenta');
  });

  it('should translate weak password', () => {
    expect(getAuthErrorMessage({ code: 'auth/weak-password' })).toContain('al menos 6 caracteres');
  });
});

