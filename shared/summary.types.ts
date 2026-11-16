import type { Task } from '../src/features/tasks/task.types'

/** JSON representation: timestamps use UTC ISO 8601 with millisecond precision. */
export type SummaryTask = Omit<Task, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }

export type TaskSummary = {
  user: { uid: string }
  totals: { total: number; pending: number; completed: number }
  progress: number
  tasks: SummaryTask[]
}

export type SummaryErrorCode = 'METHOD_NOT_ALLOWED' | 'UNAUTHENTICATED' | 'INVALID_TOKEN' | 'SUMMARY_TOO_LARGE' | 'INTERNAL_ERROR'
export type SummaryError = { error: { code: SummaryErrorCode; message: string } }
