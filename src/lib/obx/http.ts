import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { OBX_COOKIE, signSession, verifySession } from './session'
import { createObxAdminClient } from './supabase-admin'
import { isCurrentLegalConsent } from './legal-consent'
import { LEGAL_VERSION } from './legal-content'

export function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin')
  return !!origin && origin === new URL(request.url).origin
}

export async function getObxRoster() {
  const cookieStore = await cookies()
  const token = cookieStore.get(OBX_COOKIE)?.value
  const session = token ? verifySession(token) : null
  if (!session) return null
  cookieStore.set(OBX_COOKIE, signSession(session.rosterId), { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 8 * 60 * 60 })
  const admin = createObxAdminClient()
  const { data, error } = await admin.from('volunteer_roster').select('id, volunteer_number, full_name, is_founding').eq('id', session.rosterId).eq('status', 'active').maybeSingle()
  if (error || !data) return null
  return { admin, roster: data }
}

export async function hasCurrentLegalConsent(rosterId: string, admin = createObxAdminClient()) {
  const { data, error } = await admin.from('obx_legal_consents')
    .select('legal_version, privacy_accepted_at, mou_accepted_at')
    .eq('roster_id', rosterId)
    .maybeSingle()
  if (error) throw error
  return isCurrentLegalConsent(data, LEGAL_VERSION)
}

export function unavailable() {
  return NextResponse.json(
    { error: 'The passport is having a little trouble connecting. Please try again shortly.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  )
}

export function legalConsentRequired() {
  return NextResponse.json(
    { error: 'Please read and agree to the current Privacy Notice and Volunteer MOU before continuing.' },
    { status: 428, headers: { 'Cache-Control': 'no-store' } }
  )
}
