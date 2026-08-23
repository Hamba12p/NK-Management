import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id,name,file_path,mime_type')
    .eq('id', id)
    .maybeSingle()

  if (documentError) {
    console.error('Document access lookup failed:', documentError)
    return Response.json({ error: 'Unable to verify document access' }, { status: 500 })
  }

  if (!document) {
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
