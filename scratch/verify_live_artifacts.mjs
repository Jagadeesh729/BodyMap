import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const base = 'https://bodymap-ai.vercel.app'
const root = path.resolve(import.meta.dirname, '..')
const results = []

async function probe(name, url, options = {}) {
  try {
    const response = await fetch(url, { redirect: 'manual', ...options })
    const bytes = Buffer.from(await response.arrayBuffer())
    results.push({ name, status: response.status, bytes: bytes.length, requestId: response.headers.get('x-request-id'), cache: response.headers.get('cache-control'), csp: response.headers.get('content-security-policy'), contentType: response.headers.get('content-type') })
    return { response, bytes }
  } catch (error) {
    results.push({ name, status: 'transport-error', error: error.message })
    return { response: null, bytes: Buffer.alloc(0) }
  }
}

const rootPage = await probe('root', `${base}/`)
const html = rootPage.bytes.toString('utf8')
const assetPaths = [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]).filter(value => value.startsWith('/assets/')))]
const currentAssets = assetPaths.slice(0, 8)

for (const route of ['/dashboard', '/create-plan', '/about', '/contact', '/download-plan', '/gym-mode']) await probe(`deep:${route}`, `${base}${route}`)
for (const asset of currentAssets) await probe(`asset:${asset}`, `${base}${asset}`)
for (const font of ['/fonts/fonts.css', '/fonts/poppins-400.woff2', '/fonts/opensans-variable.woff2']) await probe(`font:${font}`, `${base}${font}`)
for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'TRACE']) await probe(`api:${method}`, `${base}/api/generate-plan`, { method })
await probe('api:OPTIONS', `${base}/api/generate-plan`, { method: 'OPTIONS', headers: { Origin: 'https://example.invalid' } })
await probe('api:malformed', `${base}/api/generate-plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json' })
await probe('api:invalid-schema', `${base}/api/generate-plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
await probe('api:oversized', `${base}/api/generate-plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(16385) })
await probe('robots', `${base}/robots.txt`)

const correspondence = []
for (const asset of currentAssets) {
  const live = await fetch(`${base}${asset}`)
  const liveBytes = Buffer.from(await live.arrayBuffer())
  const localPath = path.join(root, 'dist', asset.slice(1).replaceAll('/', path.sep))
  const localBytes = fs.existsSync(localPath) ? fs.readFileSync(localPath) : null
  correspondence.push({ asset, liveSha256: sha256(liveBytes), localSha256: localBytes ? sha256(localBytes) : null, byteIdentical: Boolean(localBytes && sha256(localBytes) === sha256(liveBytes)) })
}

const rootResult = results.find(item => item.name === 'root')
const apiResults = results.filter(item => item.name.startsWith('api:'))
console.log(JSON.stringify({
  probeCount: results.length,
  results,
  htmlAssetPaths: assetPaths,
  correspondence,
  rootHasCsp: Boolean(rootResult?.csp),
  apiMaxBodyBytes: Math.max(...apiResults.map(item => item.bytes)),
}, null, 2))

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}