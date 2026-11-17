import { expect, it } from 'vitest'
import type { TaskSummary } from '../../shared/summary.types'
import { MAX_SUMMARY_EMAIL_BYTES, renderSummaryEmail, SummaryEmailTooLargeError } from '../../server/summary-email'

function summary(): TaskSummary {
  return { user: { uid: 'private-user' }, totals: { total: 2, pending: 1, completed: 1 }, progress: 50, tasks: [
    { id: 'a', title: 'Primera tarea', description: 'Detalle pendiente', status: 'pending', createdAt: '', updatedAt: '' },
    { id: 'b', title: 'Segunda tarea', description: 'Detalle completado', status: 'completed', createdAt: '', updatedAt: '' },
  ] }
}
const bytes = (email: ReturnType<typeof renderSummaryEmail>) => Buffer.byteLength(email.text, 'utf8') + Buffer.byteLength(email.html, 'utf8')

it('mantiene todos los datos, orden y totales sin alterar el resumen', () => {
  const input = summary(), before = structuredClone(input)
  const email = renderSummaryEmail(input)
  expect(email.subject).toBe('Workspace — Resumen de tus tareas')
  for (const body of [email.text, email.html]) {
    for (const text of ['Total: 2', 'Pendientes: 1', 'Completadas: 1', 'Progreso: 50%', 'Primera tarea', 'Segunda tarea', 'Pendiente', 'Completada', 'Detalle pendiente', 'Detalle completado']) expect(body).toContain(text)
    expect(body.indexOf('Primera tarea')).toBeLessThan(body.indexOf('Segunda tarea'))
    expect(body).not.toContain('private-user')
  }
  expect(input).toEqual(before)
  expect(renderSummaryEmail(input)).toEqual(email)
})

it('escapa HTML, atributos, comillas y entidades sin interpretar contenido malicioso', () => {
  const input = summary()
  input.tasks[0].title = '<script>alert("x")</script> & \'test\''
  input.tasks[0].description = '<img src=x onerror="alert(1)">\n&lt;svg/onload=alert(2)&gt;'
  const email = renderSummaryEmail(input)
  expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;')
  expect(email.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;<br>&amp;lt;svg/onload=alert(2)&amp;gt;')
  expect(email.html).not.toMatch(/<script|<img|<svg|<iframe/i)
  expect(email.text).toContain(input.tasks[0].title)
  expect(email.subject).not.toContain('alert')
})

it('no interpreta Markdown, enlaces ni contenido de tareas como headers', () => {
  const input = summary()
  input.tasks[0].title = 'Hola\r\nBcc: victim@example.invalid'
  input.tasks[0].description = '**negrita** [enlace](javascript:alert(1))'
  const email = renderSummaryEmail(input)
  expect(email.html).toContain('**negrita** [enlace](javascript:alert(1))')
  expect(email.html).not.toMatch(/<a\b|<strong\b/)
  expect(email.subject).toBe('Workspace — Resumen de tus tareas')
  expect(Object.keys(email)).toEqual(['subject', 'text', 'html'])
})

it('conserva Unicode y saltos de línea y mide bytes UTF-8', () => {
  const input = summary()
  input.tasks[0].description = 'Organizá tu jornada 🌙 漢字\r\nSegunda línea'
  const email = renderSummaryEmail(input)
  expect(email.text).toContain(input.tasks[0].description)
  expect(email.html).toContain('Organizá tu jornada 🌙 漢字<br>Segunda línea')
  expect(bytes(email)).toBeGreaterThan(email.text.length + email.html.length)
})

it('contempla cero tareas y progreso cero', () => {
  const email = renderSummaryEmail({ user: { uid: 'alice' }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] })
  expect(email.text).toContain('Total: 0\nPendientes: 0\nCompletadas: 0\nProgreso: 0%')
  expect(email.html).toContain('Todavía no tenés tareas.')
  expect(email.html).not.toContain('<li>')
})

it('acepta exactamente 256 KiB combinados y rechaza el exceso sin devolver contenido parcial', () => {
  const input = summary()
  let remaining = MAX_SUMMARY_EMAIL_BYTES - bytes(renderSummaryEmail(input))
  if (remaining % 2 !== 0) { input.tasks[0].description += '"'; remaining -= 7 }
  input.tasks[0].description += 'a'.repeat(remaining / 2)
  expect(bytes(renderSummaryEmail(input))).toBe(MAX_SUMMARY_EMAIL_BYTES)
  input.tasks[0].description += 'a'
  expect(() => renderSummaryEmail(input)).toThrow(SummaryEmailTooLargeError)
})

it('aplica el límite después del escape HTML', () => {
  const input = summary()
  input.tasks[0].description = '&'.repeat(50000)
  expect(input.tasks[0].description.length).toBeLessThan(MAX_SUMMARY_EMAIL_BYTES)
  expect(() => renderSummaryEmail(input)).toThrow(SummaryEmailTooLargeError)
})

it('rechaza un exceso de bytes Unicode aunque el número de caracteres sea menor', () => {
  const input = summary()
  input.tasks[0].description = '🌙'.repeat(40000)
  expect(input.tasks[0].description.length).toBeLessThan(MAX_SUMMARY_EMAIL_BYTES)
  expect(() => renderSummaryEmail(input)).toThrow(SummaryEmailTooLargeError)
})

it('el error de tamaño no expone contenido privado', () => {
  const input = summary()
  input.tasks[0].description = 'PRIVATE_TASK_CONTENT'.repeat(20000)
  try { renderSummaryEmail(input); throw new Error('Expected size rejection') }
  catch (error) {
    expect(error).toMatchObject({ code: 'EMAIL_TOO_LARGE', status: 413 })
    expect(String(error)).not.toContain('PRIVATE_TASK_CONTENT')
  }
})
