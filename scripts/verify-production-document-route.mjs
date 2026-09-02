import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const password = process.env.NK_SHARED_INITIAL_PASSWORD
const email = 'shabehamba@gmail.com'

if (!url || !publishableKey || !password) {
  throw new Error('Missing local verification environment variables')
}

let cookies = []
const supabase = createServerClient(url, publishableKey, {
  cookies: {
    getAll() {
      return cookies
    },
    setAll(updates) {
      const names = new Set(updates.map((cookie) => cookie.name))
      cookies = [...cookies.filter((cookie) => !names.has(cookie.name)), ...updates]
    },
  },
})

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) throw signInError

const cookieHeader = cookies
  .filter((cookie) => cookie.value)
  .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
  .join('; ')

const ids = [
  'c12061ad-623b-4286-83c0-8b454295cf28',
  '9683ca7f-cd93-428f-a960-3c462b5e3b56',
]

for (const id of ids) {
  const accessResponse = await fetch(`https://nk-management-pi.vercel.app/api/documents/${id}/access`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  })
  const result = await accessResponse.json().catch(() => null)
  const objectResponse = result?.signedUrl
    ? await fetch(result.signedUrl, { headers: { Range: 'bytes=0-31' } })
    : null

  console.log(JSON.stringify({
    documentId: id,
    accessStatus: accessResponse.status,
    signedUrlReturned: Boolean(result?.signedUrl),
    objectStatus: objectResponse?.status ?? null,
    error: result?.error ?? null,
  }))
}

await supabase.auth.signOut()
