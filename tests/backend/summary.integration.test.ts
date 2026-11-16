import type { IncomingMessage, ServerResponse } from 'node:http'
import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, expect, it, vi } from 'vitest'
import handler from '../../api/summary'
import { getAdminAuth, getAdminFirestore } from '../../server/firebase-admin'
import type { TaskSummary } from '../../shared/summary.types'

// Only SDK access is simulated: handler and readTaskSummary execute their real code.
vi.mock('../../server/firebase-admin', () => ({ getAdminAuth: vi.fn(), getAdminFirestore: vi.fn() }))

const verify = vi.fn()
const queriedPaths: string[] = []
const createdAt = Timestamp.fromMillis(1000)
const updatedAt = Timestamp.fromMillis(2000)
const documents = {
  'users/alice/tasks': [
    { id: 'alice-private-pending', title: 'Alice pendiente', description: 'Detalle privado de Alice', status: 'pending', createdAt, updatedAt },
    { id: 'alice-private-completed', title: 'Alice completada', description: 'Otro detalle de Alice', status: 'completed', createdAt, updatedAt },
  ],
  'users/bob/tasks': [
    { id: 'bob-private-completed', title: 'Bob completada', description: 'Detalle privado de Bob', status: 'completed', createdAt, updatedAt },
  ],
}

function queryAt(path: string) {
  const orderBy = vi.fn(), select = vi.fn(), limit = vi.fn()
  const query = { orderBy, select, limit, get: vi.fn(async () => {
    queriedPaths.push(path)
    if (!(path in documents)) throw new Error('Unexpected simulated Firestore path')
    const rows = documents[path as keyof typeof documents]
    return { size: rows.length, docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) }
  }) }
  orderBy.mockReturnValue(query); select.mockReturnValue(query); limit.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  queriedPaths.length = 0
  verify.mockImplementation(async token => {
    if (token === 'fake-token-alice') return { uid: 'alice' }
    if (token === 'fake-token-bob') return { uid: 'bob' }
    throw Object.assign(new Error('Simulated invalid token'), { code: 'auth/invalid-id-token' })
  })
  vi.mocked(getAdminAuth).mockReturnValue({ verifyIdToken: verify } as unknown as ReturnType<typeof getAdminAuth>)
  vi.mocked(getAdminFirestore).mockReturnValue({
    collection: (root: string) => ({ doc: (uid: string) => ({ collection: (name: string) => queryAt(`${root}/${uid}/${name}`) }) }),
  } as unknown as ReturnType<typeof getAdminFirestore>)
})

function forgedRequest(victim: string, authorization?: string, sources = ['body', 'query', 'header']) {
  return {
    method: 'POST',
    url: sources.includes('query') ? `/api/summary?uid=${victim}&path=users/${victim}/tasks` : '/api/summary',
    headers: { ...(authorization ? { authorization } : {}), ...(sources.includes('header') ? { 'x-user-id': victim } : {}) },
    ...(sources.includes('body') ? { body: { uid: victim, email: `${victim}@example.invalid`, path: `users/${victim}/tasks` } } : {}),
    ...(sources.includes('query') ? { query: { uid: victim, path: `users/${victim}/tasks` } } : {}),
  } as unknown as IncomingMessage
}

async function call(req: IncomingMessage) {
  const end = vi.fn()
  const res = { statusCode: 200, setHeader: vi.fn(), end } as unknown as ServerResponse
  await handler(req, res)
  return { status: res.statusCode, body: JSON.parse(end.mock.calls[0][0] as string) }
}

it('consulta y devuelve únicamente las tareas del token verificado ante identidad falsificada, en ambas direcciones', async () => {
  const expected: Record<string, TaskSummary> = {
    alice: {
      user: { uid: 'alice' }, totals: { total: 2, pending: 1, completed: 1 }, progress: 50,
      tasks: [
        { id: 'alice-private-pending', title: 'Alice pendiente', description: 'Detalle privado de Alice', status: 'pending', createdAt: '1970-01-01T00:00:01.000Z', updatedAt: '1970-01-01T00:00:02.000Z' },
        { id: 'alice-private-completed', title: 'Alice completada', description: 'Otro detalle de Alice', status: 'completed', createdAt: '1970-01-01T00:00:01.000Z', updatedAt: '1970-01-01T00:00:02.000Z' },
      ],
    },
    bob: {
      user: { uid: 'bob' }, totals: { total: 1, pending: 0, completed: 1 }, progress: 100,
      tasks: [{ id: 'bob-private-completed', title: 'Bob completada', description: 'Detalle privado de Bob', status: 'completed', createdAt: '1970-01-01T00:00:01.000Z', updatedAt: '1970-01-01T00:00:02.000Z' }],
    },
  }
  for (const [owner, victim] of [['alice', 'bob'], ['bob', 'alice']]) {
    const result = await call(forgedRequest(victim, `Bearer fake-token-${owner}`))
    expect(result.status).toBe(200)
    expect(verify).toHaveBeenLastCalledWith(`fake-token-${owner}`, true)
    expect(queriedPaths.at(-1)).toBe(`users/${owner}/tasks`)
    expect(result.body).toEqual(expected[owner])
    expect(JSON.stringify(result.body)).not.toContain(`${victim}-private`)
    expect(JSON.stringify(result.body)).not.toContain('fake-token-')
  }
  expect(queriedPaths).toEqual(['users/alice/tasks', 'users/bob/tasks'])
  expect(getAdminFirestore).toHaveBeenCalledTimes(2)
})

it.each([{ sources: ['body'] }, { sources: ['query'] }, { sources: ['header'] }, { sources: ['body', 'query', 'header'] }])('rechaza identidad falsificada sin Authorization desde $sources', async ({ sources }) => {
  const result = await call(forgedRequest('bob', undefined, sources))
  expect(result.status).toBe(401)
  expect(result.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Iniciá sesión para consultar el resumen.' } })
  expect(getAdminAuth).not.toHaveBeenCalled()
  expect(verify).not.toHaveBeenCalled()
  expect(getAdminFirestore).not.toHaveBeenCalled()
  expect(queriedPaths).toEqual([])
})
