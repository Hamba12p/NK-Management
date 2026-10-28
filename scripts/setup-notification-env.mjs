import { randomBytes } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush from 'web-push'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
const subjectDefault = 'mailto:admin@the-nkfoundation.org'
const configuredKeys = [
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'PUSH_DISPATCH_SECRET',
  'CRON_SECRET',
]
const argumentsList = process.argv.slice(2)
const dryRun = argumentsList.includes('--dry-run')
if (argumentsList.some(argument => argument !== '--dry-run') || argumentsList.filter(argument => argument === '--dry-run').length > 1) {
  throw new Error('Only --dry-run is supported.')
}

let contents
try {
  contents = await readFile(envPath, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  contents = ''
}

const lines = contents.split(/\r\n|\n|\r/)
const entries = new Map()
for (const key of configuredKeys) {
  const matches = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(new RegExp(`^(\\s*${key}\\s*=)(.*)$`))
    if (match) matches.push({ index, prefix: match[1], value: match[2].trim() })
  }
  if (matches.length > 1) throw new Error(`Duplicate environment variable: ${key}`)
  entries.set(key, matches[0] || null)
}

const isEmpty = entry => !entry
  || entry.value === ''
  || entry.value === '""'
  || entry.value === "''"
const rawValueFor = key => {
  const match = contents.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm'))
  return match?.[1]?.replace(/^(['"])(.*)\1$/, '$2') || ''
}
const publicKeyEntry = entries.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
const privateKeyEntry = entries.get('VAPID_PRIVATE_KEY')
if (isEmpty(publicKeyEntry) !== isEmpty(privateKeyEntry)) {
  throw new Error('Only one VAPID key is configured; resolve the existing pair before generating keys.')
}

const updates = new Map()
if (isEmpty(publicKeyEntry)) {
  const vapid = webpush.generateVAPIDKeys()
  updates.set('NEXT_PUBLIC_VAPID_PUBLIC_KEY', vapid.publicKey)
  updates.set('VAPID_PRIVATE_KEY', vapid.privateKey)
}
if (isEmpty(entries.get('VAPID_SUBJECT'))) {
  updates.set('VAPID_SUBJECT', subjectDefault)
}
if (isEmpty(entries.get('PUSH_DISPATCH_SECRET'))) {
  let dispatchSecret
  do {
    dispatchSecret = randomBytes(32).toString('hex')
  } while (
    dispatchSecret === rawValueFor('CRON_SECRET')
    || dispatchSecret === rawValueFor('OBX_SESSION_SECRET')
    || dispatchSecret === rawValueFor('OBX_IP_SALT')
  )
  updates.set('PUSH_DISPATCH_SECRET', dispatchSecret)
}
if (isEmpty(entries.get('CRON_SECRET'))) {
  let cronSecret
  do {
    cronSecret = randomBytes(32).toString('hex')
  } while (
    cronSecret === (updates.get('PUSH_DISPATCH_SECRET') || rawValueFor('PUSH_DISPATCH_SECRET'))
    || cronSecret === rawValueFor('OBX_SESSION_SECRET')
    || cronSecret === rawValueFor('OBX_IP_SALT')
  )
  updates.set('CRON_SECRET', cronSecret)
}

for (const key of configuredKeys) {
  const update = updates.get(key)
  if (update === undefined) {
    console.log(`${key}: already present`)
  } else if (dryRun) {
    console.log(`${key}: would be set`)
  } else {
    console.log(`${key}: set`)
  }
}

if (dryRun || updates.size === 0) process.exit(0)

const newline = contents.match(/\r\n|\n|\r/)?.[0] || '\n'
const append = []
const chunks = contents.split(/(\r\n|\n|\r)/)
for (let index = 0; index < chunks.length; index += 2) {
  const match = chunks[index].match(/^(\s*([A-Za-z_][A-Za-z0-9_]*)\s*=)(.*)$/)
  if (match) {
    const value = updates.get(match[2])
    if (value !== undefined) chunks[index] = `${match[1]}${value}`
  }
}
for (const [key, value] of updates) {
  if (!entries.get(key)) append.push(`${key}=${value}`)
}
let updatedContents = chunks.join('')
const hasTrailingNewline = /(\r\n|\n|\r)$/.test(contents)
if (append.length) {
  if (updatedContents && !hasTrailingNewline) updatedContents += newline
  updatedContents += append.join(newline)
  if (hasTrailingNewline) updatedContents += newline
}

const temporaryPath = `${envPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp.local`
try {
  await writeFile(temporaryPath, updatedContents, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temporaryPath, envPath)
} catch {
  const { unlink } = await import('node:fs/promises')
  await unlink(temporaryPath).catch(() => {})
  throw new Error('Unable to update .env.local atomically.')
}
