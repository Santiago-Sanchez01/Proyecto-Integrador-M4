import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'

const projectId = 'demo-workspace-m4'
const ownerUid = 'alice'
const taskPath = `users/${ownerUid}/tasks/existing`
let environment: RulesTestEnvironment | undefined

function testEnvironment() {
  if (!environment) throw new Error('Firestore test environment has not started.')
  return environment
}

function validCreation(): Record<string, unknown> {
  return {
    title: 'Preparar presentación',
    description: 'Revisar el contenido del proyecto.',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

function ownerDatabase() {
  return testEnvironment().authenticatedContext(ownerUid).firestore()
}

beforeAll(async () => {
  // Fail closed: never infer a real project or fall back to a production endpoint.
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('Security tests require the local emulator at 127.0.0.1:8080. Run npm run test:rules.')
  }
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

beforeEach(async () => {
  await testEnvironment().clearFirestore()
  await testEnvironment().withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), taskPath), {
      title: 'Tarea existente',
      description: 'Descripción obligatoria.',
      status: 'pending',
      createdAt: Timestamp.fromMillis(1000),
      updatedAt: Timestamp.fromMillis(1000),
    })
  })
})

afterAll(async () => { await environment?.cleanup() })

describe('Acceso aislado por usuario', () => {
  it('permite al propietario crear y leer su tarea sin un documento de perfil', async () => {
    const ref = doc(ownerDatabase(), `users/${ownerUid}/tasks/new`)
    await assertSucceeds(setDoc(ref, validCreation()))
    const snapshot = await assertSucceeds(getDoc(ref))
    expect(snapshot.data()?.title).toBe('Preparar presentación')
    expect(snapshot.data()?.createdAt).toBeInstanceOf(Timestamp)
    expect(snapshot.data()?.updatedAt.isEqual(snapshot.data()?.createdAt)).toBe(true)
  })

  it('permite listar solo la subcolección propia', async () => {
    const snapshot = await assertSucceeds(getDocs(collection(ownerDatabase(), `users/${ownerUid}/tasks`)))
    expect(snapshot.size).toBe(1)
  })

  it('permite actualizar conservando createdAt y usando updatedAt del servidor', async () => {
    const ref = doc(ownerDatabase(), taskPath)
    await assertSucceeds(updateDoc(ref, { title: 'Título actualizado', description: 'Nueva descripción.', status: 'completed', updatedAt: serverTimestamp() }))
    const snapshot = await getDoc(ref)
    expect(snapshot.data()?.createdAt.toMillis()).toBe(1000)
    expect(snapshot.data()?.status).toBe('completed')
    expect(snapshot.data()?.updatedAt.toMillis()).toBeGreaterThanOrEqual(snapshot.data()?.createdAt.toMillis())
  })

  it('permite eliminar la tarea propia', async () => {
    const ref = doc(ownerDatabase(), taskPath)
    await assertSucceeds(deleteDoc(ref))
    expect((await getDoc(ref)).exists()).toBe(false)
  })

  it('acepta el estado completed y texto válido rodeado de espacios', async () => {
    await assertSucceeds(setDoc(doc(ownerDatabase(), `users/${ownerUid}/tasks/completed`), {
      ...validCreation(), title: '  Título  ', description: '  Descripción  ', status: 'completed',
    }))
  })

  it.each(['other-user', 'anonymous'])('rechaza todas las operaciones de %s sobre tareas ajenas', async actor => {
    const context = actor === 'anonymous' ? testEnvironment().unauthenticatedContext() : testEnvironment().authenticatedContext('bob')
    const db = context.firestore()
    const ref = doc(db, taskPath)
    await assertFails(getDoc(ref))
    await assertFails(getDocs(collection(db, `users/${ownerUid}/tasks`)))
    await assertFails(setDoc(doc(db, `users/${ownerUid}/tasks/new`), validCreation()))
    await assertFails(updateDoc(ref, { title: 'No autorizado', updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(ref))
  })

  it('rechaza consultar todas las tareas mediante collectionGroup', async () => {
    await assertFails(getDocs(collectionGroup(ownerDatabase(), 'tasks')))
  })

  it('permite solo el contrato de foco propio y no permite eliminar el documento', async () => {
    const ref = doc(ownerDatabase(), `users/${ownerUid}`)
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(setDoc(ref, { focusTaskId: 'existing' }))
    await assertFails(setDoc(ref, { focusTaskId: null, name: 'Extra' }))
    await assertFails(deleteDoc(ref))
  })

  it.each(['other/data', 'users/alice/settings/data', 'users/alice/tasks/existing/comments/data'])('deniega por defecto la ruta %s', async path => {
    const ref = doc(ownerDatabase(), path)
    await assertFails(getDoc(ref))
    await assertFails(setDoc(ref, { arbitrary: true }))
  })
})

const invalidFields: Array<[string, Record<string, unknown>]> = [
  ['título vacío', { title: '' }],
  ['título con espacios', { title: '    ' }],
  ['título con saltos de línea', { title: '\t\r\n ' }],
  ['título numérico', { title: 42 }],
  ['título nulo', { title: null }],
  ['descripción vacía', { description: '' }],
  ['descripción con espacios', { description: '   ' }],
  ['descripción con saltos de línea', { description: '\n\t ' }],
  ['descripción como objeto', { description: { text: 'incorrecto' } }],
  ['descripción nula', { description: null }],
  ['estado desconocido', { status: 'in-progress' }],
  ['estado numérico', { status: 1 }],
  ['campo extra', { priority: 'high' }],
  ['id dentro del documento', { id: 'existing' }],
  ['focusTaskId dentro de tarea', { focusTaskId: 'existing' }],
]

describe('Validación de documentos', () => {
  it.each(invalidFields)('rechaza create con %s', async (_label, patch) => {
    await assertFails(setDoc(doc(ownerDatabase(), `users/${ownerUid}/tasks/invalid`), { ...validCreation(), ...patch }))
  })

  it.each(invalidFields)('rechaza update con %s', async (_label, patch) => {
    await assertFails(updateDoc(doc(ownerDatabase(), taskPath), { ...patch, updatedAt: serverTimestamp() }))
  })

  it.each(['title', 'description', 'status', 'createdAt', 'updatedAt'])('rechaza creación sin %s', async field => {
    const data = validCreation()
    delete data[field]
    await assertFails(setDoc(doc(ownerDatabase(), `users/${ownerUid}/tasks/missing`), data))
  })

  it.each(['title', 'description', 'status', 'createdAt', 'updatedAt'])('rechaza eliminar el campo %s en update', async field => {
    await assertFails(updateDoc(doc(ownerDatabase(), taskPath), { updatedAt: serverTimestamp(), [field]: deleteField() }))
  })

  it.each(['createdAt', 'updatedAt'])('rechaza creación con %s de tipo string o manipulada', async field => {
    const ref = doc(ownerDatabase(), `users/${ownerUid}/tasks/date`)
    await assertFails(setDoc(ref, { ...validCreation(), [field]: '2026-01-01' }))
    await assertFails(setDoc(ref, { ...validCreation(), [field]: Timestamp.fromMillis(1000) }))
    await assertFails(setDoc(ref, { ...validCreation(), [field]: null }))
  })

  it('rechaza cambiar createdAt incluso a un timestamp del servidor', async () => {
    await assertFails(updateDoc(doc(ownerDatabase(), taskPath), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  })

  it('rechaza actualizar antes de createdAt en un documento importado con fecha futura', async () => {
    const future = Timestamp.fromDate(new Date('9999-01-01T00:00:00Z'))
    // Simulate an import that bypassed client rules, only inside the emulator.
    await testEnvironment().withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), taskPath), {
        title: 'Tarea importada', description: 'Fecha de origen incorrecta.',
        status: 'pending', createdAt: future, updatedAt: future,
      })
    })
    const ref = doc(ownerDatabase(), taskPath)
    await assertFails(updateDoc(ref, { title: 'Intento de actualización', updatedAt: serverTimestamp() }))
    const snapshot = await getDoc(ref)
    expect(snapshot.data()?.title).toBe('Tarea importada')
    expect(snapshot.data()?.createdAt.isEqual(future)).toBe(true)
  })

  it('rechaza updatedAt inválido, antiguo o sin actualizar', async () => {
    const ref = doc(ownerDatabase(), taskPath)
    await assertFails(updateDoc(ref, { title: 'Cambio sin fecha' }))
    await assertFails(updateDoc(ref, { updatedAt: 'ahora' }))
    await assertFails(updateDoc(ref, { updatedAt: Timestamp.fromMillis(1000) }))
  })
})
