import { NextRequest, NextResponse } from 'next/server'
import { getObxRoster, hasCurrentLegalConsent, legalConsentRequired, originAllowed, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'
import { obxStops } from '@/content/obx/en/stops'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    if (!await hasCurrentLegalConsent(session.roster.id, session.admin)) return legalConsentRequired()
    const body = await request.json()
    if (body.agree !== true || typeof body.typedName !== 'string' || body.typedName.trim().length < 2 || body.typedName.trim().length > 160) return NextResponse.json({ error: 'Please confirm the agreement and enter your full name.' }, { status: 400 })
    const { data: progress, error } = await session.admin.from('obx_progress').select('cycle, status').eq('roster_id', session.roster.id).order('cycle', { ascending: false }).limit(1).single()
    if (error || !progress) return unavailable()
    const { data: results, error: resultsError } = await session.admin.from('obx_stop_results').select('stop_key, passed, first_try_score').eq('roster_id', session.roster.id).eq('cycle', progress.cycle)
    if (resultsError) return unavailable()
    if (!obxStops.slice(0, 5).every((stop) => results?.some((result) => result.stop_key === stop.id && result.passed)) || !results?.some((result) => result.stop_key === 'keeping_children_safe' && result.passed)) return NextResponse.json({ error: 'Complete the first five stops, including the safeguarding pass, before signing.' }, { status: 409 })
    const now = new Date().toISOString()
    const { error: finalStopError } = await session.admin.from('obx_stop_results').upsert({ roster_id: session.roster.id, cycle: progress.cycle, stop_key: 'sign_and_celebrate', attempts: 1, passed: true, completed_at: now }, { onConflict: 'roster_id,cycle,stop_key' })
    if (finalStopError) return unavailable()
    const scores = (results || []).filter((item) => ['meet_nk_udada', 'our_promise', 'keeping_children_safe', 'data_and_privacy'].includes(item.stop_key)).map((item) => Number(item.first_try_score || 0))
    const overallScore = scores.length ? Math.round((scores.reduce((sum, item) => sum + item, 0) / scores.length) * 100) / 100 : 0
    const { error: saveError } = await session.admin.from('obx_progress').update({ status: 'completed', completed_at: now, overall_score: overallScore, mou_typed_name: body.typedName.trim(), mou_accepted_at: now, mou_version: OBX_CONFIG.mouVersion, last_active_at: now }).eq('roster_id', session.roster.id).eq('cycle', progress.cycle)
    if (saveError) return unavailable()
    const { error: rosterNameError } = await session.admin.from('volunteer_roster').update({ full_name: body.typedName.trim() }).eq('id', session.roster.id)
    if (rosterNameError) return unavailable()
    const { data: linkedRoster, error: linkedRosterError } = await session.admin.from('volunteer_roster')
      .select('hub_profile_id')
      .eq('id', session.roster.id)
      .single()
    if (linkedRosterError) return unavailable()
    const { error: activityError } = await session.admin.from('activity_log').insert({ user_id: linkedRoster.hub_profile_id, action_type: 'obx.completed', resource_type: 'volunteer_roster', resource_id: session.roster.id, details: { cycle: progress.cycle, course_version: OBX_CONFIG.courseVersion, completed_at: now } })
    if (activityError) console.error(`[OBX completion] Activity logging failed (${activityError.code || 'unknown'})`)
    return NextResponse.json({ ok: true, badge: { fullName: session.roster.full_name, typedName: body.typedName.trim(), volunteerNumber: session.roster.volunteer_number, isFounding: session.roster.is_founding, completedAt: now } })
  } catch { return unavailable() }
}
