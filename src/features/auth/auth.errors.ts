export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/user-disabled':
      return 'No pudimos iniciar sesión. Revisá el email y la contraseña.'
    case 'auth/email-already-in-use':
      return 'No pudimos crear la cuenta con esos datos. Revisalos o intentá iniciar sesión.'
    case 'auth/invalid-email':
      return 'Revisá el formato del email.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'La contraseña no cumple los requisitos. Usá al menos 8 caracteres.'
    case 'auth/too-many-requests':
      return 'Se realizaron demasiados intentos. Esperá unos minutos y volvé a intentar.'
    case 'auth/network-request-failed':
      return 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.'
    case 'auth/configuration-missing':
    case 'auth/invalid-api-key':
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
      return 'El acceso no está disponible por un problema de configuración. Intentá más tarde.'
    default:
      return 'No pudimos completar la solicitud. Intentá nuevamente.'
  }
}
