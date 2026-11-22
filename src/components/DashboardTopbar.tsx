import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import GlobalSearch from '@/components/GlobalSearch'
import NotificationCenter from '@/components/notifications/NotificationCenter'

export default function DashboardTopbar({ profile }: { profile: { full_name?: string; role?: string } | null }) {
  const firstName = profile?.full_name?.split(' ')[0] || 'Team member'

  return (
    <header className="app-topbar flex min-h-16 items-center justify-between border-b border-border px-4 py-2 md:min-h-14 md:px-8 md:py-4">
      <div className="min-w-0 pl-12 md:pl-0">
        <p className="truncate text-xs font-bold uppercase tracking-[.16em] text-accent">NK Udada Foundation</p>
        <p className="mt-1 hidden text-sm text-muted md:block">Good to see you, {firstName}.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:block"><GlobalSearch /></div>
        <NotificationCenter />
        <Link href="/dashboard/workspace" className="btn-primary hidden !min-h-0 !rounded-lg !px-3 !py-2 md:inline-flex">
          Open workspace <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  )
}
