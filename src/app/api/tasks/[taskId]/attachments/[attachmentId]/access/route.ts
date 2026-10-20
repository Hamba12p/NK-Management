import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string; attachmentId: string }> }
) {
  const { taskId, attachmentId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from('task_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .eq('task_id', taskId)
    .maybeSingle()

  if (attachmentError) {
    console.error('Task attachment access lookup failed:', attachmentError)
    return Response.json({ error: 'Unable to verify task attachment access' }, { status: 500 })
  }

  if (!attachment) {
    return Response.json({ error: 'Task attachment not found' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Task attachment route is missing its server-side Supabase configuration')
    return Response.json({ error: 'Task attachment access is not configured' }, { status: 503 })
  }

  const storageAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error: storageError } = await storageAdmin.storage
    .from('documents')
    .createSignedUrl(attachment.file_path, 900)

  if (storageError || !data?.signedUrl) {
    console.error('Task attachment signed URL creation failed:', {
      attachmentId,
      message: storageError?.message,
    })
    return Response.json({ error: 'The uploaded file could not be found' }, { status: 404 })
  }

  return Response.redirect(data.signedUrl, 303)
}
