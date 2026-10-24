import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { OBX_COOKIE, signSession } from '@/lib/obx/session'
import { originAllowed, unavailable } from '@/lib/obx/http'
import { OBX_CONFIG } from '@/content/obx/config'

const genericError = 'We could not verify this volunteer contact. Please request a new link or code.'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: genericError }, { status: 403 })

  const auth = await createServerSupabaseClient()
  try {
    const { data: { user } } = await auth.auth.getUser()
    const email = user?.email_confirmed_at ? user.email?.trim().toLowerCase() : null
    const phone = user?.phone_confirmed_at ? user.phone : null
    if (!user || (!email && !phone)) {
      await auth.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    const admin = createObxAdminClient()
    let roster: { id: string; volunteer_number: string } | null = null
    if (email) {
      const { data, error } = await admin.from('volunteer_roster')
        .select('id, volunteer_number').eq('email', email).eq('status', 'active').maybeSingle()
      if (error) throw error
      roster = data
    }
    if (!roster && phone) {
      const { data, error } = await admin.from('volunteer_roster')
        .select('id, volunteer_number').eq('phone', phone).eq('status', 'active').maybeSingle()
      if (error) throw error
      roster = data
    }
    if (!roster) {
      await auth.auth.signOut({ scope: 'local' })
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    const { data: currentProgress, error: readProgressError } = await admin.from('obx_progress')
      .select('cycle').eq('roster_id', roster.id).order('cycle', { ascending: false }).limit(1).maybeSingle()
    if (readProgressError) throw readProgressError
    if (!currentProgress) {
      const { error } = await admin.from('obx_progress').insert({
        roster_id: roster.id, cycle: 1, course_version: OBX_CONFIG.courseVersion,
        status: 'in_progress', current_stop: 'meet_nk_udada',
      })
      if (error) throw error
    }

    const token = signSession(roster.id)
    await auth.auth.signOut({ scope: 'local' })
    const response = NextResponse.json({ ok: true, volunteerNumber: roster.volunteer_number })
    response.cookies.set(OBX_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 8 * 60 * 60 })
    return response
  } catch {
    await auth.auth.signOut({ scope: 'local' })
    return unavailable()
  }
}
