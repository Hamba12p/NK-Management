import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { OBX_CONFIG } from '@/content/obx/config'
import { OBX_COOKIE, signSession } from '@/lib/obx/session'
import { hasCurrentLegalConsent, originAllowed, unavailable } from '@/lib/obx/http'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { internAccessIsActive } from '@/lib/intern-access'

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

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })

  try {
    const auth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in to your StaffHub account to continue.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await auth.from('profiles')
      .select('full_name, email, role, access_starts_on, access_expires_at, intern_access_enabled')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      console.error(`[OBX StaffHub session] Profile lookup failed (${profileError.code || 'unknown'})`)
      return unavailable()
    }
    const allowedRoles = ['admin', 'manager', 'dpo', 'volunteer', 'volunteer_senior', 'volunteer_lead', 'board_advisor', 'intern']
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'This StaffHub account cannot start an OBX passport.' }, { status: 403 })
    }
    if (profile.role === 'intern' && !internAccessIsActive(
      profile.intern_access_enabled,
      profile.access_starts_on,
      profile.access_expires_at,
    )) {
      return NextResponse.json({ error: 'Your StaffHub access has ended. Contact an administrator if you need help.' }, { status: 403 })
    }

    const email = (profile.email || user.email || '').trim().toLowerCase()
    if (!email || !profile.full_name.trim()) {
      return NextResponse.json({ error: 'Your StaffHub profile needs a name and email before OBX can be started.' }, { status: 409 })
    }

    const admin = createObxAdminClient()
    const isManagement = ['admin', 'manager', 'dpo', 'board_advisor'].includes(profile.role)
    const { data: linkedRoster, error: linkedRosterError } = await admin.from('volunteer_roster')
      .select('id, full_name, volunteer_number')
      .eq('hub_profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (linkedRosterError) {
      console.error(`[OBX StaffHub session] Linked roster lookup failed (${linkedRosterError.code || 'unknown'})`)
      return unavailable()
    }
    let registered: RegisteredVolunteer | null = linkedRoster
      ? { ...linkedRoster, is_new: false }
      : null
    if (!registered) {
      const { data, error: registrationError } = await admin.rpc('register_obx_volunteer', {
        p_full_name: profile.full_name,
        p_email: email,
        p_phone: null,
        p_hub_profile_id: user.id,
        p_management: isManagement,
        p_issued_by: null,
      }).maybeSingle()
      if (registrationError) {
        console.error(`[OBX StaffHub session] Roster registration failed (${registrationError.code || 'unknown'})`)
        return unavailable()
      }
      if (isRegisteredVolunteer(data)) registered = data
    }
    if (!isRegisteredVolunteer(registered)) return unavailable()

    const consentAccepted = await hasCurrentLegalConsent(registered.id, admin)
    let progressStatus: string | null = null
    if (consentAccepted) {
      const { data: existingProgress, error: progressReadError } = await admin.from('obx_progress')
        .select('cycle, status').eq('roster_id', registered.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
      if (progressReadError) return unavailable()
      if (!existingProgress) {
        const { error: progressInsertError } = await admin.from('obx_progress').insert({
          roster_id: registered.id, cycle: 1, course_version: OBX_CONFIG.courseVersion,
          status: 'in_progress', current_stop: 'meet_nk_udada',
        })
        if (progressInsertError && progressInsertError.code !== '23505') return unavailable()
      }
      const { data: progress, error: latestProgressError } = await admin.from('obx_progress')
        .select('cycle, status').eq('roster_id', registered.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
      if (latestProgressError || !progress) return unavailable()
      progressStatus = progress.status
      const { error: activityError } = await admin.from('activity_log').insert({
        user_id: user.id, action_type: 'obx.started', resource_type: 'volunteer_roster',
        resource_id: registered.id,
        details: { cycle: progress.cycle, course_version: OBX_CONFIG.courseVersion, source: 'staffhub' },
      })
      if (activityError) console.error(`[OBX StaffHub session] Activity logging failed (${activityError.code || 'unknown'})`)
    }

    const response = NextResponse.json({
      ok: true,
      volunteerNumber: registered.volunteer_number,
      progressStatus,
      consentRequired: !consentAccepted,
    }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(OBX_COOKIE, signSession(registered.id), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/obx',
      maxAge: 8 * 60 * 60,
    })
    return response
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : error instanceof Error ? error.name : 'unknown'
    console.error(`[OBX StaffHub session] Session start failed (${code})`)
    return unavailable()
  }
}
