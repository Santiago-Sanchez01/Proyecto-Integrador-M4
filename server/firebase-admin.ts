import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const APP_NAME = 'workspace-server'

export function getAdminApp() {
  if ('window' in globalThis || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Server Firebase configuration unavailable.')
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim()
  if (!projectId) throw new Error('Server Firebase configuration unavailable.')
  const existing = getApps().find(app => app.name === APP_NAME)
  if (existing) {
    if (existing.options.projectId !== projectId) throw new Error('Server Firebase project mismatch.')
    return existing
  }
  // ADC discovery and token refresh belong to the SDK, outside the client bundle.
  return initializeApp({ projectId, credential: applicationDefault() }, APP_NAME)
}

export function getAdminAuth() { return getAuth(getAdminApp()) }
export function getAdminFirestore() { return getFirestore(getAdminApp()) }
