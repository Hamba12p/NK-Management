import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { normaliseObxContact } from '@/lib/obx/contact'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { OBX_PENDING_COOKIE, signPendingLookup } from '@/lib/obx/session'
import { originAllowed, unavailable } from '@/lib/obx/http'

const hash = (value: string, salt: string) => createHmac('sha256', salt).update(value).digest('hex')
const notFound = () => NextResponse.json(
  { error: 'We could not find an active volunteer with those details. Ask your coordinator to confirm your record is imported and active, and that both details match the roster.' },
  { status: 404, headers: { 'Cache-Control': 'no-store' } }
)
const rateLimited = () => NextResponse.json(
  { error: 'Too many lookup attempts. Please wait 15 minutes before trying again.' },
  { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } }
)

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })

  const salt = process.env.OBX_IP_SALT
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sessionSecret = process.env.OBX_SESSION_SECRET
  if (!salt || salt.length < 32 || !supabaseUrl || !serviceRoleKey || !sessionSecret || sessionSecret.length < 32) {
    const missingConfig = [
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      !sessionSecret || sessionSecret.length < 32 ? 'OBX_SESSION_SECRET' : null,
      !salt || salt.length < 32 ? 'OBX_IP_SALT' : null,
    ].filter((name): name is string => name !== null)
    console.error(`[OBX lookup] Required server configuration is missing or invalid: ${missingConfig.join(', ')}`)
    return unavailable()
  }

  let stage = 'request parsing'
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? normaliseObxContact(body.email) : null
    const phone = typeof body.phone === 'string' ? normaliseObxContact(body.phone) : null
    if (email?.channel !== 'email' || phone?.channel !== 'phone') {
      return NextResponse.json({ error: 'Enter a valid rostered email address and phone number.' }, { status: 400 })
    }

    const admin = createObxAdminClient()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = hash(ip, salt)
    const pairHash = hash(`${email.value}\0${phone.value}`, salt)
    const now = new Date()
    const since = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

    stage = 'lookup rate-limit check'
    const [ipAttempts, pairAttempts] = await Promise.all([
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('volunteer_number_hash', pairHash).gte('created_at', since),
    ])
    if (ipAttempts.error || pairAttempts.error) {
      console.error(`[OBX lookup] ${stage} failed (${ipAttempts.error?.code || pairAttempts.error?.code || 'unknown'})`)
      return unavailable()
    }

    const limited = (ipAttempts.count || 0) >= 10 || (pairAttempts.count || 0) >= 5
    if (limited) {
      return rateLimited()
    }

    stage = 'active volunteer lookup'
    const { data: volunteer, error: lookupError } = await admin.from('volunteer_roster')
      .select('id, full_name, volunteer_number')
      .eq('email', email.value)
      .eq('phone', phone.value)
      .eq('status', 'active')
      .maybeSingle()
    if (lookupError) {
      console.error(`[OBX lookup] ${stage} failed (${lookupError.code || 'unknown'})`)
      return unavailable()
    }

    stage = 'lookup attempt logging'
    const { error: logError } = await admin.from('obx_auth_attempts').insert({
      ip_hash: ipHash,
      volunteer_number_hash: pairHash,
      success: !!volunteer,
      blocked_until: null,
    })
    if (logError) {
      console.error(`[OBX lookup] ${stage} failed (${logError.code || 'unknown'})`)
      return unavailable()
    }

    if (!volunteer) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return notFound()
    }

    const response = NextResponse.json({
      volunteer: { fullName: volunteer.full_name, volunteerNumber: volunteer.volunteer_number },
    }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(OBX_PENDING_COOKIE, signPendingLookup(volunteer.id), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/obx',
      maxAge: 5 * 60,
    })
    return response
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : error instanceof Error ? error.name : 'unknown'
    console.error(`[OBX lookup] ${stage} failed (${code})`)
    return unavailable()
  }
}
