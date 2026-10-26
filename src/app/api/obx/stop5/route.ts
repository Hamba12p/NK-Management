import { NextRequest, NextResponse } from 'next/server'
import { getObxRoster, hasCurrentLegalConsent, legalConsentRequired, originAllowed, unavailable } from '@/lib/obx/http'

const roles = ['Community Facilitator', 'Curriculum and Training Lead', 'Communities and Impact Volunteer', 'Monitoring and Evaluation Officer', 'Not sure yet']

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    if (!await hasCurrentLegalConsent(session.roster.id, session.admin)) return legalConsentRequired()
    const body = await request.json()
    if (!Array.isArray(body.roleInterest) || body.roleInterest.some((role: unknown) => typeof role !== 'string' || !roles.includes(role))) return NextResponse.json({ error: 'Choose a role from the list.' }, { status: 400 })
    if (typeof body.hopeText !== 'string' || body.hopeText.length > 140 || !Array.isArray(body.firstWeekChecklist)) return NextResponse.json({ error: 'Please check your answers and try again.' }, { status: 400 })
    const { data: progress, error: findError } = await session.admin.from('obx_progress').select('cycle, current_stop').eq('roster_id', session.roster.id).order('cycle', { ascending: false }).limit(1).single()
    if (findError || !progress) return unavailable()
    if (progress.current_stop !== 'how_we_work') return NextResponse.json({ error: 'Pick up at your current stop to continue.' }, { status: 409 })
    const { error } = await session.admin.from('obx_progress').update({ role_interest: body.roleInterest, hope_text: body.hopeText.trim(), first_week_checklist: body.firstWeekChecklist, last_active_at: new Date().toISOString() }).eq('roster_id', session.roster.id).eq('cycle', progress.cycle)
    return error ? unavailable() : NextResponse.json({ ok: true })
  } catch { return unavailable() }
}
