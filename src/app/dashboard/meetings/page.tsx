'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { Calendar, Clock, MapPin, Plus, Trash2, Check, X, ListTodo } from 'lucide-react'
import { logActivity } from '@/lib/activity'
import { archiveAndDeleteContent } from '@/lib/content-deletion'
import CreatorTag from '@/components/CreatorTag'
import { EmptyLedger } from '@/components/BrandIllustrations'
import { volunteerContributor } from '@/lib/creator'

const meetingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional().default(''),
  scheduled_at: z.string().datetime({ local: true }),
  duration_min: z.coerce.number().min(15).max(480).default(60),
  location: z.string().max(300).optional().default(''),
})

type Meeting = {
  id: string
  title: string
  description: string
  scheduled_at: string
  duration_min: number
  location: string
  status: string
  created_by: string | null
  created_at: string
  contributor_name: string | null
  contributor_tag: string | null
  profiles: { full_name: string; role: string; display_tag: string | null; display_color: string | null }
  agenda_items: AgendaItem[]
}

type AgendaItem = {
  id: string
  meeting_id: string
  content: string
  order_index: number
  presenter: string | null
  done: boolean
  created_by: string | null
  created_at: string
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null)
  const [newAgendaItem, setNewAgendaItem] = useState<Record<string, string>>({})
  const [agendaError, setAgendaError] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    duration_min: '60',
    location: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = useMemo(() => createClient(), [])

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: meetingsData }, { data: userData }] = await Promise.all([
        supabase
          .from('meetings')
          .select('*, profiles!meetings_created_by_fkey(*), agenda_items(*)')
          .gte('scheduled_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.auth.getUser(),
      ])

      if (meetingsData) {
        const sorted = meetingsData
          .map(m => ({
            ...m,
            agenda_items: (m.agenda_items || []).sort((a: AgendaItem, b: AgendaItem) => a.order_index - b.order_index),
          }))
          .sort((a: Meeting, b: Meeting) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        setMeetings(sorted)
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
  }, [supabase])

  useEffect(() => {
    // Initial hydration deliberately updates local state after the first query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()

    // REALTIME: listen for changes
    const channel = supabase
      .channel('meetings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items' }, fetchAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAll, supabase])

  async function handleCreateMeeting(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const result = meetingSchema.safeParse({
      ...form,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
    })

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
      if (!userData.user) return

      const { data: inserted, error } = await supabase.from('meetings').insert({
        ...result.data,
        created_by: userData.user.id,
        ...volunteerContributor(),
      }).select('id').single()

      if (error) {
        setErrors({ general: error.message })
        return
      }

      logActivity('meeting.create', 'meeting', inserted?.id, { title: result.data.title })

      setShowForm(false)
      setForm({ title: '', description: '', scheduled_at: '', duration_min: '60', location: '' })
    } catch (err) {
      setErrors({ general: `Error: ${err}` })
    }
  }

  async function handleAddAgendaItem(meetingId: string) {
    const content = newAgendaItem[meetingId]
    if (!content?.trim()) {
      setAgendaError({ [meetingId]: 'Agenda item cannot be empty' })
      return
    }

    if (content.length > 1000) {
      setAgendaError({ [meetingId]: 'Agenda item too long (max 1000 characters)' })
      return
    }

    try {
      const currentMeeting = meetings.find((m) => m.id === meetingId)
      const order = (currentMeeting?.agenda_items?.length || 0) + 1

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAgendaError({ [meetingId]: 'You must be signed in to add an agenda item.' })
        return
      }

      const { error } = await supabase.from('agenda_items').insert({
        meeting_id: meetingId,
        content: content.trim(),
        order_index: order,
        created_by: user.id,
      })

      if (error) {
        setAgendaError({ [meetingId]: error.message })
        return
      }

      setNewAgendaItem({ ...newAgendaItem, [meetingId]: '' })
      setAgendaError({})
    } catch (err) {
      setAgendaError({ [meetingId]: `Error: ${err}` })
    }
  }

  async function handleToggleAgendaItem(itemId: string, currentDone: boolean) {
    try {
      const { error } = await supabase
        .from('agenda_items')
        .update({ done: !currentDone })
        .eq('id', itemId)

      if (error) {
        console.error('Toggle error:', error)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleDeleteAgendaItem(itemId: string) {
    try {
      await archiveAndDeleteContent(supabase, 'agenda_item', itemId)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Delete this meeting? This will also delete all agenda items.')) return

    try {
      await archiveAndDeleteContent(supabase, 'meeting', meetingId)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleUpdateStatus(meetingId: string, newStatus: string) {
    try {
      const { error } = newStatus === 'completed'
        ? await supabase.rpc('complete_meeting_and_carry_forward', { p_meeting_id: meetingId })
        : await supabase.from('meetings').update({ status: newStatus }).eq('id', meetingId)
      if (error) {
        setAgendaError({ [meetingId]: error.message })
        return
      }
      setAgendaError({})
      if (newStatus === 'cancelled') {
        logActivity('meeting.cancel', 'meeting', meetingId, { reason: 'status_update' })
      } else {
        logActivity('meeting.update', 'meeting', meetingId, { status: newStatus })
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleConvertToTask(meeting: Meeting, item: AgendaItem) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // This timestamp is captured from the user's conversion action, not during render.
    // eslint-disable-next-line react-hooks/purity
    const actionTime = Date.now()
    const dueDate = new Date(Math.max(actionTime, new Date(meeting.scheduled_at).getTime()) + 7 * 86400000)
      .toISOString().slice(0, 10)
    const { error } = await supabase.from('tasks').insert({
      title: item.content.slice(0, 200),
      description: `Converted from the agenda for ${meeting.title}`,
      assignee_id: item.presenter || user.id,
      due_date: dueDate,
      source_meeting_id: meeting.id,
      source_agenda_item_id: item.id,
      created_by: user.id,
      ...volunteerContributor(),
    })
    if (error) { setAgendaError({ [meeting.id]: error.code === '23505' ? 'This agenda item is already a task.' : error.message }); return }
    setAgendaError({}); await logActivity('task.create_from_agenda', 'task', undefined, { meeting: meeting.title, agenda_item: item.content })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-purple/10 text-purple border-purple/20',
      in_progress: 'bg-gold/15 text-purple border-gold/30',
      completed: 'bg-green/10 text-green border-green/20',
      cancelled: 'bg-rust/10 text-rust border-rust/25',
    }
    return colors[status] || colors.upcoming
  }

  const canEditMeeting = (meeting: Meeting) => {
    return profile?.role === 'admin' || profile?.role === 'manager' || profile?.id === meeting.created_by
  }

  const canDeleteMeeting = (meeting: Meeting) => profile?.role === 'admin' || profile?.id === meeting.created_by
  const canDeleteAgendaItem = (item: AgendaItem) => profile?.role === 'admin' || profile?.id === item.created_by

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Meetings</h1>
        <p className="text-muted">Schedule and manage meetings with agendas</p>
      </div>

      {/* Create Meeting Button */}
      {(profile?.role === 'admin' || profile?.role === 'manager') && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-purple text-white px-4 py-2.5 rounded-lg hover:bg-purple-lt transition-all font-medium"
          >
            <Plus size={18} /> Schedule Meeting
          </button>
        </div>
      )}

      {/* Create Meeting Form */}
      {showForm && (
        <div className="card mb-6 space-y-4">
          <h2 className="font-semibold text-ink">Schedule New Meeting</h2>

          {errors.general && (
            <div className="rounded border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{errors.general}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={200}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                placeholder="Team Sync Meeting"
              />
              {errors.title && <p className="text-rust text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
              />
              {errors.scheduled_at && <p className="text-rust text-xs mt-1">{errors.scheduled_at}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={form.duration_min}
                onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                min="15"
                max="480"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
              />
              {errors.duration_min && <p className="text-rust text-xs mt-1">{errors.duration_min}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Location / Link</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                maxLength={300}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                placeholder="Conference Room 1 or Google Meet link"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={2000}
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none resize-none"
              placeholder="Meeting objectives and context..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateMeeting}
              className="bg-gold text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple transition-colors"
            >
              Schedule Meeting
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

      {/* Meetings List */}
      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">
          {meetings.length} {meetings.length === 1 ? 'Meeting' : 'Meetings'}
        </h2>

        {meetings.length === 0 ? (
          <div className="record-surface py-16 text-center">
            <EmptyLedger variant="ledger" className="empty-illustration mx-auto mb-3" />
            <p className="font-semibold text-ink">No upcoming meetings recorded.</p><p className="mt-1 text-sm text-muted">Managers can schedule the first meeting and add its agenda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => {
              const { date, time } = formatDateTime(meeting.scheduled_at)
              const isExpanded = expandedMeeting === meeting.id
              const doneCount = meeting.agenda_items?.filter((a) => a.done).length || 0
              const totalItems = meeting.agenda_items?.length || 0

              return (
                <div
                  key={meeting.id}
                  className="record-surface overflow-hidden"
                >
                  {/* Meeting Header */}
                  <button
                    onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                    className="w-full text-left p-4 hover:bg-warm/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><h3 className="min-w-0 truncate text-lg font-semibold text-ink">{meeting.title}</h3><CreatorTag profile={meeting.profiles} contributorName={meeting.contributor_name} contributorTag={meeting.contributor_tag} /></div>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {time} · {meeting.duration_min}min
                          </span>
                          {meeting.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {meeting.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {canEditMeeting(meeting) && (
                          <select
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleUpdateStatus(meeting.id, e.target.value)}
                            value={meeting.status}
                            className={`text-xs px-2 py-1 rounded-full border font-medium cursor-pointer transition-colors ${getStatusColor(
                              meeting.status
                            )}`}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                        {!canEditMeeting(meeting) && (
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColor(meeting.status)}`}>
                            {meeting.status}
                          </span>
                        )}

                        {canDeleteMeeting(meeting) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMeeting(meeting.id)
                            }}
                            className="p-1 hover:bg-rust/10 rounded text-rust/70 hover:text-rust transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Meeting Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t bg-warm/40 p-4 space-y-4">
                      {/* Description */}
                      {meeting.description && (
                        <div>
                          <p className="text-sm text-muted whitespace-pre-wrap">{meeting.description}</p>
                        </div>
                      )}

                      {/* Organizer */}
                      <div className="text-xs text-muted">
                        Organized by <CreatorTag profile={meeting.profiles} contributorName={meeting.contributor_name} contributorTag={meeting.contributor_tag} showName />
                      </div>

                      {/* Agenda Section */}
                      <div className="border-t pt-4">
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm text-ink mb-3">
                            Agenda ({doneCount}/{totalItems})
                          </h4>

                          {/* Agenda Items */}
                          {meeting.agenda_items && meeting.agenda_items.length > 0 && (
                            <ul className="space-y-2 mb-3">
                              {meeting.agenda_items.map((item: AgendaItem) => (
                                <li
                                  key={item.id}
                                  className="flex items-start gap-2 p-2 bg-cream rounded border border-border hover:border-border transition-colors"
                                >
                                  <button
                                    onClick={() => handleToggleAgendaItem(item.id, item.done)}
                                    className="mt-0.5 shrink-0"
                                  >
                                    {item.done ? (
                                      <Check size={16} className="text-green-600" />
                                    ) : (
                                      <X size={16} className="text-muted" />
                                    )}
                                  </button>
                                  <span
                                    className={`flex-1 text-sm ${
                                      item.done ? 'line-through text-muted' : 'text-muted'
                                    }`}
                                  >
                                    {item.content}
                                  </span>
                                  {!item.done && canEditMeeting(meeting) && (
                                    <button onClick={() => handleConvertToTask(meeting, item)} className="shrink-0 text-muted transition-colors hover:text-purple" title="Convert to task">
                                      <ListTodo size={15} />
                                    </button>
                                  )}
                                  {canDeleteAgendaItem(item) && (
                                    <button
                                      onClick={() => handleDeleteAgendaItem(item.id)}
                                      className="ml-auto text-muted hover:text-rust transition-colors shrink-0"
                                      title="Remove agenda item"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Add Agenda Item */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newAgendaItem[meeting.id] || ''}
                              onChange={(e) =>
                                setNewAgendaItem({
                                  ...newAgendaItem,
                                  [meeting.id]: e.target.value,
                                })
                              }
                              maxLength={1000}
                              placeholder="Add agenda item..."
                              className="flex-1 border border-border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-gold focus:border-transparent outline-none"
                            />
                            <button
                              onClick={() => handleAddAgendaItem(meeting.id)}
                              className="bg-gold text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-purple transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          {agendaError[meeting.id] && (
                            <p className="text-rust text-xs mt-1">{agendaError[meeting.id]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
