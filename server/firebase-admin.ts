import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import type { App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { Firestore, getFirestore } from 'firebase-admin/firestore'
import { createVercelFirebaseCredentials } from './firebase-admin-oidc'

const APP_NAME = 'workspace-server'
const federatedFirestore = new WeakMap<App, Firestore>()

function usesVercelOidc(env: NodeJS.ProcessEnv) {
  const mode = env.FIREBASE_ADMIN_CREDENTIAL_MODE
  const deployed = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production'
  if (deployed && env.VERCEL === '1' && mode === 'vercel-oidc'
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === env.VERCEL_ENV)) return true
  const local = (env.VERCEL === undefined || env.VERCEL_ENV === 'development')
    && (env.VERCEL_ENV === undefined || env.VERCEL_ENV === 'development')
    && (env.VERCEL_TARGET_ENV === undefined || env.VERCEL_TARGET_ENV === 'development')
  if (local && (mode === undefined || mode === 'adc')) return false
  throw new Error('Server Firebase configuration unavailable.')
}

export function getAdminApp() {
  if ('window' in globalThis || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Server Firebase configuration unavailable.')
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
  if (!projectId) throw new Error('Server Firebase configuration unavailable.')
  const federated = usesVercelOidc(process.env)
  const existing = getApps().find(app => app.name === APP_NAME)
  if (existing) {
    if (existing.options.projectId !== projectId) throw new Error('Server Firebase project mismatch.')
    if (federated !== federatedFirestore.has(existing)) throw new Error('Server Firebase configuration unavailable.')
    return existing
  }
  if (!federated) return initializeApp({ projectId, credential: applicationDefault() }, APP_NAME)

  const { credential, auth } = createVercelFirebaseCredentials(projectId, process.env)
  // Firebase Admin's getFirestore(app) only accepts ADC or a service-account key.
  const firestore = new Firestore({ projectId, auth, preferRest: true })
  const app = initializeApp({ projectId, credential }, APP_NAME)
  federatedFirestore.set(app, firestore)
  return app
}

export function getAdminAuth() { return getAuth(getAdminApp()) }
export function getAdminFirestore() {
  const app = getAdminApp()
  return federatedFirestore.get(app) ?? getFirestore(app)
}
