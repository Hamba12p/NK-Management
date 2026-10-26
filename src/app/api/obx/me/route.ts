import { NextResponse } from 'next/server'
import { getObxRoster, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'
import { LEGAL_VERSION } from '@/lib/obx/legal-content'
import { isCurrentLegalConsent } from '@/lib/obx/legal-consent'

export async function GET() {
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    const { admin, roster } = session
    const { data: progress, error } = await admin.from('obx_progress').select('*').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (error) return unavailable()
    const { data: consent, error: consentError } = await admin.from('obx_legal_consents')
      .select('privacy_accepted_at, mou_accepted_at, legal_version')
      .eq('roster_id', roster.id).maybeSingle()
    if (consentError) return unavailable()
    if (!progress) return NextResponse.json({
      roster, progress: null, results: [], courseVersion: OBX_CONFIG.courseVersion,
      legalConsent: { ...consent, current: isCurrentLegalConsent(consent, LEGAL_VERSION), requiredVersion: LEGAL_VERSION },
    }, { headers: { 'Cache-Control': 'no-store' } })
    const { data: results, error: resultError } = await admin.from('obx_stop_results').select('stop_key, attempts, first_try_score, best_score, passed, completed_at').eq('roster_id', roster.id).eq('cycle', progress.cycle)
    if (resultError) return unavailable()
    return NextResponse.json({
      roster, progress, results: results || [], courseVersion: OBX_CONFIG.courseVersion,
      legalConsent: { ...consent, current: isCurrentLegalConsent(consent, LEGAL_VERSION), requiredVersion: LEGAL_VERSION },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return unavailable()
  }
}
