import { beforeEach, expect, it, vi } from 'vitest'
import { getFirestore } from 'firebase/firestore'
import { getFirebaseApp } from './firebase'
import { getFirebaseFirestore } from './firestore'

vi.mock('./firebase', () => ({ getFirebaseApp: vi.fn() }))
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn() }))

beforeEach(() => vi.resetAllMocks())

it('pide Firestore usando la instancia compartida de Firebase', () => {
  const app = { name: '[DEFAULT]' } as ReturnType<typeof getFirebaseApp>
  vi.mocked(getFirebaseApp).mockReturnValue(app)
  getFirebaseFirestore()
  expect(getFirestore).toHaveBeenCalledWith(app)
  expect(getFirebaseApp).toHaveBeenCalledTimes(1)
})
