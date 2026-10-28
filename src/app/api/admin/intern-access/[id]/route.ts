import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role').eq('id', user.id).single()
  if (profileError) {
    console.error('Intern access admin-role lookup failed:', profileError)
    return Response.json({ error: 'Unable to verify administrator access' }, { status: 500 })
  }
  if (profile.role !== 'admin') return Response.json({ error: 'Administrator access required' }, { status: 403 })

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'Invalid intern profile' }, { status: 400 })
  }

  let body: { enabled?: unknown }
  try {
    body = await request.json() as { enabled?: unknown }
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'An enabled value is required' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ error: 'Intern access controls are not configured' }, { status: 503 })

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: updated, error: updateError } = await admin.from('profiles')
    .update({ intern_access_enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq('id', id).eq('role', 'intern').select('id, intern_access_enabled').maybeSingle()
  if (updateError) {
    console.error('Intern access toggle failed:', updateError)
    return Response.json({ error: 'Intern access could not be updated' }, { status: 500 })
  }
  if (!updated) return Response.json({ error: 'Intern profile not found' }, { status: 404 })

  return Response.json(
    { enabled: updated.intern_access_enabled },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
