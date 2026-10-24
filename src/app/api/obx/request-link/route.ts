import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Verification messages are disabled. Enter your rostered email and phone on the passport page.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  )
}
