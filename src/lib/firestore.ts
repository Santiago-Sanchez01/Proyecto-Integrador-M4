import { getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './firebase'

// Lazy client only: no reads, writes, listeners or extra Firebase applications.
export function getFirebaseFirestore() {
  return getFirestore(getFirebaseApp())
}
