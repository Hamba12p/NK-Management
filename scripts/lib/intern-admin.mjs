import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

export function parseArgs(allowed) {
  const values = { apply: false }
  const booleanFlags = new Set([
    'apply',
    ...['show-password', 'no-expiry', 'use-env-password'].filter(flag => allowed.includes(flag)),
  ])
  for (let index = 2; index < process.argv.length; index += 1) {
    const token = process.argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const [name, inlineValue] = token.slice(2).split('=', 2)
    if (!allowed.includes(name) && !booleanFlags.has(name)) throw new Error(`Unknown option: --${name}`)
    if (booleanFlags.has(name)) { values[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true; continue }
    const value = inlineValue ?? process.argv[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`)
    values[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value
  }
  return values
}

export function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid --email value.')
  return email
}

export function addWeeks(value, weeks) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString()
}

export function addMonths(value, months) {
  const date = new Date(`${value}T00:00:00.000Z`)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString()
}

export async function profileForEmail(client, email) {
  const { data, error } = await client.from('profiles').select('id,full_name,email,role,access_starts_on,access_expires_at,intern_access_enabled,must_change_password,password_change_required_on,display_tag').ilike('email', email).maybeSingle()
  if (error) throw new Error(`Profile lookup failed: ${error.message}`)
  return data
}

export async function authUserForEmail(client, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`)
    const match = data.users.find(user => user.email?.toLowerCase() === email)
    if (match) return match
    if (data.users.length < 1000) return null
  }
  throw new Error('Auth user search exceeded 20,000 accounts. Resolve the email lookup manually.')
}

export async function requireIntern(client, email) {
  const [profile, user] = await Promise.all([profileForEmail(client, email), authUserForEmail(client, email)])
  if (!profile || profile.role !== 'intern' || !user || profile.id !== user.id) {
    throw new Error('No matching intern profile and Auth user were found for that email.')
  }
  return { profile, user }
}

export function deterministicUuid(seed) {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
