'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { formatRole, roleBadgeClass } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Bell,
  Users,
  UserCheck,
  Settings,
  LogOut,
  Eye,
  Archive,
  BarChart3,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'

const getNavItems = (role?: string) => {
  const baseItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard, adminOnly: false },
    { href: '/dashboard/documents', label: 'Documents', icon: FileText, adminOnly: false },
    { href: '/dashboard/announcements', label: 'Announcements', icon: Bell, adminOnly: false },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: false },
  ]

  const managerItems = [
    { href: '/dashboard/meetings', label: 'Meetings', icon: Calendar, adminOnly: false },
    { href: '/dashboard/team', label: 'Team', icon: Users, adminOnly: false },
    { href: '/dashboard/volunteers', label: 'Volunteers', icon: UserCheck, adminOnly: false },
  ]

  const adminItems = [
    { href: '/dashboard/activity-log', label: 'Activity Log', icon: Eye, adminOnly: true },
    { href: '/dashboard/advanced', label: 'Advanced', icon: Archive, adminOnly: true },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  ]

  if (role === 'admin' || role === 'manager') {
    return [...baseItems, ...managerItems, ...adminItems]
  }

  if (role === 'volunteer' || role === 'volunteer_senior' || role === 'volunteer_lead') {
    return [
      ...baseItems,
      { href: '/dashboard/volunteer-profile', label: 'My Profile', icon: UserCheck, adminOnly: false },
      { href: '/dashboard/volunteer-hours', label: 'My Hours', icon: Calendar, adminOnly: false },
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
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className="flex flex-col h-full bg-cream">
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-purple flex items-center justify-center text-white font-bold text-sm serif-display shrink-0">
            NK
          </div>
          <div>
            <p className="font-bold text-ink text-sm serif-display leading-tight">NK Udada</p>
            <p className="text-xs text-muted">Staff Hub</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {getNavItems(profile?.role).map(({ href, label, icon: Icon, adminOnly }) => {
          if (adminOnly && profile?.role !== 'admin') return null
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-warm text-gold shadow-sm' : 'text-muted hover:bg-warm/50 hover:text-ink'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-gold' : 'text-muted'} />
              {label}
              {isActive && <ChevronRight size={16} className="ml-auto text-gold" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-warm/50">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-xs shrink-0">
              {getInitials(profile.full_name || 'User')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{profile.full_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${roleBadgeClass(profile.role)}`}>
                {formatRole(profile.role)}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted hover:text-gold hover:bg-warm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false)
    }
  }, [isMobile])

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-4 left-4 z-40 p-2 bg-cream border border-border rounded-lg shadow-sm"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-ink" />
        </button>
      )}

      {/* Mobile overlay drawer */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 h-full shadow-2xl border-r border-border overflow-hidden bg-cream">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-warm transition-colors z-10"
              aria-label="Close menu"
            >
              <X size={18} className="text-muted" />
            </button>
            <SidebarContent profile={profile} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-cream border-r border-border flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent profile={profile} pathname={pathname} />
      </aside>
    </>
  )
}
