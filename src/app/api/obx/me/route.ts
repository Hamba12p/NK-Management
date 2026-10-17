import { NextResponse } from 'next/server'
import { getObxRoster, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'

export async function GET() {
  try {
    const session = await getObxRoster()
    if (!session) return NextResponse.json({ error: 'Please sign in again to continue your passport.' }, { status: 401 })
    const { admin, roster } = session
    const { data: progress, error } = await admin.from('obx_progress').select('*').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (error || !progress) return unavailable()
    const { data: results, error: resultError } = await admin.from('obx_stop_results').select('stop_key, attempts, first_try_score, best_score, passed, completed_at').eq('roster_id', roster.id).eq('cycle', progress.cycle)
    if (resultError) return unavailable()
    return NextResponse.json({ roster, progress, results: results || [], courseVersion: OBX_CONFIG.courseVersion })
  } catch {
    return unavailable()
  }
}
