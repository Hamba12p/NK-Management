export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return Response.json({ error: 'Push notifications are not configured' }, { status: 503 })
  }
  return Response.json(
    { publicKey },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
