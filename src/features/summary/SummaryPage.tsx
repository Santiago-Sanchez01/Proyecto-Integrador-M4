import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useTasks } from '../tasks/useTasks'
import SummaryView from './SummaryView'

function SummaryContent({ email, onRetry }: { email: string | null; onRetry: () => void }) {
  const { tasks, loading, error } = useTasks()
  return <SummaryView tasks={tasks} loading={loading} error={error} email={email} onRetry={onRetry} />
}

export default function SummaryPage() {
  const auth = useAuth()
  const [attempt, setAttempt] = useState(0)
  const user = auth.status === 'ready' ? auth.user : null
  return <SummaryContent key={`${user?.uid ?? 'anonymous'}-${attempt}`} email={user?.email ?? null} onRetry={() => setAttempt(current => current + 1)} />
}
