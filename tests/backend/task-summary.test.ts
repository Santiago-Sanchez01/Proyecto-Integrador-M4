import { beforeEach, expect, it, vi } from 'vitest'
import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { getAdminFirestore } from '../../server/firebase-admin'
import { MAX_SUMMARY_TASKS, MAX_SUMMARY_BYTES, readTaskSummary, SummaryTooLargeError } from '../../server/task-summary'

vi.mock('../../server/firebase-admin', () => ({ getAdminFirestore: vi.fn() }))
const get = vi.fn()
const orderBy = vi.fn()
const select = vi.fn()
const limit = vi.fn()
const doc = vi.fn()
const collection = vi.fn()
function row(id: string, status = 'pending', extra: Record<string, unknown> = {}) {
  return { id, data: () => ({ title: `Task ${id}`, description: `Description ${id}`, status, createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(2000), ...extra }) }
}
beforeEach(() => {
  vi.resetAllMocks()
  const query = { orderBy, select, limit, get }
  orderBy.mockReturnValue(query); select.mockReturnValue(query); limit.mockReturnValue(query)
  collection.mockImplementation(name => name === 'users' ? { doc } : query)
  doc.mockReturnValue({ collection })
  vi.mocked(getAdminFirestore).mockReturnValue({ collection } as unknown as ReturnType<typeof getAdminFirestore>)
  get.mockResolvedValue({ size: 0, docs: [] })
})

it('devuelve un resumen vacío con progreso cero', async () => {
  expect(await readTaskSummary('alice')).toEqual({ user: { uid: 'alice' }, totals: { total: 0, pending: 0, completed: 0 }, progress: 0, tasks: [] })
})

it.each(['pending', 'completed'])('calcula tareas %s y convierte timestamps a ISO', async status => {
  get.mockResolvedValue({ size: 1, docs: [row('one', status)] })
  const summary = await readTaskSummary('alice')
  expect(summary.progress).toBe(status === 'completed' ? 100 : 0)
  expect(summary.totals).toEqual({ total: 1, pending: status === 'pending' ? 1 : 0, completed: status === 'completed' ? 1 : 0 })
  expect(summary.tasks[0]).toEqual({ id: 'one', title: 'Task one', description: 'Description one', status, createdAt: '1970-01-01T00:00:01.000Z', updatedAt: '1970-01-01T00:00:02.000Z' })
})

it('calcula progreso mixto y conserva el orden devuelto por la consulta', async () => {
  get.mockResolvedValue({ size: 3, docs: [row('third'), row('first', 'completed'), row('second')] })
  const summary = await readTaskSummary('alice')
  expect(summary.totals).toEqual({ total: 3, pending: 2, completed: 1 })
  expect(summary.progress).toBe(33)
  expect(summary.tasks.map(task => task.id)).toEqual(['third', 'first', 'second'])
  expect(orderBy).toHaveBeenNthCalledWith(1, 'createdAt', 'desc')
  expect(orderBy).toHaveBeenNthCalledWith(2, expect.any(FieldPath), 'desc')
  expect(limit).toHaveBeenCalledWith(MAX_SUMMARY_TASKS + 1)
})

it('consulta exclusivamente la subcolección de cada UID y selecciona campos permitidos', async () => {
  await readTaskSummary('alice'); await readTaskSummary('bob')
  expect(doc.mock.calls).toEqual([['alice'], ['bob']])
  expect(collection.mock.calls).toEqual([['users'], ['tasks'], ['users'], ['tasks']])
  expect(select).toHaveBeenCalledWith('title', 'description', 'status', 'createdAt', 'updatedAt')
})

it.each(['', ' ', 'alice/tasks/other', 'x'.repeat(129)])('rechaza un UID no válido: %s', async uid => {
  await expect(readTaskSummary(uid)).rejects.toThrow()
  expect(getAdminFirestore).not.toHaveBeenCalled()
})

it('propaga errores de Firestore al handler', async () => {
  get.mockRejectedValue(new Error('private-internal-path'))
  await expect(readTaskSummary('alice')).rejects.toThrow('private-internal-path')
})

it('rechaza exceso de tareas sin devolver resúmenes parciales', async () => {
  get.mockResolvedValue({ size: MAX_SUMMARY_TASKS + 1, docs: [] })
  await expect(readTaskSummary('alice')).rejects.toBeInstanceOf(SummaryTooLargeError)
})

it('rechaza contenido que supere el límite en bytes UTF-8', async () => {
  get.mockResolvedValue({ size: 1, docs: [row('one', 'pending', { description: 'á'.repeat(MAX_SUMMARY_BYTES / 2) })] })
  await expect(readTaskSummary('alice')).rejects.toBeInstanceOf(SummaryTooLargeError)
})

it.each([{ title: ' ' }, { description: '' }, { status: 'other' }, { createdAt: 'not-timestamp' }, { updatedAt: Timestamp.fromMillis(0) }])('rechaza datos almacenados inválidos %j', async extra => {
  get.mockResolvedValue({ size: 1, docs: [row('one', 'pending', extra)] })
  await expect(readTaskSummary('alice')).rejects.toThrow('Invalid stored task')
})
