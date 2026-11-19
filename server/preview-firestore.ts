import { Firestore } from 'firebase-admin/firestore'
import { createVercelFirebaseCredentials } from './firebase-admin-oidc.js'

export function createIsolatedPreviewFirestore(projectId: string, databaseId: string, env: NodeJS.ProcessEnv) {
  const { auth } = createVercelFirebaseCredentials(projectId, {
    ...env, GCP_SERVICE_ACCOUNT_EMAIL: `workspace-guard-preview@${projectId}.iam.gserviceaccount.com`,
  })
  return new Firestore({ projectId, databaseId, auth, preferRest: true })
}
