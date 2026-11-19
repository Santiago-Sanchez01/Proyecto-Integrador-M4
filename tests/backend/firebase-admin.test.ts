import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import type { App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { Firestore, getFirestore } from 'firebase-admin/firestore'
import { getAdminApp, getAdminAuth, getAdminFirestore } from '../../server/firebase-admin'
import { createVercelFirebaseCredentials } from '../../server/firebase-admin-oidc'

vi.mock('firebase-admin/app', () => ({ applicationDefault: vi.fn(), getApps: vi.fn(), initializeApp: vi.fn() }))
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }))
vi.mock('firebase-admin/firestore', () => ({ Firestore: vi.fn(class Firestore {}), getFirestore: vi.fn() }))
vi.mock('../../server/firebase-admin-oidc', () => ({ createVercelFirebaseCredentials: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  for (const key of ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'FIREBASE_ADMIN_CREDENTIAL_MODE']) vi.stubEnv(key, undefined)
  vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', 'test-project')
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '')
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '')
  vi.mocked(getApps).mockReturnValue([])
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('usa ADC con proyecto explícito sin depender de VITE_* ni claves privadas', () => {
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'wrong-public-project')
  vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', '')
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', '')
  const credential = { getAccessToken: vi.fn() }
  vi.mocked(applicationDefault).mockReturnValue(credential)
  getAdminApp()
  expect(applicationDefault).toHaveBeenCalledExactlyOnceWith()
  expect(initializeApp).toHaveBeenCalledWith({ projectId: 'test-project', credential }, 'workspace-server')
  expect(credential.getAccessToken).not.toHaveBeenCalled()
})

it('reutiliza la aplicación servidor y evita inicializaciones duplicadas', () => {
  const existing = { name: 'workspace-server', options: { projectId: 'test-project' } } as App
  vi.mocked(getApps).mockReturnValue([existing])
  expect(getAdminApp()).toBe(existing)
  expect(getAdminApp()).toBe(existing)
  expect(initializeApp).not.toHaveBeenCalled()
  expect(applicationDefault).not.toHaveBeenCalled()
})

it('rechaza una aplicación inicializada para otro proyecto', () => {
  vi.mocked(getApps).mockReturnValue([{ name: 'workspace-server', options: { projectId: 'other-project' } } as App])
  expect(() => getAdminApp()).toThrow('project mismatch')
})

it.each(['', '   '])('falla de forma cerrada si no hay proyecto explícito: %j', project => {
  vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', project)
  expect(() => getAdminApp()).toThrow('configuration unavailable')
  expect(initializeApp).not.toHaveBeenCalled()
  expect(applicationDefault).not.toHaveBeenCalled()
})

it('no inicializa ni resuelve ADC al importar el módulo', async () => {
  vi.resetModules()
  await import('../../server/firebase-admin')
  expect(applicationDefault).not.toHaveBeenCalled()
  expect(initializeApp).not.toHaveBeenCalled()
})

it('no inicializa una aplicación si falla la construcción de ADC', () => {
  vi.mocked(applicationDefault).mockImplementation(() => { throw new Error('ADC unavailable') })
  expect(() => getAdminApp()).toThrow('ADC unavailable')
  expect(initializeApp).not.toHaveBeenCalled()
})

it.each(['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST'])('impide activar accidentalmente %s en el endpoint real', name => {
  vi.stubEnv(name, '127.0.0.1:9099')
  expect(() => getAdminApp()).toThrow('configuration unavailable')
})

it('rechaza inicialización en el navegador', () => {
  vi.stubGlobal('window', {})
  expect(() => getAdminApp()).toThrow('configuration unavailable')
})

it('usa el cliente Admin tradicional en Vercel Dev', () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_ENV', 'development')
  vi.stubEnv('FIREBASE_ADMIN_CREDENTIAL_MODE', 'adc')
  const app = { name: 'workspace-server', options: { projectId: 'test-project' } } as App
  vi.mocked(getApps).mockReturnValue([app])
  getAdminFirestore()
  expect(getFirestore).toHaveBeenCalledExactlyOnceWith(app)
  expect(createVercelFirebaseCredentials).not.toHaveBeenCalled()
})

it.each(['preview', 'production'])('comparte credenciales federadas entre Auth y Firestore en %s', env => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_ENV', env)
  vi.stubEnv('VERCEL_TARGET_ENV', env)
  vi.stubEnv('FIREBASE_ADMIN_CREDENTIAL_MODE', 'vercel-oidc')
  const credential = { getAccessToken: vi.fn() }
  const auth = {} as ReturnType<typeof createVercelFirebaseCredentials>['auth']
  const app = { name: 'workspace-server', options: { projectId: 'test-project' } } as App
  vi.mocked(createVercelFirebaseCredentials).mockReturnValue({ credential, auth })
  vi.mocked(initializeApp).mockImplementation(() => {
    vi.mocked(getApps).mockReturnValue([app])
    return app
  })
  getAdminAuth()
  const firestore = getAdminFirestore()
  expect(getAdminFirestore()).toBe(firestore)
  expect(getAuth).toHaveBeenCalledExactlyOnceWith(app)
  expect(initializeApp).toHaveBeenCalledExactlyOnceWith({ projectId: 'test-project', credential }, 'workspace-server')
  expect(Firestore).toHaveBeenCalledExactlyOnceWith({ projectId: 'test-project', auth, preferRest: true })
  expect(credential.getAccessToken).not.toHaveBeenCalled()
  expect(applicationDefault).not.toHaveBeenCalled()
  expect(getFirestore).not.toHaveBeenCalled()
})

it.each([
  ['1', 'preview', undefined, undefined],
  ['1', 'production', 'adc', undefined],
  ['1', 'preview', 'vercel-oidc', 'production'],
  [undefined, undefined, 'vercel-oidc', undefined],
  ['1', 'preview', 'vercel-oidc', 'staging'],
] as const)('rechaza runtime o modo incompatibles: %s, %s, %s, %s', (vercel, env, mode, target) => {
  vi.stubEnv('VERCEL', vercel)
  vi.stubEnv('VERCEL_ENV', env)
  vi.stubEnv('FIREBASE_ADMIN_CREDENTIAL_MODE', mode)
  vi.stubEnv('VERCEL_TARGET_ENV', target)
  expect(() => getAdminApp()).toThrow('configuration unavailable')
  expect(applicationDefault).not.toHaveBeenCalled()
  expect(initializeApp).not.toHaveBeenCalled()
})
