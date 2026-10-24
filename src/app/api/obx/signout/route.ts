import { NextRequest, NextResponse } from 'next/server'
import { OBX_COOKIE, OBX_PENDING_COOKIE } from '@/lib/obx/session'
import { originAllowed } from '@/lib/obx/http'

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 403 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(OBX_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 0 })
  response.cookies.set(OBX_PENDING_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/obx', maxAge: 0 })
  return response
}
