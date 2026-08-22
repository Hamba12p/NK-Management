import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import GlobalSearch from '@/components/GlobalSearch'

export default function DashboardTopbar({ profile }: { profile: { full_name?: string; role?: string } | null }) {
  const firstName = profile?.full_name?.split(' ')[0] || 'Team member'

  return (
    <header className="app-topbar hidden border-b border-purple/20 px-8 py-4 md:flex md:items-center md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-purple">NK Udada Foundation</p>
        <p className="mt-1 text-sm text-muted">Good to see you, {firstName}.</p>
      </div>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <Link href="/dashboard/workspace" className="btn-primary !min-h-0 !rounded-lg !px-3 !py-2">
          Open workspace <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  )
}
