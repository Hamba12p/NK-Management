import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { originAllowed } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  const auth = await createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  try {
    const { rosterId } = await request.json()
    if (typeof rosterId !== 'string') return NextResponse.json({ error: 'Choose a volunteer to reset.' }, { status: 400 })
    const admin = createObxAdminClient()
    const { data: current, error: findError } = await admin.from('obx_progress').select('cycle').eq('roster_id', rosterId).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (findError) throw findError
    const cycle = (current?.cycle || 0) + 1
    const { error } = await admin.from('obx_progress').insert({ roster_id: rosterId, cycle, course_version: OBX_CONFIG.courseVersion, status: 'in_progress', current_stop: 'meet_nk_udada' })
    if (error) throw error
    await admin.from('activity_log').insert({ user_id: user.id, action_type: 'obx.progress_reset', resource_type: 'volunteer_roster', resource_id: rosterId, details: { cycle } })
    return NextResponse.json({ ok: true, cycle })
  } catch { return NextResponse.json({ error: 'The passport could not be reset.' }, { status: 503 }) }
}
