import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { normaliseEmail, normaliseVolunteerNumber } from '@/lib/obx/normalise'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { OBX_COOKIE, signSession } from '@/lib/obx/session'
import { originAllowed, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'
import { isRateLimited } from '@/lib/obx/logic'

const genericError = 'We could not match those details. Check your number and email, or ask your coordinator.'
const hash = (value: string) => createHmac('sha256', process.env.OBX_IP_SALT || '').update(value).digest('hex')

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: genericError }, { status: 403 })
  try {
    const body = await request.json()
    const number = typeof body.volunteerNumber === 'string' ? normaliseVolunteerNumber(body.volunteerNumber) : null
    const email = typeof body.email === 'string' ? normaliseEmail(body.email) : ''
    const salt = process.env.OBX_IP_SALT
    if (!salt || salt.length < 32) return unavailable()
    const admin = createObxAdminClient()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = hash(ip)
    const numberHash = hash(number || 'invalid')
    const now = new Date()
    const since = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    const currentTime = now.toISOString()
    const [ipAttempts, numberAttempts] = await Promise.all([
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('success', false).gte('created_at', since),
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('volunteer_number_hash', numberHash).eq('success', false).gte('created_at', since),
    ])
    if (ipAttempts.error || numberAttempts.error) return unavailable()
    const [ipLock, numberLock] = await Promise.all([
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('success', false).gt('blocked_until', currentTime),
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('volunteer_number_hash', numberHash).eq('success', false).gt('blocked_until', currentTime),
    ])
    if (ipLock.error || numberLock.error) return unavailable()
    const locked = (ipLock.count || 0) > 0 || (numberLock.count || 0) > 0
    if (locked) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return NextResponse.json({ error: genericError }, { status: 401 })
    }
    let roster = null
    if (!locked && number && email.includes('@')) {
      const result = await admin.from('volunteer_roster').select('id, volunteer_number').eq('volunteer_number', number).eq('email', email).eq('status', 'active').maybeSingle()
      roster = result.data
      if (result.error) return unavailable()
    }
    const success = !!roster
    const shouldLock = !success && isRateLimited(ipAttempts.count || 0, numberAttempts.count || 0, 7)
    const blockedUntil = shouldLock ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null
    const { error: logError } = await admin.from('obx_auth_attempts').insert({ ip_hash: ipHash, volunteer_number_hash: numberHash, success, blocked_until: blockedUntil })
    if (logError) return unavailable()
    if (!roster) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return NextResponse.json({ error: genericError }, { status: 401 })
    }
    const { data: currentProgress, error: readProgressError } = await admin.from('obx_progress').select('cycle').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (readProgressError) return unavailable()
    if (!currentProgress) {
      const { error: progressError } = await admin.from('obx_progress').insert({ roster_id: roster.id, cycle: 1, course_version: OBX_CONFIG.courseVersion, status: 'in_progress', current_stop: 'meet_nk_udada' })
      if (progressError) return unavailable()
    }
    const token = signSession(roster.id)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(OBX_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 8 * 60 * 60 })
    return response
  } catch {
    return unavailable()
  }
}
