'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { Bell, Pin, Plus, Trash2, AlertCircle } from 'lucide-react'

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
  profiles: { full_name: string; role: string }
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  async function fetchAll() {
    try {
      const [{ data: announcementsData }, { data: userData }] = await Promise.all([
        supabase
          .from('announcements')
          .select('*, profiles(full_name, role)')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.auth.getUser(),
      ])

      if (announcementsData) {
        setAnnouncements(announcementsData)
      }

      if (userData.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single()
        setProfile(profileData)
      }
    } catch (e) {
      console.error('Fetch error:', e)
    }
  }

  useEffect(() => {
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

      const { error: err } = await supabase.from('announcements').insert({
        ...result.data,
        author_id: userData.user.id,
      })

      if (err) {
        setError(err.message)
        return
      }

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
      const { error: err } = await supabase.from('announcements').delete().eq('id', id)

      if (err) {
        setError(err.message)
        return
      }

      setSuccess('Announcement deleted')
    } catch (err) {
      setError(`Error: ${err}`)
    }
  }

  const canPost = profile && ['admin', 'manager'].includes(profile.role)
  const canManage = (announcement: Announcement) => {
    return (
      profile &&
      (profile.role === 'admin' || profile.id === announcement.author_id)
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h1>
        <p className="text-gray-500">Stay updated with team announcements</p>
      </div>

      {/* Create Announcement Button */}
      {canPost && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-pink-700 text-white px-4 py-2.5 rounded-lg hover:from-pink-700 hover:to-pink-800 transition-all font-medium"
          >
            <Plus size={18} /> Post Announcement
          </button>
        </div>
      )}

      {/* Create Announcement Form */}
      {showForm && canPost && (
        <div className="bg-white border rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">New Announcement</h2>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
              placeholder="Announcement title"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              maxLength={5000}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none resize-none"
              placeholder="Write your announcement..."
            />
            {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body}</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">Pin this announcement (appears at top)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateAnnouncement}
              className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors"
            >
              Post Announcement
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {announcements.length} {announcements.length === 1 ? 'Announcement' : 'Announcements'}
        </h2>

        {announcements.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Bell size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No announcements yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const isAdmin = profile?.role === 'admin'
              const isAuthor = profile?.id === announcement.author_id
              const canManageThis = isAdmin || isAuthor

              return (
                <div
                  key={announcement.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    announcement.pinned
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-gray-200'
                  } hover:shadow-md`}
                >
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.pinned && (
                            <Pin size={16} className="text-amber-600 shrink-0" />
                          )}
                          <h3 className="font-semibold text-gray-900 text-lg truncate">
                            {announcement.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500">
                          <strong>{announcement.profiles?.full_name}</strong> •{' '}
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
                                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                : 'hover:bg-gray-100 text-gray-400'
                            }`}
                            title={announcement.pinned ? 'Unpin' : 'Pin'}
                          >
                            <Pin size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {announcement.body}
                    </p>
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
