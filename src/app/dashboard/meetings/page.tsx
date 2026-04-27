'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { Calendar, Clock, MapPin, Plus, Trash2, Check, X } from 'lucide-react'

const meetingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(2000).optional().default(''),
  scheduled_at: z.string().datetime({ local: true }),
  duration_min: z.coerce.number().min(15).max(480).default(60),
  location: z.string().max(300).optional().default(''),
})

const agendaSchema = z.object({
  content: z.string().min(1).max(1000),
})

type Meeting = {
  id: string
  title: string
  description: string
  scheduled_at: string
  duration_min: number
  location: string
  status: string
  created_by: string
  created_at: string
  profiles: { full_name: string; role: string }
  agenda_items: AgendaItem[]
}

type AgendaItem = {
  id: string
  meeting_id: string
  content: string
  order_index: number
  presenter: string | null
  done: boolean
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
  const supabase = createClient()

  async function fetchAll() {
    try {
      const [{ data: meetingsData }, { data: userData }] = await Promise.all([
        supabase
          .from('meetings')
          .select('*, profiles(full_name, role), agenda_items(*)')
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
  }

  useEffect(() => {
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
  }, [])

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

      const { error } = await supabase.from('meetings').insert({
        ...result.data,
        created_by: userData.user.id,
      })

      if (error) {
        setErrors({ general: error.message })
        return
      }

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

      const { error } = await supabase.from('agenda_items').insert({
        meeting_id: meetingId,
        content: content.trim(),
        order_index: order,
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
      const { error } = await supabase.from('agenda_items').delete().eq('id', itemId)
      if (error) {
        console.error('Delete error:', error)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleDeleteMeeting(meetingId: string) {
    if (!confirm('Delete this meeting? This will also delete all agenda items.')) return

    try {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
      if (error) {
        console.error('Delete error:', error)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function handleUpdateStatus(meetingId: string, newStatus: string) {
    try {
      const { error } = await supabase.from('meetings').update({ status: newStatus }).eq('id', meetingId)
      if (error) {
        console.error('Update error:', error)
      }
    } catch (err) {
      console.error('Error:', err)
    }
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
      upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      completed: 'bg-green-50 text-green-700 border-green-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
    }
    return colors[status] || colors.upcoming
  }

  const canEditMeeting = (meeting: Meeting) => {
    return profile?.role === 'admin' || profile?.role === 'manager' || profile?.id === meeting.created_by
  }

  const dt = formatDateTime(new Date().toISOString())

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Meetings</h1>
        <p className="text-gray-500">Schedule and manage meetings with agendas</p>
      </div>

      {/* Create Meeting Button */}
      {(profile?.role === 'admin' || profile?.role === 'manager') && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-pink-700 text-white px-4 py-2.5 rounded-lg hover:from-pink-700 hover:to-pink-800 transition-all font-medium"
          >
            <Plus size={18} /> Schedule Meeting
          </button>
        </div>
      )}

      {/* Create Meeting Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Schedule New Meeting</h2>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errors.general}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={200}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="Team Sync Meeting"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
              />
              {errors.scheduled_at && <p className="text-red-500 text-xs mt-1">{errors.scheduled_at}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={form.duration_min}
                onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                min="15"
                max="480"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
              />
              {errors.duration_min && <p className="text-red-500 text-xs mt-1">{errors.duration_min}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Link</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                maxLength={300}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                placeholder="Conference Room 1 or Google Meet link"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={2000}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none resize-none"
              placeholder="Meeting objectives and context..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreateMeeting}
              className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors"
            >
              Schedule Meeting
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

      {/* Meetings List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {meetings.length} {meetings.length === 1 ? 'Meeting' : 'Meetings'}
        </h2>

        {meetings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No meetings scheduled.</p>
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
                  className="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Meeting Header */}
                  <button
                    onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-lg">{meeting.title}</h3>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
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

                        {canEditMeeting(meeting) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMeeting(meeting.id)
                            }}
                            className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Meeting Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4 space-y-4">
                      {/* Description */}
                      {meeting.description && (
                        <div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.description}</p>
                        </div>
                      )}

                      {/* Organizer */}
                      <div className="text-xs text-gray-500">
                        Organized by <strong>{meeting.profiles?.full_name}</strong>
                      </div>

                      {/* Agenda Section */}
                      <div className="border-t pt-4">
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm text-gray-900 mb-3">
                            Agenda ({doneCount}/{totalItems})
                          </h4>

                          {/* Agenda Items */}
                          {meeting.agenda_items && meeting.agenda_items.length > 0 && (
                            <ul className="space-y-2 mb-3">
                              {meeting.agenda_items.map((item: AgendaItem) => (
                                <li
                                  key={item.id}
                                  className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors"
                                >
                                  <button
                                    onClick={() => handleToggleAgendaItem(item.id, item.done)}
                                    className="mt-0.5 shrink-0"
                                  >
                                    {item.done ? (
                                      <Check size={16} className="text-green-600" />
                                    ) : (
                                      <X size={16} className="text-gray-300" />
                                    )}
                                  </button>
                                  <span
                                    className={`flex-1 text-sm ${
                                      item.done ? 'line-through text-gray-400' : 'text-gray-700'
                                    }`}
                                  >
                                    {item.content}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteAgendaItem(item.id)}
                                    className="ml-auto text-gray-300 hover:text-red-400 transition-colors shrink-0"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
                              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                            />
                            <button
                              onClick={() => handleAddAgendaItem(meeting.id)}
                              className="bg-pink-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-pink-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          {agendaError[meeting.id] && (
                            <p className="text-red-500 text-xs mt-1">{agendaError[meeting.id]}</p>
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
