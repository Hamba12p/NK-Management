import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createObxAdminClient } from '@/lib/obx/supabase-admin'
import { hasTwoObxIdentifiers, normaliseObxContact, normaliseObxEmail } from '@/lib/obx/contact'
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

type RegisteredVolunteer = { id: string; full_name: string; volunteer_number: string; is_new: boolean }

function isRegisteredVolunteer(value: unknown): value is RegisteredVolunteer {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'string'
    && 'full_name' in value
    && typeof value.full_name === 'string'
    && 'volunteer_number' in value
    && typeof value.volunteer_number === 'string'
    && 'is_new' in value
    && typeof value.is_new === 'boolean'
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
    const { data, error } = await admin.from('volunteer_roster').select('id, volunteer_number, full_name, email, phone, status, is_founding, issued_at').order('volunteer_number')
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
      const header = rows.shift()?.map((item) => item.replace(/^\uFEFF/, '').trim().toLowerCase()) || []
      const numberIndex = header.indexOf('volunteer number')
      const nameIndex = header.indexOf('full name') >= 0 ? header.indexOf('full name') : header.indexOf('name')
      const emailIndex = header.indexOf('email')
      const phoneIndex = header.indexOf('phone')
      if (nameIndex < 0 && emailIndex < 0 && phoneIndex < 0) return NextResponse.json({ error: 'CSV must include at least two of Name, Email, and Phone columns.' }, { status: 400 })
      const admin = createObxAdminClient()
      const imported: Array<{ id: string; volunteer_number: string; full_name: string; email: string | null; phone: string | null; status: string; is_founding: boolean }> = []
      const errors: string[] = []
      for (const [offset, row] of rows.entries()) {
        const fullName = nameIndex >= 0 ? row[nameIndex]?.trim() || '' : ''
        const emailInput = emailIndex >= 0 ? row[emailIndex]?.trim() || '' : ''
        const email = emailInput ? normaliseObxEmail(emailInput) : null
        const rawPhone = phoneIndex >= 0 ? row[phoneIndex]?.trim() || '' : ''
        const phoneContact = rawPhone ? normaliseObxContact(rawPhone) : null
        const phone = phoneContact?.channel === 'phone' ? phoneContact.value : null
        const number = numberIndex >= 0 && row[numberIndex] ? normaliseNumber(row[numberIndex]) : null
        if (
          fullName.length > 160
          || (emailInput && !email)
          || (rawPhone && !phone)
          || !hasTwoObxIdentifiers(fullName, email, phone)
          || (row[numberIndex] && !number)
        ) { errors.push(`Row ${offset + 2}: enter any two valid fields among name, email and phone; check the volunteer number.`); continue }
        let assignedNumber = number
        if (!assignedNumber) {
          const { data, error } = await admin.rpc('register_obx_volunteer', {
            p_full_name: fullName || null,
            p_email: email,
            p_phone: phone,
            p_hub_profile_id: null,
            p_management: false,
            p_issued_by: actor.user.id,
          }).maybeSingle()
          if (error || !isRegisteredVolunteer(data) || !data.is_new) {
            errors.push(`Row ${offset + 2}: ${error?.code === '23505' || error?.code === 'P0002' || (isRegisteredVolunteer(data) && !data.is_new) ? 'duplicate email, phone or identity.' : 'could not be imported.'}`)
            continue
          }
          assignedNumber = data.volunteer_number
          imported.push({ id: data.id, volunteer_number: data.volunteer_number, full_name: data.full_name, email, phone, status: 'active', is_founding: false })
          continue
        }
        const { data, error } = await admin.from('volunteer_roster').insert({ volunteer_number: assignedNumber, full_name: fullName || 'OBX Volunteer', email, phone, issued_by: actor.user.id, status: 'active' }).select('id, volunteer_number, full_name, email, phone, status, is_founding').single()
        if (error) errors.push(`Row ${offset + 2}: ${error.code === '23505' ? 'duplicate number, email or phone.' : 'could not be imported.'}`)
        else imported.push(data)
      }
      return NextResponse.json({ imported, errors }, { status: errors.length ? 207 : 201 })
    }
    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const emailInput = typeof body.email === 'string' ? body.email.trim() : ''
    const email = emailInput ? normaliseObxEmail(emailInput) : null
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const phoneContact = rawPhone ? normaliseObxContact(rawPhone) : null
    const phone = phoneContact?.channel === 'phone' ? phoneContact.value : null
    const number = body.volunteerNumber ? normaliseNumber(body.volunteerNumber) : null
    if (
      fullName.length > 160
      || (emailInput && !email)
      || (rawPhone && !phone)
      || !hasTwoObxIdentifiers(fullName, email, phone)
      || (body.volunteerNumber && !number)
    ) return NextResponse.json({ error: 'Enter any two valid fields among name, email and phone, and check the volunteer number.' }, { status: 400 })
    const admin = createObxAdminClient()
    let assignedNumber = number
    if (!assignedNumber) {
      const { data, error } = await admin.rpc('register_obx_volunteer', {
        p_full_name: fullName || null,
        p_email: email,
        p_phone: phone,
        p_hub_profile_id: null,
        p_management: false,
        p_issued_by: actor.user.id,
      }).maybeSingle()
      if (error || !isRegisteredVolunteer(data) || !data.is_new) {
        const conflict = error?.code === '23505' || error?.code === 'P0002' || (isRegisteredVolunteer(data) && !data.is_new)
        return NextResponse.json({ error: conflict ? 'That email, phone or identity is already on the roster.' : 'A volunteer number could not be assigned. Please try again or contact the system administrator.' }, { status: conflict ? 409 : 503 })
      }
      assignedNumber = data.volunteer_number
      const { error: activityError } = await admin.from('activity_log').insert({ user_id: actor.user.id, action_type: 'obx.roster_added', resource_type: 'volunteer_roster', resource_id: data.id, details: {} })
      if (activityError) console.error(`[OBX roster] Activity logging failed (${activityError.code || 'unknown'})`)
      return NextResponse.json({
        volunteer: {
          id: data.id,
          volunteer_number: data.volunteer_number,
          full_name: data.full_name,
          email,
          phone,
          status: 'active',
          is_founding: false,
        },
      }, { status: 201 })
    }
    const { data, error } = await admin.from('volunteer_roster').insert({ volunteer_number: assignedNumber, full_name: fullName || 'OBX Volunteer', email, phone, issued_by: actor.user.id, status: 'active' }).select('id, volunteer_number, full_name, email, phone, status, is_founding').single()
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'That volunteer number, email or phone is already on the roster.' : 'The volunteer could not be added.' }, { status: error.code === '23505' ? 409 : 503 })
    const { error: activityError } = await admin.from('activity_log').insert({ user_id: actor.user.id, action_type: 'obx.roster_added', resource_type: 'volunteer_roster', resource_id: data.id, details: {} })
    if (activityError) console.error(`[OBX roster] Activity logging failed (${activityError.code || 'unknown'})`)
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
    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      updates.email = email
    }
    if (typeof body.phone === 'string') {
      const phone = body.phone.trim() ? normaliseObxContact(body.phone) : null
      if (body.phone.trim() && phone?.channel !== 'phone') return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
      if (phone?.channel !== 'phone') return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
      updates.phone = phone.value
    }
    if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) updates.status = body.status
    if (typeof body.isFounding === 'boolean') updates.is_founding = body.isFounding
    if (!id || !Object.keys(updates).length) return NextResponse.json({ error: 'No valid roster changes were provided.' }, { status: 400 })
    const { data, error } = await admin.from('volunteer_roster').update(updates).eq('id', id).select('id, status, is_founding').single()
    if (error) return NextResponse.json({ error: 'The roster entry could not be updated.' }, { status: 503 })
    if (updates.status === 'inactive') await admin.from('activity_log').insert({ user_id: actor.user.id, action_type: 'obx.roster_deactivated', resource_type: 'volunteer_roster', resource_id: id, details: {} })
    return NextResponse.json({ volunteer: data })
  } catch { return NextResponse.json({ error: 'Roster service is currently unavailable.' }, { status: 503 }) }
}
