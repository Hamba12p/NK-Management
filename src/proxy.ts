// Next.js proxy (formerly "middleware.ts", renamed per Next.js 16 convention)
// Refreshes the Supabase session on every request and redirects based on auth state
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { internAccessIsActive, internHasStarted, internPasswordChangeIsDue } from '@/lib/intern-access'
import { canVolunteerAccessApi, isObxOnlyVolunteerRole } from '@/lib/staffhub-access'
import { createNotificationAdminClient } from '@/lib/notifications/server'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  const isApiPath = pathname.startsWith('/api/')
  // The volunteer passport uses its own signed cookie and has no hub login.
  if (pathname === '/obx' || pathname.startsWith('/obx/')) {
    return NextResponse.next()
  }
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

  if ((pathname === '/' || isDashboardPath) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let profile: {
    role: string
    email: string | null
    access_starts_on: string | null
    access_expires_at: string | null
    intern_access_enabled: boolean
    must_change_password: boolean
    password_change_required_on: string | null
  } | null = null
  if (user && (isDashboardPath || pathname === '/change-password' || isApiPath || pathname === '/' || pathname === '/login')) {
    const { data } = await supabase
      .from('profiles')
      .select('role, email, access_starts_on, access_expires_at, intern_access_enabled, must_change_password, password_change_required_on')
      .eq('id', user.id)
      .single()
    profile = data
  }

  if (user && profile?.role === 'intern') {
    if (!internHasStarted(profile.access_starts_on)) {
      if (pathname !== '/access-not-started') return NextResponse.redirect(new URL('/access-not-started', request.url))
      return response
    }
    if (!internAccessIsActive(profile.intern_access_enabled, profile.access_starts_on, profile.access_expires_at)) {
      let pushCleanupFailed = false
      try {
        const admin = createNotificationAdminClient()
        const { error } = await admin.from('push_subscriptions').delete().eq('user_id', user.id)
        if (error) throw error
      } catch (error) {
        console.error('Inactive intern push subscriptions could not be removed:', error)
        pushCleanupFailed = true
      }
      await supabase.auth.signOut()
      const endedUrl = new URL('/access-ended', request.url)
      endedUrl.searchParams.set('push-cleanup', pushCleanupFailed ? 'failed' : 'complete')
      const ended = NextResponse.redirect(endedUrl)
      response.cookies.getAll().forEach(cookie => ended.cookies.set(cookie.name, cookie.value, cookie))
      return ended
    }
    const passwordChangeDue = internPasswordChangeIsDue(
      profile.must_change_password,
      profile.password_change_required_on,
    )
    const isPasswordChangeRequest = pathname === '/change-password'
      || pathname === '/api/intern/password-change'
    if (passwordChangeDue && !isPasswordChangeRequest) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }
    if (!passwordChangeDue && pathname === '/change-password') {
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
    return NextResponse.redirect(new URL(
      isObxOnlyVolunteerRole(profile?.role, profile?.email) ? '/obx' : '/dashboard',
      request.url
    ))
  }

  // Redirect authenticated users from root to dashboard
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL(
      isObxOnlyVolunteerRole(profile?.role, profile?.email) ? '/obx' : '/dashboard',
      request.url
    ))
  }

  const representativeEmail = process.env.STAFFHUB_VOLUNTEER_REP_EMAIL
  const obxOnlyVolunteer = isObxOnlyVolunteerRole(profile?.role, profile?.email, representativeEmail)
  if (user && obxOnlyVolunteer) {
    if (isDashboardPath) return NextResponse.redirect(new URL('/obx', request.url))
    if (isApiPath && !canVolunteerAccessApi(profile?.role, pathname, profile?.email, representativeEmail)) {
      const denied = NextResponse.json({ error: 'Volunteer StaffHub accounts can access OBX only.' }, { status: 403 })
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie.name, cookie.value, cookie))
      return denied
    }
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
    if (pathname === '/dashboard/onboarding' || pathname.startsWith('/dashboard/onboarding/')) return ['admin', 'manager', 'dpo']
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
     * - manifest.webmanifest, icons, and apple-touch-icon.png (public PWA files)
     * - favicon.ico (favicon file)
     * - api (API routes - optional, can be handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icons(?:/.*)?|apple-touch-icon\\.png|api).*)',
    '/api/:path*',
  ],
}
