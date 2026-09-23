import { createClient } from '@supabase/supabase-js'

type BoardLoginBody = {
  email?: unknown
  password?: unknown
}

export async function POST(request: Request) {
  let body: BoardLoginBody
  try {
    body = await request.json() as BoardLoginBody
  } catch {
    return Response.json({ error: 'Invalid login request' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const masterAdminEmail = process.env.NK_MASTER_ADMIN_EMAIL?.trim().toLowerCase()
  const boardEmail = process.env.NK_ME_BOARD_EMAIL?.trim().toLowerCase()
  const boardPassword = process.env.NK_ME_BOARD_PASSWORD

  if (!masterAdminEmail || !boardEmail || !boardPassword) {
    console.error('Board login route is missing its server-side credential configuration')
    return Response.json({ error: 'Board login is not configured' }, { status: 503 })
  }

  if (email !== masterAdminEmail || password !== boardPassword) {
    return Response.json({ error: 'Email or password is incorrect' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    console.error('Board login route is missing its Supabase configuration')
    return Response.json({ error: 'Board login is not configured' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({
    email: boardEmail,
    password: boardPassword,
  })

  if (error || !data.session) {
    console.error('Board account sign-in failed:', error?.message)
    return Response.json({ error: 'Board login is unavailable' }, { status: 503 })
  }

  return Response.json({ session: data.session }, { headers: { 'Cache-Control': 'no-store' } })
}
