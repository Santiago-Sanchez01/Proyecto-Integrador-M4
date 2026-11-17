import { expect, it } from 'vitest'
import { createMemorySendGuard } from '../../server/summary-send-guard'

it('reserva antes de esperar, aísla usuarios y rechaza concurrencia por usuario', () => {
  const guard = createMemorySendGuard()
  expect(guard.begin('alice', 'one')).toBe('reserved')
  expect(() => guard.begin('alice', 'one')).toThrow(expect.objectContaining({ code: 'SEND_IN_PROGRESS' }))
  expect(() => guard.begin('alice', 'two')).toThrow(expect.objectContaining({ code: 'SEND_IN_PROGRESS' }))
  expect(guard.begin('bob', 'one')).toBe('reserved')
})

it('reproduce aceptación sin otro envío, aplica 60 segundos a una clave nueva y caduca a las 24 horas', () => {
  let now = 0
  const guard = createMemorySendGuard(() => now)
  guard.begin('alice', 'one'); guard.finish('alice', 'one', 'accepted')
  expect(guard.begin('alice', 'one')).toBe('accepted')
  expect(() => guard.begin('alice', 'two')).toThrow(expect.objectContaining({ code: 'SEND_LIMITED', retryAfterSeconds: 60 }))
  now = 60_000
  expect(guard.begin('alice', 'two')).toBe('reserved')
  guard.finish('alice', 'two', 'accepted')
  now = 86_400_001
  expect(guard.begin('alice', 'one')).toBe('reserved')
})

it('no reejecuta claves fallidas y mantiene bloqueado un resultado incierto incluso después de 24 horas', () => {
  let now = 0
  const guard = createMemorySendGuard(() => now)
  guard.begin('alice', 'one'); guard.finish('alice', 'one', 'failed')
  expect(() => guard.begin('alice', 'one')).toThrow(expect.objectContaining({ code: 'DUPLICATE_REQUEST' }))
  now = 60_000
  guard.begin('alice', 'two'); guard.finish('alice', 'two', 'unknown')
  now = 172_800_000
  expect(() => guard.begin('alice', 'two')).toThrow(expect.objectContaining({ code: 'SEND_STATUS_UNKNOWN' }))
  expect(() => guard.begin('alice', 'three')).toThrow(expect.objectContaining({ code: 'SEND_STATUS_UNKNOWN' }))
})

it('limita memoria sin expulsar operaciones pendientes o inciertas', () => {
  const guard = createMemorySendGuard(() => 0, 1)
  guard.begin('alice', 'one')
  expect(() => guard.begin('bob', 'one')).toThrow(expect.objectContaining({ code: 'PROVIDER_UNAVAILABLE' }))
})

it('las instancias son independientes: el bloqueo no es distribuido', () => {
  expect(createMemorySendGuard().begin('alice', 'one')).toBe('reserved')
  expect(createMemorySendGuard().begin('alice', 'one')).toBe('reserved')
})
