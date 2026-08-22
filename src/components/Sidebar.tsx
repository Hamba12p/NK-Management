'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { formatRole, roleBadgeClass } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import HubIcon, { type HubIconName } from '@/components/HubIcon'
import {
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: HubIconName; adminOnly: boolean }

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
  ]

  const adminItems = [
    { href: '/dashboard/activity-log', label: 'Activity Log', icon: 'activity' as const, adminOnly: true },
    { href: '/dashboard/advanced', label: 'Advanced', icon: 'advanced' as const, adminOnly: true },
    { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' as const, adminOnly: true },
  ]

  if (role === 'admin' || role === 'manager') {
    return [...baseItems, ...managerItems, ...adminItems]
  }

  if (role === 'dpo') {
    return [
      ...baseItems,
      { href: '/dashboard/dpo/register', label: 'Processing Register', icon: 'dpo-register' as const, adminOnly: false },
      { href: '/dashboard/dpo/requests', label: 'Data Requests', icon: 'dpo-requests' as const, adminOnly: false },
      { href: '/dashboard/dpo/incidents', label: 'Incident Log', icon: 'dpo-incidents' as const, adminOnly: false },
      { href: '/dashboard/activity-log', label: 'Activity Log', icon: 'activity' as const, adminOnly: false },
    ]
  }

  if (role === 'volunteer' || role === 'volunteer_senior' || role === 'volunteer_lead') {
    return [
      ...baseItems,
      { href: '/dashboard/volunteer-profile', label: 'My Profile', icon: 'profile' as const, adminOnly: false },
      { href: '/dashboard/volunteer-hours', label: 'My Hours', icon: 'hours' as const, adminOnly: false },
    ]
  }

  return baseItems
}

function SidebarContent({ profile, pathname, onNavigate }: { profile: any; pathname: string; onNavigate?: () => void }) {
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
    name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="app-sidebar flex flex-col h-full bg-ink text-cream">
      <div className="p-6 border-b border-white/10">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-gold bg-white p-0.5">
            <Image src="/logo.jpeg" alt="NK Udada Foundation logo" width={44} height={44} className="h-full w-full rounded-full object-cover" priority />
          </div>
          <div>
            <p className="font-bold text-cream text-sm serif-display leading-tight">NK Udada</p>
            <p className="text-xs text-white/60">Staff Hub</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {getNavItems(profile?.role).map(({ href, label, icon, adminOnly }) => {
          if (adminOnly && profile?.role !== 'admin') return null
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? 'border-gold bg-cream text-purple' : 'border-transparent text-white/70 hover:bg-white/10 hover:text-cream'
              }`}
            >
              <HubIcon name={icon} width={18} height={18} className={isActive ? 'text-purple' : 'text-white/60'} />
              {label}
              {isActive && <ChevronRight size={16} className="ml-auto text-purple" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-10 h-10 rounded-full border border-gold/50 bg-white/10 flex items-center justify-center text-cream font-semibold text-xs shrink-0">
              {getInitials(profile.full_name || 'User')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-cream truncate">{profile.full_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${roleBadgeClass(profile.role)}`}>
                {formatRole(profile.role)}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:text-cream hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut size={18} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="app-sidebar fixed left-4 top-4 z-40 border border-white/20 p-2 md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-cream" />
        </button>
      )}

      {/* Mobile overlay drawer */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="app-sidebar relative w-72 h-full border-r border-white/15 overflow-hidden">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
              aria-label="Close menu"
            >
              <X size={18} className="text-cream" />
            </button>
            <SidebarContent profile={profile} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="app-sidebar hidden md:flex w-64 bg-ink border-r border-white/10 flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent profile={profile} pathname={pathname} />
      </aside>
    </>
  )
}
