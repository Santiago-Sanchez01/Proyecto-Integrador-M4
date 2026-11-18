import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { getFirebaseAuth } from '../../lib/firebase'

export type SessionUser = { uid: string; email: string | null }

export function observeSession(onChange: (user: SessionUser | null) => void, onError: (error: unknown) => void) {
  return onAuthStateChanged(getFirebaseAuth(), user => {
    onChange(user ? { uid: user.uid, email: user.email } : null)
  }, onError)
}

export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function loginWithGoogle(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
}

export async function register(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth())
}
