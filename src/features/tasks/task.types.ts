import type { Timestamp } from 'firebase/firestore'

export type TaskStatus = 'pending' | 'completed'

/** Stored at users/{uid}/tasks/{taskId}. The document ID is not a field. */
export interface TaskDocument {
  title: string
  description: string
  status: TaskStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Read model for React. Keep Timestamp precision; format with toDate() in views. */
export interface Task extends TaskDocument {
  id: string
}

export type TaskContent = Pick<TaskDocument, 'title' | 'description'>
