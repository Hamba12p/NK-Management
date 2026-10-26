import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hasTwoObxIdentifiers, normaliseObxContact, normaliseObxEmail } from '@/lib/obx/contact'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { OBX_PENDING_COOKIE, signPendingLookup } from '@/lib/obx/session'
import { originAllowed, unavailable } from '@/lib/obx/http'
import { isLikelyObxBot } from '@/lib/obx/anti-abuse'

const hash = (value: string, salt: string) => createHmac('sha256', salt).update(value).digest('hex')
const notFound = () => NextResponse.json(
  { error: 'We could not find an active volunteer with those details. Please check them or ask your coordinator.' },
  { status: 404, headers: { 'Cache-Control': 'no-store' } }
)

type RegisteredVolunteer = {
  id: string
  full_name: string
  volunteer_number: string
  is_new: boolean
}

function isRegisteredVolunteer(value: unknown): value is RegisteredVolunteer {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'string'
    && 'full_name' in value
    && typeof value.full_name === 'string'
    && 'volunteer_number' in value
    && typeof value.volunteer_number === 'string'
    && 'is_new' in value
    && typeof value.is_new === 'boolean'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Enter a valid email address and phone number.' }, { status: 400 })
    }
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const emailInput = typeof body.email === 'string' ? body.email.trim() : ''
    const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : ''
    const email = emailInput ? normaliseObxEmail(emailInput) : null
    const phoneContact = phoneInput ? normaliseObxContact(phoneInput) : null
    const phone = phoneContact?.channel === 'phone' ? phoneContact.value : null
    if (
      fullName.length > 160
      || (emailInput && !email)
      || (phoneInput && !phone)
      || !hasTwoObxIdentifiers(fullName, email, phone)
    ) {
      return NextResponse.json({ error: 'Enter any two valid details: your name, email address, or phone number.' }, { status: 400 })
    }

    const admin = createObxAdminClient()
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = hash(ip, salt)
    const contactKey = email && phone
      ? `${email}\0${phone}`
      : email
        ? `${fullName.toLocaleLowerCase()}\0${email}`
        : `${fullName.toLocaleLowerCase()}\0${phone}`
    const pairHash = hash(contactKey, salt)
    const isBot = isLikelyObxBot(body.website, body.startedAt)
    const now = new Date()
    const since = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

    stage = 'lookup rate-limit check'
    const [ipAttempts, pairAttempts] = await Promise.all([
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('contact_pair_hash', pairHash).gte('created_at', since),
    ])
    if (ipAttempts.error || pairAttempts.error) {
      console.error(`[OBX lookup] ${stage} failed (${ipAttempts.error?.code || pairAttempts.error?.code || 'unknown'})`)
      return unavailable()
    }

    const limited = (ipAttempts.count || 0) >= 10 || (pairAttempts.count || 0) >= 5
    const blockedUntil = limited ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null
    let volunteer: RegisteredVolunteer | null = null
    if (!limited && !isBot) {
      stage = 'volunteer registration or lookup'
      const { data: registered, error: registrationError } = await admin
        .rpc('register_obx_volunteer', {
          p_full_name: fullName || null,
          p_email: email,
          p_phone: phone,
          p_hub_profile_id: null,
          p_management: false,
          p_issued_by: null,
        })
        .maybeSingle()
      if (registrationError) {
        if (registrationError.code === 'P0002' || registrationError.code === '23505') {
          stage = 'registration conflict attempt logging'
          const { error: conflictLogError } = await admin.from('obx_auth_attempts').insert({
            ip_hash: ipHash,
            contact_pair_hash: pairHash,
            success: false,
            blocked_until: blockedUntil,
          })
          if (conflictLogError) {
            console.error(`[OBX lookup] ${stage} failed (${conflictLogError.code || 'unknown'})`)
            return unavailable()
          }
          return NextResponse.json({
            error: 'These details do not match an active record. Please check them or use your StaffHub account.',
          }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
        }
        console.error(`[OBX lookup] ${stage} failed (${registrationError.code || 'unknown'})`)
        return unavailable()
      }
      if (isRegisteredVolunteer(registered)) volunteer = registered
    }

    stage = 'lookup attempt logging'
    const { error: logError } = await admin.from('obx_auth_attempts').insert({
      ip_hash: ipHash,
      contact_pair_hash: pairHash,
      success: !!volunteer,
      blocked_until: blockedUntil,
    })
    if (logError) {
      console.error(`[OBX lookup] ${stage} failed (${logError.code || 'unknown'})`)
      return unavailable()
    }

    if (!volunteer || isBot) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return notFound()
    }

    const response = NextResponse.json({
      volunteer: { fullName: volunteer.full_name, volunteerNumber: volunteer.volunteer_number },
      isNew: volunteer.is_new,
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
