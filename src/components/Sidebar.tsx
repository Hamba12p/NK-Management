'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRole, roleBadgeClass } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import HubIcon, { type HubIconName } from '@/components/HubIcon'

type NavItem = { href: string; label: string; icon: HubIconName; adminOnly: boolean }

const SIDEBAR_STORAGE_KEY = 'nk_sidebar_collapsed'

const getNavItems = (role?: string) => {
  const baseItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: 'home', adminOnly: false },
    { href: '/dashboard/documents', label: 'Documents', icon: 'documents', adminOnly: false },
    { href: '/dashboard/announcements', label: 'Announcements', icon: 'announcements', adminOnly: false },
    { href: '/dashboard/workspace', label: 'Workspace', icon: 'workspace', adminOnly: false },
    { href: '/dashboard/settings', label: 'Settings', icon: 'settings', adminOnly: false },
  ]

  const managerItems = [
    { href: '/dashboard/meetings', label: 'Meetings', icon: 'meetings' as const, adminOnly: false },
    { href: '/dashboard/team', label: 'Team', icon: 'team' as const, adminOnly: false },
    { href: '/dashboard/volunteers', label: 'Volunteers', icon: 'volunteers' as const, adminOnly: false },
    { href: '/dashboard/classes', label: 'Classes', icon: 'classes' as const, adminOnly: false },
    { href: '/dashboard/learners', label: 'Learners', icon: 'learners' as const, adminOnly: false },
    { href: '/dashboard/hub', label: 'Hub Overview', icon: 'equipment' as const, adminOnly: false },
  ]

  const adminItems = [
    { href: '/dashboard/activity-log', label: 'Activity Log', icon: 'activity' as const, adminOnly: true },
    { href: '/dashboard/advanced', label: 'Advanced', icon: 'advanced' as const, adminOnly: true },
    { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' as const, adminOnly: true },
  ]

  if (role === 'admin' || role === 'manager') return [...baseItems, ...managerItems, ...adminItems]

  if (role === 'dpo') {
    return [
      ...baseItems,
      { href: '/dashboard/dpo/register', label: 'Processing Register', icon: 'dpo-register' as const, adminOnly: false },
      { href: '/dashboard/dpo/requests', label: 'Data Requests', icon: 'dpo-requests' as const, adminOnly: false },
      { href: '/dashboard/dpo/incidents', label: 'Incident Log', icon: 'dpo-incidents' as const, adminOnly: false },
      { href: '/dashboard/learners', label: 'Learners', icon: 'learners' as const, adminOnly: false },
      { href: '/dashboard/activity-log', label: 'Activity Log', icon: 'activity' as const, adminOnly: false },
    ]
  }

  if (role === 'volunteer' || role === 'volunteer_senior' || role === 'volunteer_lead') {
    return [
      ...baseItems,
      { href: '/dashboard/classes', label: 'Classes', icon: 'classes' as const, adminOnly: false },
      { href: '/dashboard/hub', label: 'Hub Overview', icon: 'equipment' as const, adminOnly: false },
      { href: '/dashboard/volunteer-profile', label: 'My Profile', icon: 'profile' as const, adminOnly: false },
      { href: '/dashboard/volunteer-hours', label: 'My Hours', icon: 'hours' as const, adminOnly: false },
    ]
  }

  return baseItems
}

function SidebarContent({ profile, pathname, collapsed = false, onNavigate }: { profile: any; pathname: string; collapsed?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logActivity('user.logout', 'auth')
      await supabase.auth.signOut()
      document.cookie = 'nk_volunteer_name=; Path=/; Max-Age=0; SameSite=Lax'
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <div className="app-sidebar flex h-full flex-col bg-ink text-cream">
      <div className={collapsed ? 'border-b border-white/10 p-2' : 'border-b border-white/10 p-6'}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={`flex items-center no-underline transition-opacity hover:opacity-80 ${collapsed ? 'justify-center' : 'gap-3'}`}
          aria-label={collapsed ? 'NK Udada Staff Hub home' : undefined}
          title={collapsed ? 'NK Udada Staff Hub' : undefined}
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-gold bg-white p-0.5">
            <Image src="/logo.jpeg" alt="NK Udada Foundation logo" width={44} height={44} className="h-full w-full rounded-full object-cover" priority />
          </div>
          <div className={collapsed ? 'sr-only' : ''}>
            <p className="serif-display text-sm font-bold leading-tight text-cream">NK Udada</p>
            <p className="text-xs text-white/60">Staff Hub</p>
          </div>
        </Link>
      </div>

      <nav className={`no-scrollbar flex-1 space-y-1 overflow-y-auto ${collapsed ? 'px-2 py-4' : 'p-4'}`}>
        {getNavItems(profile?.role).map(({ href, label, icon, adminOnly }) => {
          if (adminOnly && profile?.role !== 'admin') return null
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center border-l-2 py-3 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} ${
                isActive ? 'border-gold bg-cream text-purple' : 'border-transparent text-white/70 hover:bg-white/10 hover:text-cream'
              }`}
            >
              <HubIcon name={icon} width={18} height={18} className={isActive ? 'text-purple' : 'text-white/60'} />
              <span className={collapsed ? 'sr-only' : ''}>{label}</span>
              {isActive && !collapsed ? <ChevronRight size={16} className="ml-auto text-purple" /> : null}
            </Link>
          )
        })}
      </nav>

      <div className={`space-y-3 border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
        {profile ? (
          <div className={`flex items-center rounded-lg bg-white/5 ${collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'}`} title={collapsed ? `${profile.full_name} — ${formatRole(profile.role)}` : undefined}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-white/10 text-xs font-semibold text-cream">
              {getInitials(profile.full_name || 'User')}
            </div>
            <div className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>
              <p className="truncate text-sm font-semibold text-cream">{profile.full_name}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(profile.role)}`}>{formatRole(profile.role)}</span>
            </div>
          </div>
        ) : null}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label={signingOut ? 'Signing out' : 'Sign out'}
          title={collapsed ? (signingOut ? 'Signing out' : 'Sign out') : undefined}
          className={`flex w-full items-center rounded py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-cream disabled:cursor-not-allowed disabled:opacity-50 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
        >
          <LogOut size={18} />
          <span className={collapsed ? 'sr-only' : ''}>{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useLayoutEffect(() => {
    // Read the browser-only preference before paint to avoid a visible width flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <>
      {isMobile ? (
        <button onClick={() => setMobileOpen(true)} className="app-sidebar fixed left-4 top-4 z-40 border border-white/20 p-2 md:hidden" aria-label="Open menu">
          <Menu size={20} className="text-cream" />
        </button>
      ) : null}

      {isMobile && mobileOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="app-sidebar relative h-full w-72 overflow-hidden border-r border-white/15">
            <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4 z-10 rounded-lg p-2 transition-colors hover:bg-white/10" aria-label="Close menu">
              <X size={18} className="text-cream" />
            </button>
            <SidebarContent profile={profile} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className={`app-sidebar relative sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-ink transition-[width] duration-300 ease-in-out md:flex ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-5 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-ink text-cream shadow-sm transition-colors hover:bg-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <SidebarContent profile={profile} pathname={pathname} collapsed={collapsed} />
      </aside>
    </>
  )
}
