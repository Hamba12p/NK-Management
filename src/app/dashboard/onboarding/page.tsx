import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RosterControls from './roster-controls'
import { LEGAL_VERSION } from '@/lib/obx/legal-content'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'dpo'].includes(profile.role)) redirect('/dashboard?access=denied')
  const [roster, progress, consents] = await Promise.all([
    supabase.from('volunteer_roster').select('id, volunteer_number, full_name, email, phone, status, is_founding, hub_profile_id, staffhub_profile:profiles!volunteer_roster_hub_profile_id_fkey(full_name, role)').order('volunteer_number'),
    supabase.from('obx_progress').select('roster_id, cycle, status, current_stop, overall_score, last_active_at, completed_at').order('last_active_at', { ascending: false }),
    supabase.from('obx_legal_consents').select('roster_id, privacy_accepted_at, mou_accepted_at, legal_version'),
  ])
  const latest = new Map<string, NonNullable<typeof progress.data>[number]>()
  for (const item of progress.data || []) if (!latest.has(item.roster_id)) latest.set(item.roster_id, item)
  const consentByRoster = new Map((consents.data || []).map((record) => [record.roster_id, record]))
  const errors = [roster.error, progress.error, consents.error].filter(Boolean)
  const currentProgress = Array.from(latest.values())
  const completedIds = new Set(currentProgress.filter((item) => item.status === 'completed').map((item) => item.roster_id))
  const activeRosterCount = (roster.data || []).filter((person) => person.status === 'active').length
  const activeCompletedCount = (roster.data || []).filter((person) => person.status === 'active' && completedIds.has(person.id)).length
  // eslint-disable-next-line react-hooks/purity
  const inactiveCutoff = Date.now() - 7 * 86400000
  const nudges = (roster.data || []).filter((person) => {
    const item = latest.get(person.id)
    return item?.status === 'in_progress' && item.last_active_at && new Date(item.last_active_at).getTime() <= inactiveCutoff
  })
  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-purple">Volunteer learning</p><h1 className="serif-display mt-2 text-3xl text-ink">Onboarding</h1><p className="mt-2 text-sm text-muted">Roster and passport progress for NK Udada volunteers.</p></header>
    {errors.length > 0 && <p className="rounded border border-rust/30 bg-rust/10 p-4 text-sm text-rust">Onboarding data is unavailable. Apply the OBX database migrations and check the connection.</p>}
    <section className="grid gap-4 sm:grid-cols-3">{['Complete', 'In progress', 'Not started'].map((label) => { const count = label === 'Not started' ? (roster.data || []).filter((person) => person.status === 'active' && !latest.has(person.id)).length : Array.from(latest.values()).filter((item) => label === 'Complete' ? item.status === 'completed' : item.status === 'in_progress').length; return <article key={label} className="card"><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-3xl text-ink">{count}</p></article> })}</section>
    <section className="flex flex-wrap items-center justify-between gap-3"><h2 className="serif-display text-2xl text-ink">Roster</h2><a className="btn-secondary" href="/api/onboarding/export">Export CSV</a></section>
    {roster.data && <RosterControls initialRoster={roster.data} canReset={profile.role === 'admin'} />}
    <section className="grid gap-4 md:grid-cols-2">
      <article className="card"><h2 className="serif-display text-2xl text-ink">Progress insights</h2><div className="mt-4 space-y-3 text-sm"><p>Active roster: <b>{activeRosterCount}</b></p><p>Reached Stop 1: <b>{currentProgress.length}</b></p><p>Completed all stops: <b>{activeCompletedCount}</b></p><p>Active completion rate: <b>{activeRosterCount ? Math.round(activeCompletedCount / activeRosterCount * 100) : 0}%</b></p><p>Average score: <b>{currentProgress.filter((item) => item.overall_score !== null).length ? `${Math.round(currentProgress.filter((item) => item.overall_score !== null).reduce((sum, item) => sum + Number(item.overall_score), 0) / currentProgress.filter((item) => item.overall_score !== null).length)}%` : 'Not available yet'}</b></p><p>Linked StaffHub profiles: <b>{(roster.data || []).filter((person) => person.hub_profile_id).length}</b></p></div></article>
      <article className="card"><h2 className="serif-display text-2xl text-ink">Nudge list</h2>{nudges.length ? <ul className="mt-4 space-y-3 text-sm">{nudges.map((person) => <li key={person.id}><b>{person.full_name}</b><p className="mt-1 text-muted">Inactive for 7 or more days. Reminder: pick up the Udada Passport at /obx, you can pause any time.</p></li>)}</ul> : <p className="mt-4 text-sm text-muted">No inactive volunteers need a nudge.</p>}</article>
    </section>
    <section className="table-surface overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr><th className="p-3">Volunteer</th><th className="p-3">StaffHub profile</th><th className="p-3">Status</th><th className="p-3">Current stop</th><th className="p-3">Last active</th><th className="p-3">Legal consent</th></tr></thead><tbody>{(roster.data || []).map((person) => { const item = latest.get(person.id); const consent = consentByRoster.get(person.id); const linkedProfile = Array.isArray(person.staffhub_profile) ? person.staffhub_profile[0] : person.staffhub_profile; return <tr key={person.id}><td className="p-3"><span className="font-semibold">{person.volunteer_number}</span><br />{person.full_name}</td><td className="p-3">{linkedProfile ? <>{linkedProfile.full_name}<br /><span className="text-xs capitalize text-muted">{linkedProfile.role.replaceAll('_', ' ')}</span></> : 'Public OBX record'}</td><td className="p-3 capitalize">{person.status === 'inactive' ? 'Roster inactive' : item?.status === 'completed' ? 'Complete' : item ? 'In progress' : 'Not started'}</td><td className="p-3">{item?.current_stop || 'Not started'}</td><td className="p-3">{item?.last_active_at ? new Date(item.last_active_at).toLocaleDateString('en-GB') : 'Not yet active'}</td><td className="p-3">{consent ? <><span className="font-semibold">{consent.legal_version === LEGAL_VERSION ? 'Accepted' : 'Renewal required'}</span><br /><span className="text-xs text-muted">Privacy: {new Date(consent.privacy_accepted_at).toLocaleDateString('en-GB')}<br />MOU: {new Date(consent.mou_accepted_at).toLocaleDateString('en-GB')}<br />Version: {consent.legal_version}</span></> : 'Not accepted'}</td></tr> })}</tbody></table></section>
    <p className="text-xs text-muted">Admins, managers and DPOs can evaluate the current active roster and linked StaffHub accounts. DPO access is read-only; admins can reset a completed or in-progress cycle while retaining earlier history.</p>
  </div>
}
