import { createHmac, timingSafeEqual } from 'node:crypto'

export const OBX_COOKIE = 'nk_obx_session'
const SESSION_SECONDS = 8 * 60 * 60

type SessionPayload = { rosterId: string; issuedAt: number; expiresAt: number }

function secret() {
  const value = process.env.OBX_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('OBX_SESSION_SECRET must contain at least 32 characters')
  return value
}

function signature(encoded: string) {
  return createHmac('sha256', secret()).update(encoded).digest('base64url')
}

export function signSession(rosterId: string, now = Date.now()): string {
  const payload: SessionPayload = { rosterId, issuedAt: now, expiresAt: now + SESSION_SECONDS * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function verifySession(token: string, now = Date.now()): SessionPayload | null {
  try {
    const [encoded, supplied, extra] = token.split('.')
    if (!encoded || !supplied || extra) return null
    const expectedBytes = Buffer.from(signature(encoded))
    const suppliedBytes = Buffer.from(supplied)
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.rosterId !== 'string' || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return null
    if (payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== SESSION_SECONDS * 1000) return null
    return payload
  } catch {
    return null
  }
}
