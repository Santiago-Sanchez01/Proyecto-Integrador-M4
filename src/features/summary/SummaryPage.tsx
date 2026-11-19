import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useTasks } from '../tasks/useTasks'
import SummaryOidcCheck from './SummaryOidcCheck'
import SummaryView from './SummaryView'
import { useSummarySend } from './useSummarySend'

function SummaryContent({ uid, email, onRetry }: { uid: string | null; email: string | null; onRetry: () => void }) {
  const { tasks, loading, error } = useTasks()
  const send = useSummarySend()
  return <>
    <SummaryView tasks={tasks} loading={loading} error={error} email={email} onRetry={onRetry} send={send} />
    {__SUMMARY_OIDC_PREVIEW__ && uid && <SummaryOidcCheck uid={uid} />}
    {__SUMMARY_OIDC_PREVIEW__ && uid && <SummaryOidcCheck uid={uid} kind="aws" />}
  </>
}

export default function SummaryPage() {
  const auth = useAuth()
  const [attempt, setAttempt] = useState(0)
  const user = auth.status === 'ready' ? auth.user : null
  return <SummaryContent key={`${user?.uid ?? 'anonymous'}-${attempt}`} uid={user?.uid ?? null} email={user?.email ?? null} onRetry={() => setAttempt(current => current + 1)} />
}
