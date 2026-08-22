import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowRight, AtSign, Bell, CalendarDays, CheckCircle2, FileText, FolderKanban, ListTodo, Plus, ShieldCheck, Users } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const { access } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, documentsResult, announcementsResult, meetingsResult, tasksResult, workspaceResult, assignedTasksResult, agendaResult, ownCommentsResult] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('meetings').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done'),
    supabase.from('workspace_docs').select('*', { count: 'exact', head: true }),
    supabase.from('tasks').select('id, title, due_date, status, source_meeting_id').eq('assignee_id', user.id).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(10),
    supabase.from('agenda_items').select('id, content, meetings!inner(id, title, scheduled_at)').eq('presenter', user.id).eq('done', false).gte('meetings.scheduled_at', new Date().toISOString()).order('scheduled_at', { referencedTable: 'meetings', ascending: true }).limit(10),
    supabase.from('workspace_comments').select('id').eq('author_id', user.id).limit(200),
  ])

  const profile = profileResult.data
  // This server-rendered request needs one stable timestamp for all date comparisons.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const today = dateFormatter.format(new Date())
  const mentionName = firstName.replace(/[^a-z0-9]/gi, '')
  const ownCommentIds = (ownCommentsResult.data || []).map(item => item.id)
  const commentFilter = ownCommentIds.length
    ? `body.ilike.%@${mentionName}%,parent_id.in.(${ownCommentIds.join(',')})`
    : `body.ilike.%@${mentionName}%`
  const mentionedCommentsResult = await supabase
    .from('workspace_comments')
    .select('id, body, created_at, document_id, workspace_docs(title)')
    .or(commentFilter)
    .neq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const myWork = [
    ...(assignedTasksResult.data || []).map(item => ({ id: `task-${item.id}`, type: 'Task', title: item.title, detail: item.due_date ? `Due ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString('en-UG')}` : 'No due date', href: '/dashboard/workspace', sortAt: item.due_date ? new Date(`${item.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER, icon: ListTodo })),
    ...(agendaResult.data || []).map(item => { const meetingRelation = item.meetings as unknown as { title: string; scheduled_at: string } | { title: string; scheduled_at: string }[]; const meeting = Array.isArray(meetingRelation) ? meetingRelation[0] : meetingRelation; return { id: `agenda-${item.id}`, type: 'Agenda', title: item.content, detail: meeting ? `${meeting.title} · ${new Date(meeting.scheduled_at).toLocaleString('en-UG')}` : 'Upcoming meeting', href: '/dashboard/meetings', sortAt: meeting ? new Date(meeting.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER, icon: CalendarDays } }),
    ...(mentionedCommentsResult.data || []).map(item => { const documentRelation = item.workspace_docs as unknown as { title: string } | { title: string }[]; const document = Array.isArray(documentRelation) ? documentRelation[0] : documentRelation; return { id: `comment-${item.id}`, type: 'Mention', title: item.body, detail: document?.title || 'Workspace discussion', href: '/dashboard/workspace', sortAt: new Date(item.created_at).getTime(), icon: AtSign } }),
  ].sort((a, b) => a.sortAt - b.sortAt).slice(0, 8)
  const canReviewCompliance = profile?.role === 'admin' || profile?.role === 'dpo'
  const slaCutoff = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10)
  const [overdueRequestsResult, openIncidentsResult] = canReviewCompliance ? await Promise.all([
    supabase.from('data_subject_requests').select('id, requester, request_type, received_at, status').in('status', ['open', 'in_progress']).lt('received_at', slaCutoff).order('received_at'),
    supabase.from('dpo_incidents').select('id, title, severity, occurred_at, status').in('severity', ['high', 'critical']).neq('status', 'resolved').order('occurred_at'),
  ]) : [{ data: [] }, { data: [] }]
  const severityRank: Record<string, number> = { critical: 0, high: 1 }
  const openIncidents = [...(openIncidentsResult.data || [])].sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
  const stats = [
    { label: 'Shared documents', value: documentsResult.count || 0, icon: FileText, href: '/dashboard/documents', tint: 'bg-purple/10 text-purple' },
    { label: 'Upcoming meetings', value: meetingsResult.count || 0, icon: CalendarDays, href: '/dashboard/meetings', tint: 'bg-purple-lt/15 text-purple' },
    { label: 'Open tasks', value: tasksResult.count || 0, icon: CheckCircle2, href: '/dashboard/workspace', tint: 'bg-green/10 text-green' },
    { label: 'Workspace drafts', value: workspaceResult.count || 0, icon: FolderKanban, href: '/dashboard/workspace', tint: 'bg-rust/10 text-rust' },
  ]

  return (
    <div className="space-y-7">
      {access === 'denied' && <p className="rounded-lg border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">You do not have access to that section.</p>}
      <section className="relative overflow-hidden rounded-lg border border-purple-lt/30 bg-purple px-6 py-8 text-white md:px-9 md:py-10">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[.18em] text-cream/80">{today}</p>
          <h1 className="serif-display text-4xl leading-[1.04] md:text-5xl">Welcome back, {firstName}.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 md:text-base">Your team’s shared space for documents, decisions, and the work that moves NK Udada forward.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/dashboard/workspace" className="inline-flex items-center gap-2 rounded bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-warm">Open workspace <ArrowRight size={16} /></Link>
            <Link href="/dashboard/announcements" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-white/10">View updates</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, tint }) => (
          <Link key={label} href={href} className="record-surface group p-5">
            <div className="flex items-start justify-between"><div className={`rounded-lg p-2.5 ${tint}`}><Icon size={19} /></div><ArrowRight size={17} className="mt-1 text-muted transition group-hover:translate-x-0.5 group-hover:text-purple" /></div>
            <p className="serif-display mt-6 text-3xl text-ink">{value}</p><p className="mt-1 text-sm text-muted">{label}</p>
          </Link>
        ))}
      </section>

      <section className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-purple">Personal queue</p><h2 className="serif-display mt-1 text-2xl text-ink">My Work</h2></div><span className="text-sm text-muted">{myWork.length} open item{myWork.length === 1 ? '' : 's'}</span></div>
        <div className="divide-y divide-border">{myWork.length ? myWork.map(item => { const Icon = item.icon; return <Link key={item.id} href={item.href} className="flex items-start gap-3 px-6 py-4 transition hover:bg-warm/50"><Icon size={17} className="mt-0.5 shrink-0 text-purple" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-purple">{item.type}</p><p className="mt-1 truncate font-semibold text-ink">{item.title}</p><p className="mt-1 text-sm text-muted">{item.detail}</p></div></Link> }) : <div className="px-6 py-10 text-center"><CheckCircle2 className="mx-auto mb-3 text-purple/40" size={28} /><p className="font-semibold text-ink">You’re caught up</p><p className="mt-1 text-sm text-muted">Assigned tasks, upcoming agenda items, mentions, and replies will appear here.</p></div>}</div>
      </section>

      {canReviewCompliance && <section className="card !p-0 overflow-hidden"><div className="flex items-center justify-between border-b border-border px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-rust">Compliance attention</p><h2 className="serif-display mt-1 text-2xl text-ink">Overdue & high-risk</h2></div><ShieldCheck className="text-purple" size={22} /></div><div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0"><div className="p-6"><h3 className="font-bold text-ink">Requests beyond 30 days</h3><div className="mt-4 space-y-3">{(overdueRequestsResult.data || []).map(item => { const overdueDays = Math.floor((nowMs - new Date(`${item.received_at}T00:00:00`).getTime()) / 86400000) - 30; return <Link key={item.id} href="/dashboard/dpo/requests" className="block rounded-lg border border-border p-3 hover:bg-warm"><p className="font-semibold text-ink">{item.requester}</p><p className="mt-1 text-sm text-muted capitalize">{item.request_type} · {overdueDays} day{overdueDays === 1 ? '' : 's'} overdue</p></Link> })}{!(overdueRequestsResult.data || []).length && <p className="text-sm text-muted">No requests are beyond the 30-day SLA.</p>}</div></div><div className="p-6"><h3 className="font-bold text-ink">Open high-severity incidents</h3><div className="mt-4 space-y-3">{openIncidents.map(item => <Link key={item.id} href="/dashboard/dpo/incidents" className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-warm"><AlertTriangle className="mt-0.5 shrink-0 text-rust" size={17} /><div><p className="font-semibold text-ink">{item.title}</p><p className="mt-1 text-sm uppercase text-rust">{item.severity} · {item.status}</p></div></Link>)}{!openIncidents.length && <p className="text-sm text-muted">No unresolved high or critical incidents.</p>}</div></div></div></section>}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-purple">Communication</p><h2 className="serif-display mt-1 text-2xl text-ink">Latest updates</h2></div><Link href="/dashboard/announcements" className="text-sm font-bold text-purple hover:text-purple-lt">See all</Link></div>
          <div className="divide-y divide-border">{(announcementsResult.data || []).length ? announcementsResult.data?.map((announcement) => <Link key={announcement.id} href="/dashboard/announcements" className="block px-6 py-4 transition hover:bg-warm/50"><div className="flex gap-3"><Bell size={17} className="mt-0.5 shrink-0 text-gold" /><div><h3 className="font-bold text-ink">{announcement.title}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{announcement.body}</p></div></div></Link>) : <div className="px-6 py-10 text-center"><Bell className="mx-auto mb-3 text-gold" size={24} /><p className="font-semibold text-ink">No announcements yet</p><p className="mt-1 text-sm text-muted">Updates from the team will appear here.</p></div>}</div>
        </div>

        <aside className="space-y-6">
          <div className="card"><p className="text-xs font-bold uppercase tracking-[.15em] text-purple">Quick actions</p><h2 className="serif-display mt-1 text-2xl text-ink">Keep work moving</h2><div className="mt-5 space-y-2"><Link href="/dashboard/workspace" className="flex items-center justify-between rounded bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-purple/10"><span className="flex items-center gap-3"><Plus size={17} className="text-gold" />Draft a report</span><ArrowRight size={16} /></Link><Link href="/dashboard/documents" className="flex items-center justify-between rounded bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-purple/10"><span className="flex items-center gap-3"><FileText size={17} className="text-purple" />Browse files</span><ArrowRight size={16} /></Link><Link href="/dashboard/team" className="flex items-center justify-between rounded bg-warm px-4 py-3 text-sm font-bold text-ink transition hover:bg-purple/10"><span className="flex items-center gap-3"><Users size={17} className="text-green" />Team directory</span><ArrowRight size={16} /></Link></div></div>
          <div className="record-surface p-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-purple">Your access</p><p className="serif-display mt-2 text-xl text-ink capitalize">{profile?.role || 'Team member'}</p><p className="mt-1 text-sm leading-5 text-muted">Your permissions are applied automatically to the tools in the sidebar.</p></div>
        </aside>
      </section>
    </div>
  )
}
