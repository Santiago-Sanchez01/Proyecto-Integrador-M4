import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

vi.mock('firebase/app', () => ({ getApp: vi.fn(), getApps: vi.fn(), initializeApp: vi.fn() }))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-public-key')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app-id')
  vi.mocked(getApps).mockReturnValue([])
})

describe('Configuración Firebase del navegador', () => {
  it('inicializa el SDK solo con configuración pública', () => {
    getFirebaseAuth()
    expect(initializeApp).toHaveBeenCalledWith({ apiKey: 'test-public-key', authDomain: 'test.firebaseapp.com', projectId: 'test-project', appId: 'test-app-id' })
    expect(getAuth).toHaveBeenCalledTimes(1)
  })

  it('reutiliza la app por defecto en lugar de inicializarla dos veces', () => {
    const app = { name: '[DEFAULT]' } as FirebaseApp
    vi.mocked(getApps).mockReturnValue([app])
    vi.mocked(getApp).mockReturnValue(app)
    getFirebaseAuth()
    expect(initializeApp).not.toHaveBeenCalled()
    expect(getAuth).toHaveBeenCalledWith(app)
  })

  it.each(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'])('rechaza configuración incompleta: %s', key => {
    vi.stubEnv(key, '')
    expect(getFirebaseAuth).toThrow('Firebase web configuration is missing.')
    expect(initializeApp).not.toHaveBeenCalled()
    expect(getAuth).not.toHaveBeenCalled()
  })
})
