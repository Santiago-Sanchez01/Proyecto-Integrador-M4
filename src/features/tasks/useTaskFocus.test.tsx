import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../auth/useAuth'
import type { AuthState } from '../auth/AuthContext'
import { createTaskFocusService } from './focus.service'
import { useTaskFocus } from './useTaskFocus'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('./focus.service', () => ({ createTaskFocusService: vi.fn() }))
let auth: AuthState
let next: (id: string | null) => void
let fail: (error: unknown) => void
const stop = vi.fn()
const select = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  auth = { user: { uid: 'alice', email: null }, status: 'ready', error: null }
  vi.mocked(useAuth).mockImplementation(() => auth)
  vi.mocked(createTaskFocusService).mockImplementation(() => ({ uid: auth.user!.uid, getFocus: vi.fn(), selectFocus: select, subscribeFocus: (n, f) => { next = n; fail = f; return stop } }))
})

it('recibe foco confirmado y limpia la suscripción', () => {
  const view = renderHook(() => useTaskFocus())
  expect(view.result.current.loading).toBe(true)
  act(() => next('task'))
  expect(view.result.current.focusTaskId).toBe('task')
  view.unmount()
  expect(stop).toHaveBeenCalledTimes(1)
  act(() => next('late'))
  expect(view.result.current.focusTaskId).toBe('task')
})

it('oculta foco de otra cuenta y descarta callbacks antiguos', () => {
  const view = renderHook(() => useTaskFocus())
  act(() => next('alice-task'))
  const old = next
  auth = { ...auth, user: { uid: 'bob', email: null } }
  view.rerender()
  expect(view.result.current.focusTaskId).toBeNull()
  act(() => old('late'))
  expect(view.result.current.focusTaskId).toBeNull()
  expect(stop).toHaveBeenCalledTimes(1)
})

it('no simula selección ni éxito antes de confirmarse y propaga fallos', async () => {
  const view = renderHook(() => useTaskFocus())
  act(() => next(null))
  let resolve!: () => void
  select.mockReturnValue(new Promise<void>(done => { resolve = done }))
  let request!: Promise<void>
  act(() => { request = view.result.current.selectFocus('task') })
  expect(view.result.current.isMutating).toBe(true)
  expect(view.result.current.focusTaskId).toBeNull()
  await act(async () => { resolve(); await request })
  expect(view.result.current.focusTaskId).toBeNull()
  act(() => next('task'))
  select.mockRejectedValue({ code: 'permission-denied' })
  await act(async () => { await expect(view.result.current.clearFocus()).rejects.toBeDefined() })
  expect(select).toHaveBeenLastCalledWith(null)
  expect(view.result.current.operationError).toContain('permiso')
  expect(view.result.current.focusTaskId).toBe('task')
})

it('comunica el error del listener y no consulta sin sesión', () => {
  const view = renderHook(() => useTaskFocus())
  act(() => fail({ code: 'unavailable' }))
  expect(view.result.current.error).toContain('conexión')
  view.unmount()
  vi.mocked(createTaskFocusService).mockClear()
  auth = { ...auth, user: null }
  const anonymous = renderHook(() => useTaskFocus())
  expect(createTaskFocusService).not.toHaveBeenCalled()
  expect(anonymous.result.current.loading).toBe(false)
})
