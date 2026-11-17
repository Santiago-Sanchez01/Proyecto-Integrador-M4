import type { TaskSummary } from '../shared/summary.types'

export const MAX_SUMMARY_EMAIL_BYTES = 256 * 1024
export type RenderedSummaryEmail = { subject: string; text: string; html: string }
export class SummaryEmailTooLargeError extends Error {
  readonly code = 'EMAIL_TOO_LARGE' as const
  readonly status = 413
  constructor() { super('El contenido del resumen supera el tamaño permitido para el correo.') }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Pure rendering only: no recipient, external calls, dates, persistence or delivery. */
export function renderSummaryEmail(summary: TaskSummary): RenderedSummaryEmail {
  const totals = summary.totals
  const stats = `Total: ${totals.total}\nPendientes: ${totals.pending}\nCompletadas: ${totals.completed}\nProgreso: ${summary.progress}%`
  const taskText = summary.tasks.map(task => `${task.title}\nEstado: ${task.status === 'pending' ? 'Pendiente' : 'Completada'}\n${task.description}`).join('\n\n')
  const taskHtml = summary.tasks.map(task => `<li><h2>${escapeHtml(task.title)}</h2><p>Estado: ${task.status === 'pending' ? 'Pendiente' : 'Completada'}</p><p>${escapeHtml(task.description).replace(/\r\n|\r|\n/g, '<br>')}</p></li>`).join('')
  const text = `Workspace — Resumen de tus tareas\n\n${stats}\n\n${taskText || 'Todavía no tenés tareas.'}`
  const html = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Workspace — Resumen de tus tareas</title></head><body><h1>Resumen de tus tareas</h1><pre>${escapeHtml(stats)}</pre>${taskHtml ? `<ul>${taskHtml}</ul>` : '<p>Todavía no tenés tareas.</p>'}</body></html>`
  if (Buffer.byteLength(text, 'utf8') + Buffer.byteLength(html, 'utf8') > MAX_SUMMARY_EMAIL_BYTES) throw new SummaryEmailTooLargeError()
  return { subject: 'Workspace — Resumen de tus tareas', text, html }
}
