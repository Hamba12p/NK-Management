import { createHmac, timingSafeEqual } from 'node:crypto'

export const OBX_COOKIE = 'nk_obx_session'
export const OBX_PENDING_COOKIE = 'nk_obx_pending'
const SESSION_SECONDS = 8 * 60 * 60
const PENDING_SECONDS = 5 * 60

type SessionPayload = { rosterId: string; issuedAt: number; expiresAt: number }

function secret() {
  const value = process.env.OBX_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('OBX_SESSION_SECRET must contain at least 32 characters')
  return value
}

function signature(encoded: string) {
  return createHmac('sha256', secret()).update(encoded).digest('base64url')
}

function signToken(rosterId: string, lifetimeSeconds: number, now: number) {
  const payload: SessionPayload = { rosterId, issuedAt: now, expiresAt: now + lifetimeSeconds * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

function verifyToken(token: string, lifetimeSeconds: number, now: number): SessionPayload | null {
  try {
    const [encoded, supplied, extra] = token.split('.')
    if (!encoded || !supplied || extra) return null
    const expectedBytes = Buffer.from(signature(encoded))
    const suppliedBytes = Buffer.from(supplied)
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.rosterId !== 'string' || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return null
    if (payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== lifetimeSeconds * 1000) return null
    return payload
  } catch {
    return null
  }
}

export function signSession(rosterId: string, now = Date.now()): string {
  return signToken(rosterId, SESSION_SECONDS, now)
}

export function verifySession(token: string, now = Date.now()): SessionPayload | null {
  return verifyToken(token, SESSION_SECONDS, now)
}

export function signPendingLookup(rosterId: string, now = Date.now()): string {
  return signToken(rosterId, PENDING_SECONDS, now)
}

export function verifyPendingLookup(token: string, now = Date.now()): SessionPayload | null {
  return verifyToken(token, PENDING_SECONDS, now)
}
