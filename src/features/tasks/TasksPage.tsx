import { useState } from 'react'
import { useTasks } from './useTasks'
import TasksView from './TasksView'

function TasksContent({ onRetry }: { onRetry: () => void }) {
  const { tasks, loading, error } = useTasks()
  return <TasksView tasks={tasks} loading={loading} error={error} onRetry={onRetry} />
}

export default function TasksPage() {
  const [attempt, setAttempt] = useState(0)
  return <TasksContent key={attempt} onRetry={() => setAttempt(current => current + 1)} />
}
