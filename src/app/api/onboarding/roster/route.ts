import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { originAllowed } from '@/lib/obx/http'

async function authorised(allowed: string[]) {
  const auth = await createServerSupabaseClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).single()
  return profile && allowed.includes(profile.role) ? { user, role: profile.role } : null
}

function normaliseNumber(value: unknown) {
  if (typeof value !== 'string') return null
  const digits = value.toUpperCase().replace(/^NKV[-\s]?/, '').trim()
  if (!/^\d{3,4}$/.test(digits)) return null
  return `NKV-${digits}`
}

function parseCsv(text: string) {
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const cells: string[] = []
    let cell = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      if (character === '"') quoted = !quoted
      else if (character === ',' && !quoted) { cells.push(cell.trim()); cell = '' }
      else cell += character
    }
    cells.push(cell.trim())
    return cells.map((value) => value.replace(/^"|"$/g, '').replaceAll('""', '"'))
  })
}

export async function GET() {
  const actor = await authorised(['admin', 'manager', 'dpo'])
  if (!actor) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  try {
    const admin = createObxAdminClient()
    const { data, error } = await admin.from('volunteer_roster').select('id, volunteer_number, full_name, email, status, is_founding, issued_at').order('volunteer_number')
    if (error) throw error
    return NextResponse.json({ roster: data })
  } catch { return NextResponse.json({ error: 'Roster data is currently unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  const actor = await authorised(['admin', 'manager'])
  if (!actor) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  try {
    if (request.headers.get('content-type')?.includes('text/csv')) {
      const rows = parseCsv(await request.text())
      const header = rows.shift()?.map((item) => item.toLowerCase()) || []
      const numberIndex = header.indexOf('volunteer number')
      const nameIndex = header.indexOf('full name')
      const emailIndex = header.indexOf('email')
      if (nameIndex < 0 || emailIndex < 0) return NextResponse.json({ error: 'CSV must include Full name and Email columns.' }, { status: 400 })
      const admin = createObxAdminClient()
      const imported: Array<{ id: string; volunteer_number: string; full_name: string; email: string; status: string; is_founding: boolean }> = []
      const errors: string[] = []
      for (const [offset, row] of rows.entries()) {
        const fullName = row[nameIndex]?.trim() || ''
        const email = row[emailIndex]?.trim().toLowerCase() || ''
        const number = numberIndex >= 0 && row[numberIndex] ? normaliseNumber(row[numberIndex]) : null
        if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (row[numberIndex] && !number)) { errors.push(`Row ${offset + 2}: check the name, email and volunteer number.`); continue }
        let assignedNumber = number
        if (!assignedNumber) {
          const { data } = await admin.from('volunteer_roster').select('volunteer_number')
          const max = (data || []).reduce((highest, item) => Math.max(highest, Number(item.volunteer_number.slice(4))), 0)
          assignedNumber = `NKV-${String(max + 1 + imported.length).padStart(3, '0')}`
        }
        const { data, error } = await admin.from('volunteer_roster').insert({ volunteer_number: assignedNumber, full_name: fullName, email, issued_by: actor.user.id, status: 'active' }).select('id, volunteer_number, full_name, email, status, is_founding').single()
        if (error) errors.push(`Row ${offset + 2}: ${error.code === '23505' ? 'duplicate number or email.' : 'could not be imported.'}`)
        else imported.push(data)
      }
      return NextResponse.json({ imported, errors }, { status: errors.length ? 207 : 201 })
    }
    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const number = body.volunteerNumber ? normaliseNumber(body.volunteerNumber) : null
    if (fullName.length < 2 || fullName.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (body.volunteerNumber && !number)) return NextResponse.json({ error: 'Check the name, email and volunteer number.' }, { status: 400 })
    const admin = createObxAdminClient()
    let assignedNumber = number
    if (!assignedNumber) {
      const { data, error } = await admin.from('volunteer_roster').select('volunteer_number')
      if (error) throw error
      const max = (data || []).reduce((highest, row) => Math.max(highest, Number(row.volunteer_number.slice(4))), 0)
      if (max >= 9999) return NextResponse.json({ error: 'No volunteer numbers remain. Please contact the system administrator.' }, { status: 409 })
      assignedNumber = `NKV-${String(max + 1).padStart(3, '0')}`
    }
    const { data, error } = await admin.from('volunteer_roster').insert({ volunteer_number: assignedNumber, full_name: fullName, email, issued_by: actor.user.id, status: 'active' }).select('id, volunteer_number, full_name, email, status, is_founding').single()
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'That volunteer number or email is already on the roster.' : 'The volunteer could not be added.' }, { status: error.code === '23505' ? 409 : 503 })
    await admin.from('activity_log').insert({ user_id: actor.user.id, action_type: 'obx.roster_added', resource_type: 'volunteer_roster', resource_id: data.id, details: {} })
    return NextResponse.json({ volunteer: data }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Roster service is currently unavailable.' }, { status: 503 }) }
}

export async function PATCH(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  const actor = await authorised(['admin', 'manager'])
  if (!actor) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const admin = createObxAdminClient()
    const updates: Record<string, unknown> = {}
    if (typeof body.fullName === 'string' && body.fullName.trim().length >= 2 && body.fullName.trim().length <= 160) updates.full_name = body.fullName.trim()
    if (typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) updates.email = body.email.trim().toLowerCase()
    if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) updates.status = body.status
    if (typeof body.isFounding === 'boolean') updates.is_founding = body.isFounding
    if (!id || !Object.keys(updates).length) return NextResponse.json({ error: 'No valid roster changes were provided.' }, { status: 400 })
    const { data, error } = await admin.from('volunteer_roster').update(updates).eq('id', id).select('id, status, is_founding').single()
    if (error) return NextResponse.json({ error: 'The roster entry could not be updated.' }, { status: 503 })
    if (updates.status === 'inactive') await admin.from('activity_log').insert({ user_id: actor.user.id, action_type: 'obx.roster_deactivated', resource_type: 'volunteer_roster', resource_id: id, details: {} })
    return NextResponse.json({ volunteer: data })
  } catch { return NextResponse.json({ error: 'Roster service is currently unavailable.' }, { status: 503 }) }
}
