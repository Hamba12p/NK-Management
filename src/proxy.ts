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
  const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  if ((pathname === '/' || isDashboardPath) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let profile: { role: string; access_expires_at: string | null; must_change_password: boolean } | null = null
  if (user && (isDashboardPath || pathname === '/change-password')) {
    const { data } = await supabase
      .from('profiles')
      .select('role, access_expires_at, must_change_password')
      .eq('id', user.id)
      .single()
    profile = data
  }

  if (user && profile?.role === 'intern') {
    if (!profile.access_expires_at || Date.parse(profile.access_expires_at) <= Date.now()) {
      await supabase.auth.signOut()
      const ended = NextResponse.redirect(new URL('/access-ended', request.url))
      response.cookies.getAll().forEach(cookie => ended.cookies.set(cookie.name, cookie.value, cookie))
      return ended
    }
    if (profile.must_change_password && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }
    if (!profile.must_change_password && pathname === '/change-password') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (isDashboardPath) {
      const internPaths = ['/dashboard', '/dashboard/documents', '/dashboard/workspace', '/dashboard/meetings', '/dashboard/announcements', '/dashboard/settings', '/dashboard/feedback']
      const teamEnabled = process.env.INTERN_TEAM_DIRECTORY_ENABLED === 'true'
      const allowed = internPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))
        || (teamEnabled && (pathname === '/dashboard/team' || pathname.startsWith('/dashboard/team/')))
      if (!allowed) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect authenticated users away from login page to dashboard
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect authenticated users from root to dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const protectedRoles = (() => {
    if (pathname === '/dashboard/me' || pathname.startsWith('/dashboard/me/')) return ['admin', 'board_advisor']
    if (pathname === '/dashboard/advanced' || pathname === '/dashboard/analytics') return ['admin']
    if (pathname === '/dashboard/activity-log' || pathname.startsWith('/dashboard/dpo/')) return ['admin', 'dpo']
    if (pathname === '/dashboard/volunteers') return ['admin', 'manager']
    if (pathname === '/dashboard/classes' || pathname.startsWith('/dashboard/classes/')) {
      return ['admin', 'manager', 'volunteer', 'volunteer_senior', 'volunteer_lead']
    }
    if (pathname === '/dashboard/learners') return ['admin', 'manager', 'dpo']
    if (pathname === '/dashboard/hub') {
      return ['admin', 'manager', 'volunteer', 'volunteer_senior', 'volunteer_lead']
    }
    if (pathname === '/dashboard/volunteer-profile' || pathname === '/dashboard/volunteer-hours') {
      return ['volunteer', 'volunteer_senior', 'volunteer_lead']
    }
    return null
  })()

  if (user && protectedRoles) {
    const { data: roleProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!roleProfile || !protectedRoles.includes(roleProfile.role)) {
      return NextResponse.redirect(new URL('/dashboard?access=denied', request.url))
    }
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
