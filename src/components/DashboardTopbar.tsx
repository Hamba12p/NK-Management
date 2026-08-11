import Link from 'next/link'
import { ArrowUpRight, Search } from 'lucide-react'

export default function DashboardTopbar({ profile }: { profile: { full_name?: string; role?: string } | null }) {
  const firstName = profile?.full_name?.split(' ')[0] || 'Team member'

  return (
    <header className="hidden border-b border-border bg-cream/80 px-8 py-4 backdrop-blur md:flex md:items-center md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-gold">NK Udada Foundation</p>
        <p className="mt-1 text-sm text-muted">Good to see you, {firstName}.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted lg:flex">
          <Search size={15} /> <span>Find a document or task</span>
        </div>
        <Link href="/dashboard/workspace" className="btn-primary !min-h-0 !rounded-lg !px-3 !py-2">
          Open workspace <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  )
}
