'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { clearPushSubscriptionBeforeSignOut } from '@/lib/notifications/client'

export default function Header({ profile }: { profile?: any }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    try {
      await clearPushSubscriptionBeforeSignOut()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Unable to safely sign out. Please try again.')
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/92 backdrop-blur-md border-b border-border">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 overflow-hidden rounded-full border border-pink-accent/40 bg-surface flex-shrink-0">
            <Image src="/logo.jpeg" alt="NK Udada Foundation logo" width={40} height={40} className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="font-bold text-base text-text serif-display leading-none">NK Udada</div>
            <div className="text-xs text-muted font-medium tracking-wider uppercase leading-none mt-1">Hub</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-text transition-colors">
            Dashboard
          </Link>
          <Link href="/dashboard/documents" className="text-sm font-medium text-muted hover:text-text transition-colors">
            Documents
          </Link>
          <Link href="/dashboard/announcements" className="text-sm font-medium text-muted hover:text-text transition-colors">
            Announcements
          </Link>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {profile && (
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-text">{profile.name || 'User'}</p>
                <p className="text-xs text-muted capitalize">{profile.role || 'member'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-pink-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">{profile.name?.[0] || 'U'}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 text-sm font-medium text-muted hover:text-text transition-colors p-2 rounded-lg hover:bg-surface-muted"
            title="Logout"
          >
            <LogOut size={16} />
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-muted transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-surface-muted/50">
          <div className="px-6 py-4 space-y-3">
            <Link
              href="/dashboard"
              className="block text-sm font-medium text-text hover:text-accent transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/documents"
              className="block text-sm font-medium text-text hover:text-accent transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Documents
            </Link>
            <Link
              href="/dashboard/announcements"
              className="block text-sm font-medium text-text hover:text-accent transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Announcements
            </Link>
            <button
              onClick={() => {
                handleLogout()
                setMobileMenuOpen(false)
              }}
              className="w-full flex items-center justify-center gap-2 mt-4 text-sm font-medium text-accent bg-surface-muted py-2 rounded hover:bg-accent/10 transition-colors"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
