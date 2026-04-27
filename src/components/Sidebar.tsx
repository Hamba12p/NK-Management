'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Bell,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Eye,
  Archive,
  BarChart3,
  ChevronRight,
} from 'lucide-react'

const getNavItems = (role?: string) => {
  const baseItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard, adminOnly: false },
    { href: '/dashboard/documents', label: 'Documents', icon: FileText, adminOnly: false },
    { href: '/dashboard/announcements', label: 'Announcements', icon: Bell, adminOnly: false },
  ]

  const managerItems = [
    { href: '/dashboard/meetings', label: 'Meetings', icon: Calendar, adminOnly: false },
    { href: '/dashboard/team', label: 'Team', icon: Users, adminOnly: false },
    { href: '/dashboard/volunteers', label: 'Volunteers', icon: Users, adminOnly: false },
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
      { href: '/dashboard/volunteer-profile', label: 'My Profile', icon: Users, adminOnly: false },
      { href: '/dashboard/volunteer-hours', label: 'My Hours', icon: Calendar, adminOnly: false },
    ]
  }

  return baseItems
}

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setSigningOut(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  return (
    <aside className="w-64 bg-cream border-r border-border flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-purple flex items-center justify-center text-white font-bold text-lg serif-display">
            N
          </div>
          <div>
            <p className="font-bold text-ink text-sm serif-display leading-tight">NK Udada</p>
            <p className="text-xs text-muted">Staff Hub</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {getNavItems(profile?.role).map(({ href, label, icon: Icon, adminOnly }) => {
          // Hide admin-only items from non-admin users
          if (adminOnly && profile?.role !== 'admin') {
            return null
          }
          
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-warm text-gold shadow-sm'
                  : 'text-muted hover:bg-warm/50 hover:text-ink'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-gold' : 'text-muted'} />
              {label}
              {isActive && <ChevronRight size={16} className="ml-auto text-gold" />}
            </Link>
          )
        })}
      </nav>

      {/* Profile Section */}
      <div className="p-4 border-t border-border space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-warm/50">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold text-xs shrink-0">
              {getInitials(profile.full_name || 'User')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {profile.full_name}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  profile.role === 'admin' ? 'bg-purple/20 text-purple' :
                  profile.role === 'manager' ? 'bg-gold/20 text-gold' :
                  profile.role?.startsWith('volunteer') ? 'bg-green/20 text-green' :
                  'bg-border text-muted'
                }`}>
                  {profile.role === 'volunteer_senior' ? 'Senior Volunteer' :
                   profile.role === 'volunteer_lead' ? 'Volunteer Lead' :
                   profile.role?.charAt(0).toUpperCase() + profile.role?.slice(1)}
                </span>
              </div>
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
    </aside>
  )
}
