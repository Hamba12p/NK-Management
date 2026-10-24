import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normaliseObxContact } from '@/lib/obx/contact'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { originAllowed, unavailable } from '@/lib/obx/http'

const genericResponse = {
  ok: true,
  message: 'If your email or phone is on the approved volunteer list, a verification link or code will be sent.',
}
const hash = (value: string, salt: string) => createHmac('sha256', salt).update(value).digest('hex')
const reportFailure = (stage: string, code?: string) => {
  console.error(`[OBX request-link] ${stage} failed${code ? ` (${code})` : ''}`)
  return unavailable()
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })

  const salt = process.env.OBX_IP_SALT
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!salt || salt.length < 32 || !supabaseUrl || !publishableKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const missingConfig = [
      !salt || salt.length < 32 ? 'OBX_IP_SALT' : null,
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !publishableKey ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : null,
      !process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter((name): name is string => name !== null)
    return reportFailure(`configuration missing or invalid: ${missingConfig.join(', ')}`)
  }

  let stage = 'request parsing'
  try {
    const body = await request.json()
    const contact = typeof body.contact === 'string' ? normaliseObxContact(body.contact) : null
    if (!contact) return NextResponse.json({ error: 'Enter a valid email address or phone number.' }, { status: 400 })

    stage = 'rate-limit lookup; confirm the OBX migrations are applied'
    const admin = createObxAdminClient()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHash = hash(ip, salt)
    const contactHash = hash(contact.value, salt)
    const now = new Date()
    const since = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    const [ipRequests, contactRequests] = await Promise.all([
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      admin.from('obx_auth_attempts').select('id', { count: 'exact', head: true }).eq('volunteer_number_hash', contactHash).gte('created_at', since),
    ])
    if (ipRequests.error || contactRequests.error) {
      return reportFailure(stage, ipRequests.error?.code || contactRequests.error?.code)
    }

    const attemptLimitReached = (ipRequests.count || 0) >= 10 || (contactRequests.count || 0) >= 5
    const blockedUntil = attemptLimitReached ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null
    let sent = false
    if (!attemptLimitReached) {
      stage = contact.channel === 'email'
        ? 'email roster lookup'
        : 'phone roster lookup; confirm the phone-column migration is applied'
      const { data: volunteer, error: rosterError } = contact.channel === 'email'
        ? await admin.from('volunteer_roster')
          .select('id, full_name, email')
          .eq('status', 'active')
          .eq('email', contact.value)
          .maybeSingle()
        : await admin.from('volunteer_roster')
          .select('id, full_name, phone')
          .eq('status', 'active')
          .eq('phone', contact.value)
          .maybeSingle()
      if (rosterError) return reportFailure(stage, rosterError.code)

      if (volunteer) {
        stage = 'Supabase Auth user provisioning'
        const { error: userError } = await admin.auth.admin.createUser({
          ...(contact.channel === 'email' ? { email: contact.value } : { phone: contact.value }),
          email_confirm: false,
          phone_confirm: false,
          user_metadata: { full_name: volunteer.full_name },
        })
        const isExistingUser = userError && ['email_exists', 'phone_exists', 'user_already_exists'].includes(userError.code || '')
        if (userError && !isExistingUser) return reportFailure(stage, userError.code)

        const auth = createClient(supabaseUrl, publishableKey, {
          auth: { autoRefreshToken: false, persistSession: false, flowType: 'implicit' },
        })
        stage = 'Supabase verification delivery'
        const { error } = contact.channel === 'email'
          ? await auth.auth.signInWithOtp({
            email: contact.value,
            options: { shouldCreateUser: false, emailRedirectTo: new URL('/obx/verify', request.url).toString() },
          })
          : await auth.auth.signInWithOtp({ phone: contact.value, options: { shouldCreateUser: false } })
        const deliveryResult = {
          channel: contact.channel,
          status: error?.status || 200,
          code: error?.code || null,
          name: error?.name || null,
        }
        if (error) console.error('[OBX request-link] Supabase verification request failed', deliveryResult)
        else console.info('[OBX request-link] Supabase accepted verification request', deliveryResult)
        sent = !error
      }
    }

    stage = 'rate-limit attempt logging; confirm the OBX migrations and service-role grants are applied'
    const { error: logError } = await admin.from('obx_auth_attempts').insert({
      ip_hash: ipHash,
      volunteer_number_hash: contactHash,
      success: sent,
      blocked_until: blockedUntil,
    })
    if (logError) return reportFailure(stage, logError.code)

    if (!sent) await new Promise((resolve) => setTimeout(resolve, 300))
    return NextResponse.json(genericResponse, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : error instanceof Error ? error.name : 'unknown'
    return reportFailure(stage, code)
  }
}
