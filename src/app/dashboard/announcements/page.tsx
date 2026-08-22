'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { AlertCircle, CheckCircle2, Pin, Plus, Trash2, Users } from 'lucide-react'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'
import CreatorTag from '@/components/CreatorTag'
import { EmptyLedger } from '@/components/BrandIllustrations'
import { volunteerContributor } from '@/lib/creator'

const announcementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  body: z.string().min(1, 'Message cannot be empty').max(5000),
  pinned: z.boolean().default(false),
})

type Announcement = {
  id: string
  title: string
  body: string
  pinned: boolean
  author_id: string
  created_at: string
  contributor_name: string | null
  contributor_tag: string | null
  profiles: { full_name: string; role: string; display_tag: string | null; display_color: string | null }
  announcement_acknowledgements: { user_id: string; acknowledged_at: string }[]
}

type StaffMember = { id: string; full_name: string }

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const supabase = createClient()

  async function fetchAll() {
    try {
      const [{ data: announcementsData }, { data: userData }] = await Promise.all([
        supabase
          .from('announcements')
          .select('*, profiles!announcements_author_id_fkey(*), announcement_acknowledgements(user_id, acknowledged_at)')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.auth.getUser(),
      ])

      if (announcementsData) {
        setAnnouncements(announcementsData)
      }

      if (userData.user) {
        setCurrentUserId(userData.user.id)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single()
        setProfile(profileData)
        if (profileData?.role === 'admin') {
          const { data: staffData } = await supabase.from('profiles').select('id, full_name').order('full_name')
          setStaff(staffData || [])
        }
      }
    } catch (e) {
      console.error('Fetch error:', e)
    }
  }

  useEffect(() => {
    // Initial hydration deliberately updates local state after the first query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()

    // REALTIME: listen for changes
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setError('')
    setSuccess('')

    const result = announcementSchema.safeParse(form)

    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0]?.toString() || 'general'
        errs[path] = issue.message
      })
      setErrors(errs)
      return
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setError('Not authenticated')
        return
      }

      const { data: inserted, error: err } = await supabase.from('announcements').insert({
        ...result.data,
        author_id: userData.user.id,
        ...volunteerContributor(),
      }).select('id').single()

      if (err) {
        setError(err.message)
        return
      }

      logActivity('announcement.create', 'announcement', inserted?.id, { title: result.data.title })

      setSuccess('Announcement posted successfully')
      setShowForm(false)
      setForm({ title: '', body: '', pinned: false })
    } catch (err) {
      setError(`Error: ${err}`)
    }
  }

  async function handleTogglePin(id: string, currentPin: boolean) {
    try {
      const { error: err } = await supabase
        .from('announcements')
        .update({ pinned: !currentPin })
        .eq('id', id)

      if (err) {
        setError(err.message)
      }
    } catch (err) {
      setError(`Error: ${err}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement? This cannot be undone.')) return

    try {
      await archiveAndDeleteContent(supabase, 'announcement', id)
      setSuccess('Announcement removed and retained in the administrator archive.')
    } catch (err) {
      setError(`Error: ${err}`)
    }
  }

  async function acknowledge(id: string) {
    setError(''); setSuccess('')
    const { error: acknowledgementError } = await supabase.from('announcement_acknowledgements').upsert({ announcement_id: id, user_id: currentUserId, acknowledged_at: new Date().toISOString() }, { onConflict: 'announcement_id,user_id' })
    if (acknowledgementError) { setError(acknowledgementError.message); return }
    setSuccess('Acknowledgement recorded.'); await logActivity('announcement.acknowledge', 'announcement', id); await fetchAll()
  }

  const canPost = profile && ['admin', 'manager'].includes(profile.role)
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Announcements</h1>
        <p className="text-muted">Stay updated with team announcements</p>
      </div>

      {/* Create Announcement Button */}
      {canPost && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-purple text-white px-4 py-2.5 rounded-lg hover:bg-purple-lt transition-all font-medium"
          >
            <Plus size={18} /> Post Announcement
          </button>
        </div>
      )}

      {/* Create Announcement Form */}
      {showForm && canPost && (
        <div className="card mb-6 space-y-4">
          <h2 className="font-semibold text-ink">New Announcement</h2>

          {errors.general && (
            <div className="rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
              placeholder="Announcement title"
            />
            {errors.title && <p className="text-rust text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Message *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={5000}
              rows={5}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none resize-none"
              placeholder="Write your announcement..."
            />
            {errors.body && <p className="text-rust text-xs mt-1">{errors.body}</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-gold focus:ring-gold cursor-pointer"
            />
            <span className="text-sm text-muted">Pin this announcement (appears at top)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateAnnouncement}
              className="bg-gold text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple transition-colors"
            >
              Post Announcement
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-lg text-sm border border-border hover:bg-warm/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded border border-rust/30 bg-rust/10 p-4">
          <AlertCircle size={20} className="text-rust shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-rust">Error</h3>
            <p className="text-sm text-rust mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </div>
      )}

      {/* Announcements List */}
      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">
          {announcements.length} {announcements.length === 1 ? 'Announcement' : 'Announcements'}
        </h2>

        {announcements.length === 0 ? (
          <div className="record-surface py-16 text-center">
            <EmptyLedger variant="documents" className="empty-illustration mx-auto mb-3" />
            <p className="font-semibold text-ink">No announcements recorded yet.</p><p className="mt-1 text-sm text-muted">New team notices will appear here; managers can use Post Announcement.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const isAdmin = profile?.role === 'admin'
              const isAuthor = profile?.id === announcement.author_id
              const canManageThis = isAdmin || isAuthor
              const acknowledgements = announcement.announcement_acknowledgements || []
              const hasAcknowledged = acknowledgements.some(item => item.user_id === currentUserId)
              const missing = isAdmin ? staff.filter(item => !acknowledgements.some(ack => ack.user_id === item.id)) : []

              return (
                <div
                  key={announcement.id}
                  className={`record-surface overflow-hidden ${
                    announcement.pinned
                      ? 'bg-gold/10'
                      : ''
                  }`}
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.pinned && (
                            <Pin size={16} className="text-gold shrink-0" />
                          )}
                          <h3 className="font-semibold text-ink text-lg truncate">
                            {announcement.title}
                          </h3>
                          <CreatorTag profile={announcement.profiles} contributorName={announcement.contributor_name} contributorTag={announcement.contributor_tag} />
                        </div>
                        <p className="text-xs text-muted">
                          <CreatorTag profile={announcement.profiles} contributorName={announcement.contributor_name} contributorTag={announcement.contributor_tag} showName /> •{' '}
                          {new Date(announcement.created_at).toLocaleDateString('en-UG', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {/* Actions */}
                      {canManageThis && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTogglePin(announcement.id, announcement.pinned)}
                            className={`p-2 rounded-lg transition-colors ${
                              announcement.pinned
                                ? 'bg-gold/15 text-purple hover:bg-gold/25'
                                : 'hover:bg-warm/60 text-muted'
                            }`}
                            title={announcement.pinned ? 'Unpin' : 'Pin'}
                          >
                            <Pin size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="p-2 hover:bg-rust/10 rounded transition-colors text-rust/70 hover:text-rust"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <p className="text-muted whitespace-pre-wrap text-sm leading-relaxed">
                      {announcement.body}
                    </p>
                    {announcement.pinned && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div className="flex items-center gap-2 text-sm text-muted"><Users size={16} /><span>{acknowledgements.length} acknowledgement{acknowledgements.length === 1 ? '' : 's'}</span>{isAdmin && <details className="relative"><summary className="cursor-pointer font-semibold text-purple">{missing.length} pending</summary><div className="record-surface absolute right-0 z-10 mt-2 w-64 p-3"><p className="mb-2 text-xs font-bold uppercase text-muted">Not acknowledged</p>{missing.length ? missing.map(item => <p key={item.id} className="py-1 text-sm text-ink">{item.full_name}</p>) : <p className="text-sm text-muted">Everyone has acknowledged.</p>}</div></details>}</div>{hasAcknowledged ? <span className="flex items-center gap-2 text-sm font-semibold text-green"><CheckCircle2 size={16} />Acknowledged</span> : <button onClick={() => acknowledge(announcement.id)} className="btn-secondary !min-h-0 !px-3 !py-2">Acknowledge</button>}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
