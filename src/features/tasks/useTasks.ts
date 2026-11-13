import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { createTasksService } from './tasks.service'
import type { TasksService } from './tasks.service'
import type { Task, TaskContent, TaskStatus } from './task.types'
import { taskError, taskErrorMessage } from './tasks.errors'

type TasksState = {
  uid: string | null
  tasks: Task[]
  loading: boolean
  error: string | null
  operationError: string | null
  pendingCount: number
}

function emptyState(uid: string | null): TasksState {
  return { uid, tasks: [], loading: uid !== null, error: null, operationError: null, pendingCount: 0 }
}

export function useTasks() {
  const { user, status, error: authError } = useAuth()
  const uid = status === 'ready' ? user?.uid ?? null : null
  const sessionRef = useRef<{ uid: string; service: TasksService } | null>(null)
  const [state, setState] = useState<TasksState>(() => emptyState(uid))

  if (state.uid !== uid) setState(emptyState(uid))

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    sessionRef.current = null
    if (uid) {
      try {
        const service = createTasksService()
        if (service.uid !== uid) throw taskError('session-changed')
        sessionRef.current = { uid, service }
        unsubscribe = service.subscribeTasks(tasks => {
          if (active) setState(current => current.uid === uid ? { ...current, tasks, loading: false, error: null } : current)
        }, error => {
          if (active) setState(current => current.uid === uid ? { ...current, tasks: [], loading: false, error: taskErrorMessage(error) } : current)
        })
      } catch (error) {
        sessionRef.current = null
        queueMicrotask(() => {
          if (active) setState(current => current.uid === uid ? { ...current, loading: false, error: taskErrorMessage(error) } : current)
        })
      }
    }
    return () => { active = false; sessionRef.current = null; unsubscribe?.() }
  }, [uid])

  const run = useCallback(async <T,>(operation: (service: TasksService) => Promise<T>): Promise<T> => {
    const session = sessionRef.current
    if (!uid || session?.uid !== uid) throw taskError('session-changed')
    setState(current => current.uid === uid ? { ...current, operationError: null, pendingCount: current.pendingCount + 1 } : current)
    try {
      const result = await operation(session.service)
      if (sessionRef.current !== session) throw taskError('session-changed')
      return result
    } catch (error) {
      if (sessionRef.current === session) setState(current => current.uid === uid ? { ...current, operationError: taskErrorMessage(error) } : current)
      throw error
    } finally {
      if (sessionRef.current === session) setState(current => current.uid === uid ? { ...current, pendingCount: current.pendingCount - 1 } : current)
    }
  }, [uid])

  // Mask the previous account synchronously, before its effect cleanup runs.
  const visible = state.uid === uid ? state : emptyState(uid)
  return {
    tasks: visible.tasks,
    loading: status === 'loading' || visible.loading,
    error: status === 'error' ? authError : visible.error,
    operationError: visible.operationError,
    isMutating: visible.pendingCount > 0,
    createTask: useCallback((content: TaskContent) => run(service => service.createTask(content)), [run]),
    updateTask: useCallback((id: string, content: TaskContent) => run(service => service.updateTask(id, content)), [run]),
    setTaskStatus: useCallback((id: string, next: TaskStatus) => run(service => service.setTaskStatus(id, next)), [run]),
    deleteTask: useCallback((id: string) => run(service => service.deleteTask(id)), [run]),
  }
}
