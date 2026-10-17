import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const required = [
  'docs/audits/catalog-snapshot.json',
  'scripts/audit-catalog.ts',
  'docs/deviations.md',
  'docs/LAUNCH_READINESS_100_USERS.md',
  'prisma/schema.prisma',
  'scripts/check-rls.ts',
  'src/services',
]

let repository = null
try {
  repository = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim() || null
} catch {
  repository = null
}

const result = {
  repository,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  requiredInputs: Object.fromEntries(required.map((path) => [path, existsSync(path)])),
}

const snapshot = 'docs/audits/catalog-snapshot.json'
if (existsSync(snapshot)) {
  const parsed = JSON.parse(readFileSync(snapshot, 'utf8'))
  result.snapshot = { topLevelType: Array.isArray(parsed) ? 'array' : typeof parsed }
} else {
  result.snapshot = null
}

console.log(JSON.stringify(result, null, 2))
const missing = Object.values(result.requiredInputs).filter((present) => !present).length
process.exitCode = missing ? 2 : 0
