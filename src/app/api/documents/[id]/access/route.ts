import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { internHasStarted } from '@/lib/intern-access'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, access_starts_on, access_expires_at, must_change_password')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    return Response.json({ error: 'Unable to verify account access' }, { status: 403 })
  }
  if (profile.role === 'intern' && !internHasStarted(profile.access_starts_on)) {
    return Response.json({ error: 'Your access has not started' }, { status: 403 })
  }
  if (profile.role === 'intern' && (!profile.access_expires_at || Date.parse(profile.access_expires_at) <= Date.now())) {
    return Response.json({ error: 'Your access has ended' }, { status: 403 })
  }
  if (profile.role === 'intern' && profile.must_change_password) {
    return Response.json({ error: 'Change your password before accessing documents' }, { status: 403 })
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id,name,file_path,mime_type,uploaded_by,intern_visible,visibility,assigned_to,deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (documentError) {
    console.error('Document access lookup failed:', documentError)
    return Response.json({ error: 'Unable to verify document access' }, { status: 500 })
  }

  if (!document) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }
  if (profile.role === 'intern') {
    const ownUpload = document.uploaded_by === user.id && document.file_path.startsWith(`interns/${user.id}/`)
    const flaggedDocument = document.intern_visible && document.visibility === 'standard' && document.deleted_at === null
    const assignedToUser = Array.isArray(document.assigned_to) && document.assigned_to.includes(user.id)
    if (!ownUpload && !flaggedDocument && !assignedToUser) {
      return Response.json({ error: 'Document not found' }, { status: 404 })
    }
  }

  if (
    Array.isArray(document.assigned_to)
    && document.assigned_to.length > 0
    && !document.assigned_to.includes(user.id)
    && document.uploaded_by !== user.id
    && !['admin', 'board_advisor'].includes(profile.role)
  ) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Document access route is missing its server-side Supabase configuration')
    return Response.json({ error: 'Document preview is not configured' }, { status: 503 })
  }

  const storageAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error: storageError } = await storageAdmin.storage
    .from('documents')
    .createSignedUrl(document.file_path, 900)

  if (storageError || !data?.signedUrl) {
    console.error('Document signed URL creation failed:', {
      documentId: document.id,
      message: storageError?.message,
    })
    return Response.json({ error: 'The uploaded file could not be found' }, { status: 404 })
  }

  return Response.json(
    {
      signedUrl: data.signedUrl,
      name: document.name,
      mimeType: document.mime_type,
      expiresIn: 900,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
