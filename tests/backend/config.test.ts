import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it('desactiva helpers en el entorno de build real que utiliza Vercel Dev para conservar bytes crudos', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')) as { build: { env: Record<string, string> } }
  expect(config.build.env).toEqual({ NODEJS_HELPERS: '0' })
})

async function fallbackPattern() {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] }
  expect(config.rewrites).toHaveLength(1)
  const rewrite = config.rewrites[0]
  expect(rewrite.destination).toBe('/index.html')
  return new RegExp(`^${rewrite.source}$`)
}

it('aplica el fallback a las cinco rutas SPA con y sin barra final', async () => {
  const pattern = await fallbackPattern()
  for (const route of ['/login', '/register', '/jornada', '/tareas', '/resumen']) {
    expect(pattern.test(route), route).toBe(true)
    expect(pattern.test(`${route}/`), `${route}/`).toBe(true)
  }
})

it('no captura módulos Vite, recursos, API ni rutas ajenas a la lista SPA', async () => {
  const pattern = await fallbackPattern()
  for (const path of ['/src/main.tsx', '/@vite/client', '/@react-refresh', '/@id/react', '/@fs/example',
    '/node_modules', '/node_modules/', '/node_modules/.vite/deps/react.js',
    '/api', '/api/', '/api/summary', '/api/summary/', '/api/summary/send', '/api/summary/send/', '/api/unknown',
    '/assets/index.js', '/favicon.svg', '/index.html', '/tareas/extra', '/desconocida']) {
    expect(pattern.test(path), path).toBe(false)
  }
})

it('deja la raíz disponible mediante el index.html nativo sin reescribirla', async () => {
  expect((await fallbackPattern()).test('/')).toBe(false)
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8')
  expect(html).toContain('<div id="root"></div>')
  expect(html).toContain('src="/src/main.tsx"')
})
