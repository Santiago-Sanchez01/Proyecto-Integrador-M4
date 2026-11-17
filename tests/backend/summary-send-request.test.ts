import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { expect, it } from 'vitest'
import { readSummarySendRequest } from '../../server/summary-send-request'

const id = '12345678-1234-4234-8234-123456789abc'
function request(body: unknown = undefined, headers: Record<string, unknown> = {}) {
  const raw = body === undefined ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  return Object.assign(Readable.from(raw.length ? [raw] : []), { method: 'POST', url: '/api/summary/send', complete: true,
    headers: { 'idempotency-key': id, ...(raw.length ? { 'content-type': 'application/json' } : {}), ...headers }, body }) as unknown as IncomingMessage
}
it.each([undefined, '', '{}', {}, Buffer.from('{}')])('acepta cuerpo vacío o JSON vacío desde bytes originales: %j', async body => {
  expect(await readSummarySendRequest(request(body))).toBe(id)
})
it('normaliza la clave UUID para impedir duplicados por mayúsculas', async () => {
  expect(await readSummarySendRequest(request(undefined, { 'idempotency-key': id.toUpperCase() }))).toBe(id)
})
it.each([{ uid: 'bob' }, { email: 'bob@example.invalid' }, { from: 'bob@example.invalid' }, { tasks: [] }, { html: '<b>custom</b>' }, { recipient: 'bob@example.invalid' }, { to: 'bob@example.invalid' }, [], null, '{', 'null', '""', ' '])('rechaza payload no permitido: %j', async body => {
  await expect(readSummarySendRequest(request(body))).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 })
})
it.each([undefined, '', 'not-a-uuid', ['one', 'two']])('requiere Idempotency-Key UUIDv4 único: %j', async key => {
  await expect(readSummarySendRequest(request(undefined, { 'idempotency-key': key }))).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 })
})
it.each(['uid=bob', 'email=bob%40example.invalid', 'anything=1'])('rechaza query string: %s', async query => {
  const req = request(); req.url += '?' + query
  await expect(readSummarySendRequest(req)).rejects.toMatchObject({ status: 400 })
})
it.each(['1025', '99999999999999999999'])('limita Content-Length antes de leer: %s', async length => {
  await expect(readSummarySendRequest(request(undefined, { 'content-length': length }))).rejects.toMatchObject({ status: 413 })
})
it.each(['-1', 'bad', ['100']])('rechaza longitud inválida: %j', async length => {
  await expect(readSummarySendRequest(request(undefined, { 'content-length': length }))).rejects.toMatchObject({ status: 400 })
})
it('limita bytes UTF-8 también en cuerpos parseados', async () => {
  await expect(readSummarySendRequest(request('ñ'.repeat(513)))).rejects.toMatchObject({ status: 413 })
})
it('lee cuerpo HTTP chunked y rechaza exceso sin confiar en Content-Length', async () => {
  const req = Object.assign(Readable.from([Buffer.alloc(600), Buffer.alloc(600)]), { url: '/api/summary/send', headers: { 'idempotency-key': id, 'transfer-encoding': 'chunked' } })
  await expect(readSummarySendRequest(req as unknown as IncomingMessage)).rejects.toMatchObject({ status: 413 })
})
it('valida un stream HTTP vacío/JSON vacío', async () => {
  const req = Object.assign(Readable.from([Buffer.from('{'), Buffer.from('}')]), { complete: true, url: '/api/summary/send', headers: { 'idempotency-key': id, 'content-length': '2', 'content-type': 'application/json' } })
  expect(await readSummarySendRequest(req as unknown as IncomingMessage)).toBe(id)
})

it('regresión H02: mide 2050 bytes chunked aunque exista body preparseado vacío', async () => {
  const req = request('{}' + ' '.repeat(2048), { 'transfer-encoding': 'chunked' })
  Object.assign(req, { body: {} })
  await expect(readSummarySendRequest(req)).rejects.toMatchObject({ status: 413 })
})

it('rechaza body preparseado sin fuente de bytes crudos, aun con Content-Length pequeño', async () => {
  const req = { url: '/api/summary/send', headers: { 'idempotency-key': id, 'content-length': '2' }, body: {} }
  await expect(readSummarySendRequest(req as unknown as IncomingMessage)).rejects.toMatchObject({ status: 400 })
})

it('acepta body preparseado solo si existe un stream original intacto verificable', async () => {
  const req = request('{}  ', { 'content-length': '4' })
  Object.assign(req, { body: {} })
  expect(await readSummarySendRequest(req)).toBe(id)
})

it('no usa el objeto parseado para ocultar campos presentes en los bytes originales', async () => {
  const req = request('{"uid":"bob"}')
  Object.assign(req, { body: {} })
  await expect(readSummarySendRequest(req)).rejects.toMatchObject({ status: 400 })
})

it('no accede al getter body de Vercel ni confía en propiedades rawBody arbitrarias', async () => {
  const req = request()
  Object.defineProperty(req, 'body', { get: () => { throw new Error('Body helper must not execute') } })
  expect(await readSummarySendRequest(req)).toBe(id)
  const consumed = request('{}')
  for await (const _chunk of consumed) { /* middleware consumed the original stream */ }
  Object.assign(consumed, { rawBody: Buffer.from('{}'), body: {} })
  await expect(readSummarySendRequest(consumed)).rejects.toMatchObject({ status: 400 })
})

it.each(['application/json', 'application/json; charset=utf-8', 'APPLICATION/JSON; CHARSET="UTF-8"'])('acepta tipo JSON %s', async type => {
  expect(await readSummarySendRequest(request('{}', { 'content-type': type }))).toBe(id)
})
it.each([undefined, '', 'text/plain', 'application/octet-stream', 'application/x-www-form-urlencoded', 'application/json; charset=latin1', 'application/json; charset=utf-8; invalid', ['application/json']])('rechaza contenido con Content-Type incompatible: %j', async type => {
  await expect(readSummarySendRequest(request('{}', { 'content-type': type }))).rejects.toMatchObject({ status: 400 })
})
it('acepta 1024 bytes exactos y rechaza un byte adicional antes de parsear', async () => {
  expect(await readSummarySendRequest(request('{}' + ' '.repeat(1022)))).toBe(id)
  await expect(readSummarySendRequest(request('{}' + ' '.repeat(1023)))).rejects.toMatchObject({ status: 413 })
})
it('mide bytes Unicode reales incluso si Content-Length declara menos', async () => {
  await expect(readSummarySendRequest(request('ñ'.repeat(513), { 'content-length': '513' }))).rejects.toMatchObject({ status: 413 })
})
it.each(['0', '1', '3'])('rechaza diferencia entre Content-Length %s y bytes recibidos', async length => {
  await expect(readSummarySendRequest(request('{}', { 'content-length': length }))).rejects.toMatchObject({ status: 400 })
})
it('no confía en ausencia de headers de longitud para asumir cuerpo vacío', async () => {
  await expect(readSummarySendRequest(request(Buffer.alloc(1025)))).rejects.toMatchObject({ status: 413 })
})
it('rechaza UTF-8 inválido en lugar de convertirlo a texto potencialmente válido', async () => {
  await expect(readSummarySendRequest(request(Buffer.from([123, 34, 255, 34, 58, 49, 125])))).rejects.toMatchObject({ status: 400 })
})
it.each([
  { 'content-encoding': 'gzip' },
  { 'content-length': '2', 'transfer-encoding': 'chunked' },
  { 'transfer-encoding': 'unexpected' },
])('rechaza compresión o framing contradictorio: %j', async headers => {
  await expect(readSummarySendRequest(request('{}', headers))).rejects.toMatchObject({ status: 400 })
})
it('normaliza errores del stream sin exponer detalles', async () => {
  const stream = Readable.from((async function* () { yield Buffer.from('{'); throw new Error('PRIVATE_STREAM_DETAIL') })())
  const req = Object.assign(stream, { url: '/api/summary/send', headers: { 'idempotency-key': id }, complete: false })
  const error = await readSummarySendRequest(req as unknown as IncomingMessage).catch(error => error)
  expect(error).toMatchObject({ code: 'INVALID_REQUEST', status: 400 })
  expect(String(error)).not.toContain('PRIVATE_STREAM_DETAIL')
})
it('rechaza EOF incompleto y abortos antes o durante la lectura', async () => {
  const incomplete = request('{}'); incomplete.complete = false
  await expect(readSummarySendRequest(incomplete)).rejects.toMatchObject({ status: 400 })
  const aborted = request('{}'); aborted.aborted = true
  await expect(readSummarySendRequest(aborted)).rejects.toMatchObject({ status: 400 })
  let during!: IncomingMessage
  const stream = Readable.from((async function* () { yield Buffer.from('{}'); during.aborted = true })())
  during = Object.assign(stream, { url: '/api/summary/send', headers: { 'idempotency-key': id, 'content-type': 'application/json' }, complete: true }) as unknown as IncomingMessage
  await expect(readSummarySendRequest(during)).rejects.toMatchObject({ status: 400 })
})
