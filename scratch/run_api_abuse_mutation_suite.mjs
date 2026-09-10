import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const apiPath = path.join(root, 'api', 'generate-plan.ts')
const source = fs.readFileSync(apiPath)
const originalHash = sha256(source)

const mutations = [
  {
    id: 'M1',
    name: 'upstream call cap bypass',
    apply(text) {
      return replaceOnce(text, 'export const MAX_TOTAL_UPSTREAM_CALLS = 3', 'export const MAX_TOTAL_UPSTREAM_CALLS = 4')
    },
  },
  {
    id: 'M2',
    name: 'concurrency slot leak',
    apply(text) {
      return replaceOnce(text, 'activeInFlightRequests = Math.max(0, activeInFlightRequests - 1)', 'activeInFlightRequests = activeInFlightRequests')
    },
  },
  {
    id: 'M3',
    name: 'trusted proxy identity weakening',
    apply(text) {
      return replaceOnce(
        text,
        "    if (isVercel) {\n      return UNKNOWN_CLIENT_IP\n    }",
        "    if (isVercel) {\n      const spoofedForwarded = req.headers['x-forwarded-for']\n      return canonicalizeIp(typeof spoofedForwarded === 'string' ? spoofedForwarded : undefined) || UNKNOWN_CLIENT_IP\n    }",
      )
    },
  },
  {
    id: 'M4',
    name: 'correction/retry loop amplification',
    apply(text) {
      let mutated = replaceOnce(text, "      'gemini-1.5-flash',", "      'gemini-1.5-flash',\n      'gemini-1.0-flash',")
      mutated = replaceOnce(mutated, 'if (totalUpstreamCalls >= MAX_TOTAL_UPSTREAM_CALLS) break', 'if (totalUpstreamCalls > MAX_TOTAL_UPSTREAM_CALLS) break')
      return mutated
    },
  },
]

const commands = [
  'src/__tests__/apiAbuseIndependentContract.test.ts',
  'src/__tests__/apiAbuseResistanceBoundaryOracle.test.ts',
]
const records = []

try {
  for (const mutation of mutations) {
    const before = fs.readFileSync(apiPath)
    if (sha256(before) !== originalHash) throw new Error(`${mutation.id}: source changed before mutation`)

    const mutated = mutation.apply(before.toString('utf8'))
    fs.writeFileSync(apiPath, mutated, 'utf8')
    const run = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=dot', ...commands], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    })
    const output = `${run.stdout || ''}${run.stderr || ''}`
    const failed = run.error === undefined && run.status !== 0
    const representative = output
      .split(/\r?\n/)
      .filter(line => /FAIL|AssertionError|expected .* to|Test Files|Tests/.test(line))
      .slice(-8)

    fs.writeFileSync(apiPath, before)
    const restoredHash = sha256(fs.readFileSync(apiPath))
    if (restoredHash !== originalHash) throw new Error(`${mutation.id}: SHA-256 restore mismatch`)

    records.push({
      id: mutation.id,
      name: mutation.name,
      exitCode: run.status,
      spawnError: run.error?.message || null,
      detected: failed,
      representative,
    })
  }
} finally {
  fs.writeFileSync(apiPath, source)
}

const cleanRun = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=dot', ...commands], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
})
const finalHash = sha256(fs.readFileSync(apiPath))
if (finalHash !== originalHash) throw new Error('Final SHA-256 does not match baseline')

console.log(JSON.stringify({
  baselineSha256: originalHash,
  finalSha256: finalHash,
  mutations: records,
  cleanRunExitCode: cleanRun.status,
  cleanRunSpawnError: cleanRun.error?.message || null,
  cleanRunSummary: `${cleanRun.stdout || ''}${cleanRun.stderr || ''}`.split(/\r?\n/).filter(line => /Test Files|Tests/.test(line)).slice(-4),
}, null, 2))

if (records.some(record => !record.detected) || cleanRun.status !== 0) process.exit(1)

function replaceOnce(text, oldText, newText) {
  const first = text.indexOf(oldText)
  if (first < 0 || text.indexOf(oldText, first + oldText.length) >= 0 && oldText.length === 0) {
    throw new Error(`Mutation anchor not found: ${oldText}`)
  }
  return text.slice(0, first) + newText + text.slice(first + oldText.length)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
