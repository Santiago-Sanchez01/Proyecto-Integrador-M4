import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Usage: node --no-experimental-require-module tests/backend/vercel-artifact-smoke.mjs <Vercel output directory>
// Exercise the emitted files with Node's native loader, without Vite or network.
assert.ok(process.argv[2], 'Pass the Vercel output directory.')
assert.equal(process.features.require_module, false, 'Use --no-experimental-require-module to match Vercel.')
const output = resolve(process.argv[2])
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'smoke', alg: 'RS256', use: 'sig' }

for (const route of ['api/summary', 'api/summary/send', 'api/summary/aws-check', 'api/summary/guard-check']) {
  const directory = join(output, 'functions', `${route}.func`)
  const config = JSON.parse(await readFile(join(directory, '.vc-config.json'), 'utf8'))
  assert.equal(config.runtime, 'nodejs24.x')
  const entry = join(directory, config.handler)
  const { default: handler } = await import(pathToFileURL(entry).href)
  assert.equal(typeof handler, 'function')

  // Resolve dependencies as Firebase Admin does inside the packaged Function.
  const fromEntry = createRequire(entry)
  const fromFirebase = createRequire(fromEntry.resolve('firebase-admin/auth'))
  const fromJwks = createRequire(fromFirebase.resolve('jwks-rsa'))
  const josePath = relative(directory, fromJwks.resolve('jose'))
  assert.ok(!isAbsolute(josePath) && !josePath.startsWith('..'), 'JOSE must resolve inside the Function artifact.')
  const { retrieveSigningKeys } = fromJwks('./utils.js')
  const keys = await retrieveSigningKeys([jwk])
  assert.equal(keys.length, 1)
  assert.equal(keys[0].kid, 'smoke')
  assert.equal(keys[0].getPublicKey(), publicKey.export({ type: 'spki', format: 'pem' }))

  const awsCheck = route === 'api/summary/aws-check'
  const guardCheck = route === 'api/summary/guard-check'
  const previewCheck = awsCheck || guardCheck
  if (previewCheck) Object.assign(process.env, {
    VERCEL: '1', VERCEL_PROJECT_NAME: 'workspace-m4',
    VERCEL_GIT_COMMIT_REF: 'feat/summary-email-cloud-integration',
    AWS_STS_DIAGNOSTIC_ALLOWED_UID: 'smoke-fixture-uid',
  })
  if (guardCheck) Object.assign(process.env, {
    FIREBASE_ADMIN_CREDENTIAL_MODE: 'vercel-oidc', FIREBASE_ADMIN_PROJECT_ID: 'workspace-m4',
    FIRESTORE_GUARD_CHECK_ALLOWED_UID: 'smoke-fixture-uid',
    FIRESTORE_GUARD_CHECK_PROJECT_ID: 'workspace-guard-smoke',
    FIRESTORE_GUARD_CHECK_DATABASE_ID: 'workspace-guard-diagnostics',
  })

  const requests = [
    ['GET', 405, 'METHOD_NOT_ALLOWED'],
    ['POST', 401, 'UNAUTHENTICATED'],
  ]
  if (previewCheck) requests.push(['POST', 404, 'DIAGNOSTIC_DISABLED'])
  for (const [method, status, code] of requests) {
    if (previewCheck) {
      process.env.VERCEL_ENV = status === 404 ? 'production' : 'preview'
      process.env.VERCEL_TARGET_ENV = process.env.VERCEL_ENV
    }
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
