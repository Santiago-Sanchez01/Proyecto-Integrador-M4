import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import type { SummaryTask, TaskSummary } from '../shared/summary.types'
import { getAdminFirestore } from './firebase-admin.js'

export const MAX_SUMMARY_TASKS = 100
export const MAX_SUMMARY_BYTES = 1024 * 1024
export class SummaryTooLargeError extends Error {}

export async function readTaskSummary(uid: string): Promise<TaskSummary> {
  if (!uid || uid.length > 128 || !uid.trim() || uid.includes('/')) throw new Error('Invalid verified identity.')
  const snapshot = await getAdminFirestore().collection('users').doc(uid).collection('tasks')
    .orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc')
    .select('title', 'description', 'status', 'createdAt', 'updatedAt')
    .limit(MAX_SUMMARY_TASKS + 1).get()
  if (snapshot.size > MAX_SUMMARY_TASKS) throw new SummaryTooLargeError()
  const tasks: SummaryTask[] = []
  let bytes = 0
  for (const document of snapshot.docs) {
    const data = document.data()
    if (typeof data.title !== 'string' || !data.title.trim() || typeof data.description !== 'string' || !data.description.trim()
      || (data.status !== 'pending' && data.status !== 'completed') || !(data.createdAt instanceof Timestamp)
      || !(data.updatedAt instanceof Timestamp) || data.updatedAt.valueOf() < data.createdAt.valueOf()) throw new Error('Invalid stored task.')
    const task: SummaryTask = { id: document.id, title: data.title, description: data.description, status: data.status,
      createdAt: data.createdAt.toDate().toISOString(), updatedAt: data.updatedAt.toDate().toISOString() }
    bytes += Buffer.byteLength(JSON.stringify(task), 'utf8')
    if (bytes > MAX_SUMMARY_BYTES) throw new SummaryTooLargeError()
    tasks.push(task)
  }
  const pending = tasks.filter(task => task.status === 'pending').length
  const completed = tasks.length - pending
  return { user: { uid }, totals: { total: tasks.length, pending, completed }, progress: tasks.length === 0 ? 0 : Math.round(completed / tasks.length * 100), tasks }
}
