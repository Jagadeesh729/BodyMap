import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const files = {
  binding: path.join(root, 'src', 'lib', 'planBinding.ts'),
  state: path.join(root, 'src', 'context', 'planStorage.ts'),
  session: path.join(root, 'src', 'lib', 'sessionStorage.ts'),
  context: path.join(root, 'src', 'context', 'PlanContext.tsx'),
}
const snapshots = new Map(Object.entries(files).map(([key, file]) => [key, { file, bytes: fs.readFileSync(file), hash: sha256(fs.readFileSync(file)) }]))
const tests = [
  'src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts',
  'src/__tests__/stateProvenanceConsistencyOracle.test.ts',
  'src/__tests__/persistedTamperResistance.test.ts',
  'src/__tests__/crossTabSync.test.tsx',
  'src/__tests__/medicalProfileTrust.test.tsx',
]

const mutations = [
  { id: 'M1', name: 'disable profile-binding validation', file: 'binding', apply: text => replaceOnce(text, 'const isSafetyMismatched = mismatchedSafetyFields.length > 0', 'const isSafetyMismatched = false') },
  { id: 'M2', name: 'disable saved-state fingerprint validation', file: 'state', apply: text => replaceOnce(text, 'computeProfileFingerprint(safeBoundProfile) !== raw.boundProfileFingerprint.trim()', 'false') },
  { id: 'M3', name: 'remove runtime session exercise scan', file: 'session', apply: text => replaceOnce(text, 'if (curMed.length > 0 && session.exercises.length > 0)', 'if (false && curMed.length > 0 && session.exercises.length > 0)') },
  { id: 'M4', name: 'allow stale cross-tab session resurrection', file: 'context', apply: text => replaceOnce(text, 'if (remotePlanChanged || medicalSafetyDiverged || allergensDiverged) {', 'if (false) {') },
]

const records = []
for (const mutation of mutations) {
  restoreAll()
  const snapshot = snapshots.get(mutation.file)
  fs.writeFileSync(snapshot.file, mutation.apply(snapshot.bytes.toString('utf8')), 'utf8')
  const run = runTests()
  const output = `${run.stdout || ''}${run.stderr || ''}`
  restoreAll()
  const restored = sha256(fs.readFileSync(snapshot.file)) === snapshot.hash
  records.push({
    id: mutation.id,
    name: mutation.name,
    detected: run.error === undefined && run.status !== 0,
    exitCode: run.status,
    spawnError: run.error?.message || null,
    restored,
    representative: output.split(/\r?\n/).filter(line => /FAIL|AssertionError|expected .* to|Test Files|Tests/.test(line)).slice(-10),
  })
  if (!restored) throw new Error(`${mutation.id}: source restoration hash mismatch`)
}

restoreAll()
const clean = runTests()
const allRestored = [...snapshots.values()].every(snapshot => sha256(fs.readFileSync(snapshot.file)) === snapshot.hash)
console.log(JSON.stringify({
  snapshots: Object.fromEntries([...snapshots].map(([key, value]) => [key, value.hash])),
  mutations: records,
  cleanRun: { exitCode: clean.status, spawnError: clean.error?.message || null, summary: `${clean.stdout || ''}${clean.stderr || ''}`.split(/\r?\n/).filter(line => /Test Files|Tests/.test(line)).slice(-4) },
  allRestored,
}, null, 2))

if (!allRestored || clean.status !== 0 || records.some(record => !record.detected || !record.restored)) process.exit(1)

function runTests() {
  return spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=dot', ...tests], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })
}

function restoreAll() {
  for (const snapshot of snapshots.values()) fs.writeFileSync(snapshot.file, snapshot.bytes)
}

function replaceOnce(text, oldText, newText) {
  const first = text.indexOf(oldText)
  if (first < 0) throw new Error(`Mutation anchor not found: ${oldText}`)
  return text.slice(0, first) + newText + text.slice(first + oldText.length)
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}