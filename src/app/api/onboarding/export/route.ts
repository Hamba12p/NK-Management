import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export async function GET() {
  const auth = await createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'dpo'].includes(profile.role)) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })

  const [rosterResult, progressResult] = await Promise.all([
    auth.from('volunteer_roster').select('id, volunteer_number, full_name, email, phone, status, is_founding'),
    auth.from('obx_progress').select('roster_id, cycle, status, overall_score, last_active_at, completed_at').order('cycle', { ascending: false }),
  ])
  if (rosterResult.error || progressResult.error) return NextResponse.json({ error: 'Onboarding data is currently unavailable.' }, { status: 503 })
  const latest = new Map<string, NonNullable<typeof progressResult.data>[number]>()
  for (const item of progressResult.data || []) if (!latest.has(item.roster_id)) latest.set(item.roster_id, item)
  const header = ['Volunteer number', 'Name', 'Email', 'Phone', 'Roster status', 'Founding volunteer', 'Onboarding status', 'Score', 'Last active', 'Completed on']
  const rows = (rosterResult.data || []).map((person) => {
    const progress = latest.get(person.id)
    return [person.volunteer_number, person.full_name, person.email, person.phone || '', person.status, person.is_founding ? 'Yes' : 'No', progress?.status || 'not_started', progress?.overall_score ?? '', progress?.last_active_at || '', progress?.completed_at || '']
  })
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new NextResponse(`\uFEFF${body}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="obx-onboarding.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
