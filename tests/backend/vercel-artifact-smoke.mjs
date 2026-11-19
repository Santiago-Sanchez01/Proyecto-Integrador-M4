import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Usage: node tests/backend/vercel-artifact-smoke.mjs <Vercel output directory>
// Exercise the emitted files with Node's native loader, without Vite or network.
assert.ok(process.argv[2], 'Pass the Vercel output directory.')
const output = resolve(process.argv[2])

for (const route of ['api/summary', 'api/summary/send']) {
  const directory = join(output, 'functions', `${route}.func`)
  const config = JSON.parse(await readFile(join(directory, '.vc-config.json'), 'utf8'))
  assert.equal(config.runtime, 'nodejs24.x')
  const { default: handler } = await import(pathToFileURL(join(directory, config.handler)).href)
  assert.equal(typeof handler, 'function')

  for (const [method, status, code] of [
    ['GET', 405, 'METHOD_NOT_ALLOWED'],
    ['POST', 401, 'UNAUTHENTICATED'],
  ]) {
    const headers = new Map()
    let body
    const response = {
      statusCode: 200,
      setHeader: (name, value) => headers.set(name, value),
      end: value => { body = JSON.parse(value) },
    }
    await handler({ method, headers: {} }, response)
    assert.equal(response.statusCode, status, `${method} /${route}`)
    assert.equal(body?.error?.code, code)
    if (method === 'GET') assert.equal(headers.get('Allow'), 'POST')
    console.log(`${method} /${route} → ${status} ${code}`)
  }
}
