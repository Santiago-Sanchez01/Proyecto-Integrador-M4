export function authErrorMessage(error: unknown, method: 'password' | 'google' = 'password'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/user-disabled':
      if (method === 'google') return 'No pudimos iniciar sesión con esa cuenta de Google. Probá con otra cuenta.'
      return 'No pudimos iniciar sesión. Revisá el email y la contraseña.'
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con ese email. Ingresá con el método que usaste al crearla.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Se cerró la ventana de Google. Podés volver a intentar.'
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes para este sitio y reintentá.'
    case 'auth/operation-not-allowed':
      if (method === 'google') return 'El acceso con Google no está habilitado. Podés ingresar con email y contraseña.'
      return 'El acceso no está disponible por un problema de configuración. Intentá más tarde.'
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
    case 'auth/unauthorized-domain':
      return 'El acceso no está disponible por un problema de configuración. Intentá más tarde.'
    default:
      return 'No pudimos completar la solicitud. Intentá nuevamente.'
  }
}
