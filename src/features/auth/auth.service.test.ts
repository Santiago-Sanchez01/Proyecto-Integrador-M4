import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase'
import { login, loginWithGoogle, logout, observeSession, register } from './auth.service'

vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: vi.fn() }))
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: class GoogleAuthProvider {},
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

const auth = {} as ReturnType<typeof getFirebaseAuth>

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getFirebaseAuth).mockReturnValue(auth)
})

describe('Servicio oficial de autenticación', () => {
  it('usa el popup de Firebase con el proveedor Google y la instancia Auth compartida', async () => {
    await loginWithGoogle()
    expect(signInWithPopup).toHaveBeenCalledExactlyOnceWith(auth, expect.any(GoogleAuthProvider))
  })

  it('envía registro y login a las operaciones modulares de Firebase', async () => {
    await register('persona@example.com', 'clave-de-prueba')
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'persona@example.com', 'clave-de-prueba')
    await login('persona@example.com', 'clave-de-prueba')
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'persona@example.com', 'clave-de-prueba')
  })

  it('propaga el rechazo del SDK y no fabrica una sesión', async () => {
    const error = { code: 'auth/invalid-credential' }
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(error)
    await expect(login('persona@example.com', 'incorrecta')).rejects.toBe(error)
  })

  it('cierra la sesión mediante signOut', async () => {
    await logout()
    expect(signOut).toHaveBeenCalledWith(auth)
  })

  it('expone solo uid y email desde el observador y retorna su limpieza', () => {
    const change = vi.fn()
    const fail = vi.fn()
    const unsubscribe = vi.fn()
    vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe)
    expect(observeSession(change, fail)).toBe(unsubscribe)
    const callback = vi.mocked(onAuthStateChanged).mock.calls[0][1]
    if (typeof callback !== 'function') throw new Error('Expected SDK observer callback')
    callback({ uid: 'user', email: 'persona@example.com', displayName: 'Ignored' } as User)
    expect(change).toHaveBeenLastCalledWith({ uid: 'user', email: 'persona@example.com' })
    callback(null)
    expect(change).toHaveBeenLastCalledWith(null)
    expect(onAuthStateChanged).toHaveBeenCalledWith(auth, expect.any(Function), fail)
  })
})
