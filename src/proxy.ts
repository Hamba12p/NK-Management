// Next.js proxy (formerly "middleware.ts", renamed per Next.js 16 convention)
// Refreshes the Supabase session on every request and redirects based on auth state
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  // Start from a response tied to the incoming request so cookie reads
  // inside getAll() stay in sync with what we write in setAll() below.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Mirror the refreshed cookies onto the request (so any code later
          // in this same middleware sees them) and onto a fresh response
          // (so the browser actually receives them).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() revalidates the session against Supabase Auth on
  // every request — don't swap this for getSession(), which only reads the
  // (possibly stale/tampered) local cookie.
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Redirect root/dashboard to login if not authenticated
  if ((pathname === '/' || pathname.startsWith('/dashboard')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from login page to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect authenticated users from root to dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes - optional, can be handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
