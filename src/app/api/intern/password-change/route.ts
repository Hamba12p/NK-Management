import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { internAccessIsActive, internHasStarted, internPasswordChangeIsDue } from '@/lib/intern-access'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role, access_starts_on, access_expires_at, intern_access_enabled, must_change_password, password_change_required_on')
    .eq('id', user.id).single()
  if (profileError || profile?.role !== 'intern') return Response.json({ error: 'Intern account required' }, { status: 403 })
  if (!internHasStarted(profile.access_starts_on)) {
    return Response.json({ error: 'Your access has not started' }, { status: 403 })
  }
  if (!internAccessIsActive(profile.intern_access_enabled, profile.access_starts_on, profile.access_expires_at)) {
    return Response.json({ error: 'Your access has ended' }, { status: 403 })
  }
  if (!internPasswordChangeIsDue(profile.must_change_password, profile.password_change_required_on)) {
    return Response.json({ error: 'A password change is not required yet' }, { status: 409 })
  }

  let body: { password?: unknown }
  try { body = await request.json() as { password?: unknown } }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
    return Response.json({ error: 'Use a password between 12 and 128 characters' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ error: 'Password change is not configured' }, { status: 503 })
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password: body.password })
  if (passwordError) return Response.json({ error: 'Your password could not be changed' }, { status: 400 })
  const { error: profileUpdateError } = await admin.from('profiles')
    .update({ must_change_password: false, password_change_required_on: null }).eq('id', user.id)
  if (profileUpdateError) return Response.json({ error: 'Password changed, but account activation needs administrator support' }, { status: 500 })
  return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
