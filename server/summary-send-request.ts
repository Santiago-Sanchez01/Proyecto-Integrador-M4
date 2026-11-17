import type { IncomingMessage } from 'node:http'
import { TextDecoder } from 'node:util'
import { SummarySendFailure } from './summary-send-errors'

export const MAX_SEND_REQUEST_BYTES = 1024
export class SendRequestTooLargeError extends Error {
  readonly code = 'INVALID_REQUEST' as const
  readonly status = 413
  constructor() { super('La solicitud supera el tamaño permitido.') }
}
function invalid(): never { throw new SummarySendFailure('INVALID_REQUEST') }

function validateContent(body: Buffer, contentType: unknown) {
  // No compression or charset conversion: the measured bytes are the bytes parsed.
  if (contentType !== undefined && (typeof contentType !== 'string'
    || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType))) invalid()
  if (body.length === 0) return
  if (contentType === undefined) invalid()
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body)) }
  catch { return invalid() }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 0) invalid()
}

/** Read the original untouched stream once. Never trust or access req.body helpers. */
export async function readSummarySendRequest(req: IncomingMessage): Promise<string> {
  if (new URL(req.url ?? '/', 'http://localhost').search) invalid()
  const header = req.headers['idempotency-key']
  if (typeof header !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(header)) invalid()
  const length = req.headers['content-length']
  if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length))) invalid()
  if (Number(length ?? 0) > MAX_SEND_REQUEST_BYTES) throw new SendRequestTooLargeError()
  const transfer = req.headers['transfer-encoding']
  if (transfer !== undefined && (typeof transfer !== 'string' || transfer.toLowerCase() !== 'chunked' || length !== undefined)) invalid()
  if (req.headers['content-encoding'] !== undefined && req.headers['content-encoding'] !== 'identity') invalid()
  // Middleware may have discarded bytes, even when it exposes an empty parsed object.
  // An ended/read stream is not consumed again; Content-Length alone is not evidence.
  if (req.aborted || req.destroyed || req.readableDidRead || req.readableEnded || req.readableEncoding
    || typeof req.iterator !== 'function') invalid()
  const chunks: Buffer[] = []
  let bytes = 0
  try {
    // Leave the socket available for the handler's controlled 400/413 response.
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      if (!Buffer.isBuffer(chunk)) invalid()
      bytes += chunk.length
      if (bytes > MAX_SEND_REQUEST_BYTES) throw new SendRequestTooLargeError()
      chunks.push(chunk)
    }
  } catch (error) {
    if (error instanceof SummarySendFailure || error instanceof SendRequestTooLargeError) throw error
    return invalid()
  }
  if (req.aborted || req.complete !== true || (length !== undefined && bytes !== Number(length))) invalid()
  validateContent(Buffer.concat(chunks, bytes), req.headers['content-type'])
  return header.toLowerCase()
}
