import { NextRequest, NextResponse } from 'next/server'
import { LEGAL_VERSION } from '@/lib/obx/legal-content'
import { makeLegalConsentRecord } from '@/lib/obx/legal-consent'
import { getObxRoster, originAllowed, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    const body: unknown = await request.json()
    if (
      typeof body !== 'object' || body === null
      || !('privacyAccepted' in body) || body.privacyAccepted !== true
      || !('mouAccepted' in body) || body.mouAccepted !== true
      || !('legalVersion' in body) || body.legalVersion !== LEGAL_VERSION
    ) {
      return NextResponse.json({ error: 'Read and accept both documents to continue.' }, { status: 400 })
    }

    const acceptedAt = new Date().toISOString()
    const record = makeLegalConsentRecord(session.roster.id, LEGAL_VERSION, true, true, acceptedAt)
    if (!record) return NextResponse.json({ error: 'Read and accept both documents to continue.' }, { status: 400 })
    const { error: consentError } = await session.admin.from('obx_legal_consents').upsert(record, { onConflict: 'roster_id' })
    if (consentError) {
      console.error(`[OBX consent] Consent recording failed (${consentError.code || 'unknown'})`)
      return unavailable()
    }

    const { data: currentProgress, error: progressReadError } = await session.admin.from('obx_progress')
      .select('cycle').eq('roster_id', session.roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (progressReadError) return unavailable()
    if (!currentProgress) {
      const { error: progressInsertError } = await session.admin.from('obx_progress').insert({
        roster_id: session.roster.id,
        cycle: 1,
        course_version: OBX_CONFIG.courseVersion,
        status: 'in_progress',
        current_stop: 'meet_nk_udada',
      })
      if (progressInsertError && progressInsertError.code !== '23505') return unavailable()
    }

    return NextResponse.json({ ok: true, legalVersion: LEGAL_VERSION, acceptedAt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return unavailable()
  }
}
