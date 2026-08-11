import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowRight, Bell, CalendarDays, CheckCircle2, FileText, FolderKanban, Plus, Users } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })

export default async function DashboardHome() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, documentsResult, announcementsResult, meetingsResult, tasksResult, workspaceResult] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('meetings').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
    supabase.from('workspace_docs').select('*', { count: 'exact', head: true }),
  ])

  const profile = profileResult.data
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const today = dateFormatter.format(new Date())
  const stats = [
    { label: 'Shared documents', value: documentsResult.count || 0, icon: FileText, href: '/dashboard/documents', tint: 'bg-[#f7e9ee] text-[#a83e65]' },
    { label: 'Upcoming meetings', value: meetingsResult.count || 0, icon: CalendarDays, href: '/dashboard/meetings', tint: 'bg-[#ede8f3] text-[#5d365c]' },
    { label: 'Open tasks', value: tasksResult.count || 0, icon: CheckCircle2, href: '/dashboard/workspace', tint: 'bg-[#e7f1ee] text-[#29645a]' },
    { label: 'Workspace drafts', value: workspaceResult.count || 0, icon: FolderKanban, href: '/dashboard/workspace', tint: 'bg-[#f8eee4] text-[#9b5b28]' },
  ]

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl bg-[#1d1424] px-6 py-8 text-white shadow-[0_18px_45px_rgba(37,26,49,.14)] md:px-9 md:py-10">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-gold-lt">{today}</p>
          <h1 className="serif-display text-4xl leading-[1.04] md:text-5xl">Welcome back, {firstName}.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 md:text-base">Your team’s shared space for documents, decisions, and the work that moves NK Udada forward.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/dashboard/workspace" className="inline-flex items-center gap-2 rounded-lg bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-white">Open workspace <ArrowRight size={16} /></Link>
            <Link href="/dashboard/announcements" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-white/10">View updates</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, tint }) => (
          <Link key={label} href={href} className="group rounded-xl border border-border bg-cream p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-lt hover:shadow-md">
            <div className="flex items-start justify-between"><div className={`rounded-lg p-2.5 ${tint}`}><Icon size={19} /></div><ArrowRight size={17} className="mt-1 text-muted transition group-hover:translate-x-0.5 group-hover:text-purple" /></div>
            <p className="serif-display mt-6 text-3xl text-ink">{value}</p><p className="mt-1 text-sm text-muted">{label}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-gold">Communication</p><h2 className="serif-display mt-1 text-2xl text-ink">Latest updates</h2></div><Link href="/dashboard/announcements" className="text-sm font-bold text-purple hover:text-gold">See all</Link></div>
          <div className="divide-y divide-border">{(announcementsResult.data || []).length ? announcementsResult.data?.map((announcement) => <Link key={announcement.id} href="/dashboard/announcements" className="block px-6 py-4 transition hover:bg-warm/50"><div className="flex gap-3"><Bell size={17} className="mt-0.5 shrink-0 text-gold" /><div><h3 className="font-bold text-ink">{announcement.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{announcement.body}</p></div></div></Link>) : <div className="px-6 py-10 text-center"><Bell className="mx-auto mb-3 text-gold" size={24} /><p className="font-semibold text-ink">No announcements yet</p><p className="mt-1 text-sm text-muted">Updates from the team will appear here.</p></div>}</div>
        </div>

        <aside className="space-y-6">
          <div className="card"><p className="text-xs font-bold uppercase tracking-[.15em] text-gold">Quick actions</p><h2 className="serif-display mt-1 text-2xl text-ink">Keep work moving</h2><div className="mt-5 space-y-2"><Link href="/dashboard/workspace" className="flex items-center justify-between rounded-lg bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-[#ebdfe7]"><span className="flex items-center gap-3"><Plus size={17} className="text-gold" />Draft a report</span><ArrowRight size={16} /></Link><Link href="/dashboard/documents" className="flex items-center justify-between rounded-lg bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-[#ebdfe7]"><span className="flex items-center gap-3"><FileText size={17} className="text-purple" />Browse files</span><ArrowRight size={16} /></Link><Link href="/dashboard/team" className="flex items-center justify-between rounded-lg bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-[#ebdfe7]"><span className="flex items-center gap-3"><Users size={17} className="text-green" />Team directory</span><ArrowRight size={16} /></Link></div></div>
          <div className="rounded-xl border border-[#e7cfda] bg-[#fbf4f7] p-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-gold">Your access</p><p className="mt-2 text-lg font-bold text-ink capitalize">{profile?.role || 'Team member'}</p><p className="mt-1 text-sm leading-5 text-muted">Your permissions are applied automatically to the tools in the sidebar.</p></div>
        </aside>
      </section>
    </div>
  )
}
