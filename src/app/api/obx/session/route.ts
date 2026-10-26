import { NextRequest, NextResponse } from 'next/server'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { OBX_COOKIE, OBX_PENDING_COOKIE, signSession, verifyPendingLookup } from '@/lib/obx/session'
import { hasCurrentLegalConsent, originAllowed, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'

const genericError = 'Your volunteer lookup expired. Please enter your roster details again.'

function expiredLookup(status = 401) {
  const response = NextResponse.json({ error: genericError }, { status, headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(OBX_PENDING_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 0 })
  return response
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return expiredLookup(403)

  const pendingToken = request.cookies.get(OBX_PENDING_COOKIE)?.value
  const pending = pendingToken ? verifyPendingLookup(pendingToken) : null
  if (!pending) return expiredLookup()

  try {
    const admin = createObxAdminClient()
    const { data: roster, error: rosterError } = await admin.from('volunteer_roster')
      .select('id, volunteer_number, hub_profile_id').eq('id', pending.rosterId).eq('status', 'active').maybeSingle()
    if (rosterError) throw rosterError
    if (!roster) return expiredLookup()

    const consentAccepted = await hasCurrentLegalConsent(roster.id, admin)
    let progressStatus: string | null = null
    if (consentAccepted) {
      const { data: currentProgress, error: readProgressError } = await admin.from('obx_progress')
        .select('cycle, status').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
      if (readProgressError) throw readProgressError
      if (!currentProgress) {
        const { error: insertProgressError } = await admin.from('obx_progress').insert({
          roster_id: roster.id, cycle: 1, course_version: OBX_CONFIG.courseVersion,
          status: 'in_progress', current_stop: 'meet_nk_udada',
        })
        if (insertProgressError && insertProgressError.code !== '23505') throw insertProgressError
      }
      const { data: latestProgress, error: latestProgressError } = await admin.from('obx_progress')
        .select('cycle, status').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
      if (latestProgressError || !latestProgress) throw latestProgressError || new Error('Progress record was not created.')
      progressStatus = latestProgress.status
      const { error: activityError } = await admin.from('activity_log').insert({
        user_id: null,
        action_type: 'obx.started',
        resource_type: 'volunteer_roster',
        resource_id: roster.id,
        details: { cycle: latestProgress.cycle, course_version: OBX_CONFIG.courseVersion, source: 'public_obx' },
      })
      if (activityError) console.error(`[OBX session] Activity logging failed (${activityError.code || 'unknown'})`)
    }

    const token = signSession(roster.id)
    const sessionResponse = NextResponse.json({ ok: true, volunteerNumber: roster.volunteer_number, progressStatus, consentRequired: !consentAccepted })
    sessionResponse.cookies.set(OBX_PENDING_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 0 })
    sessionResponse.cookies.set(OBX_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 8 * 60 * 60 })
    return sessionResponse
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : error instanceof Error ? error.name : 'unknown'
    console.error(`[OBX session] Volunteer session start failed (${code})`)
    return unavailable()
  }
}
