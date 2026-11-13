import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export function getFirebaseApp() {
  const options = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  }
  if (Object.values(options).some(value => !value)) {
    throw Object.assign(new Error('Firebase web configuration is missing.'), { code: 'auth/configuration-missing' })
  }
  return getApps().some(app => app.name === '[DEFAULT]') ? getApp() : initializeApp(options)
}

export function getFirebaseAuth() {
  // Firebase manages local session persistence and restoration; never store passwords.
  return getAuth(getFirebaseApp())
}
