
export function getAuthErrorMessage(error: any): string {
  if (!error) {
    return 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.';
  }

  const code: string = error.code || (typeof error.message === 'string' ? error.message : '');

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Correo electrónico o contraseña incorrectos.';

    case 'auth/user-not-found':
      return 'No existe ninguna cuenta registrada con este correo.';

    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo electrónico. Inicia sesión en su lugar.';

    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';

    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';

    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por tu seguridad, espera unos minutos antes de volver a intentar.';

    case 'auth/network-request-failed':
      return 'Problema de conexión a internet. Revisa tu red e inténtalo de nuevo.';

    case 'auth/user-disabled':
      return 'Esta cuenta ha sido suspendida. Contacta con soporte.';

    case 'auth/operation-not-allowed':
      return 'Este método de autenticación no está habilitado actualmente.';

    default:
      if (typeof error.message === 'string' && error.message.includes('Firebase:')) {

        return error.message.replace(/Firebase:\s*/i, '').trim();
      }
      return 'Ha ocurrido un error al procesar tu solicitud. Inténtalo más tarde.';
  }
}

