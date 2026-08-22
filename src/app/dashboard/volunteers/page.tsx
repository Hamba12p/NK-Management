'use client'

import { useEffect, useMemo, useState } from 'react'
import { Award, Clock, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { formatRole } from '@/lib/utils'

type VolunteerDetails = {
  tier: 'volunteer' | 'volunteer_senior' | 'volunteer_lead'
  department: string
  status: 'active' | 'inactive' | 'onboarding'
  join_date: string
  hours_total: number
}

type Volunteer = {
  id: string
  full_name: string
  role: string
  volunteer_profiles: VolunteerDetails | VolunteerDetails[] | null
}

const detailsFor = (item: Volunteer) => Array.isArray(item.volunteer_profiles)
  ? item.volunteer_profiles[0]
  : item.volunteer_profiles

export default function VolunteersPage() {
  const supabase = useMemo(() => createClient(), [])
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, full_name, role, volunteer_profiles(tier, department, status, join_date, hours_total)')
        .in('role', ['volunteer', 'volunteer_senior', 'volunteer_lead'])
        .order('full_name')

      if (queryError) setError(queryError.message)
      else setVolunteers((data || []) as Volunteer[])
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="grid min-h-80 place-items-center text-muted">Loading volunteers…</div>

  const activeCount = volunteers.filter(item => detailsFor(item)?.status === 'active').length
  const totalHours = volunteers.reduce((sum, item) => sum + Number(detailsFor(item)?.hours_total || 0), 0)
  const leadCount = volunteers.filter(item => detailsFor(item)?.tier === 'volunteer_lead').length

  return <div>
    <PageHeader title="Volunteer Network" description="A durable directory of volunteer assignments, status, and auditable hours." />
    {error && <p className="mb-6 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">{error}</p>}
    <div className="mb-7 grid gap-4 md:grid-cols-3">
      <Stat icon={Users} label="Active volunteers" value={activeCount} />
      <Stat icon={Award} label="Volunteer leads" value={leadCount} />
      <Stat icon={Clock} label="Approved hours" value={totalHours.toFixed(1)} />
    </div>
    <div className="table-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-warm text-muted"><tr><th className="p-4">Volunteer</th><th className="p-4">Tier</th><th className="p-4">Department</th><th className="p-4">Status</th><th className="p-4 text-right">Hours</th></tr></thead>
        <tbody>{volunteers.map(item => {
          const details = detailsFor(item)
          return <tr key={item.id} className="border-t border-border">
            <td className="p-4"><p className="font-semibold text-ink">{item.full_name}</p><p className="text-xs text-muted">Joined {details?.join_date ? new Date(details.join_date).toLocaleDateString('en-UG') : '—'}</p></td>
            <td className="p-4 text-ink">{formatRole(details?.tier || item.role)}</td>
            <td className="p-4 text-muted">{details?.department || 'General'}</td>
            <td className="p-4 capitalize text-muted">{details?.status || 'onboarding'}</td>
            <td className="p-4 text-right font-semibold text-ink">{Number(details?.hours_total || 0).toFixed(1)}</td>
          </tr>
        })}</tbody>
      </table>
      {!volunteers.length && !error && <div className="p-12 text-center text-muted">No volunteer profiles are available yet.</div>}
    </div>
    <p className="mt-4 text-xs text-muted">New volunteers are provisioned through the organisation’s staff account setup so every record remains linked to a verified login.</p>
  </div>
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return <div className="card"><div className="flex items-center justify-between"><div><p className="text-sm text-muted">{label}</p><p className="serif-display mt-2 text-3xl text-ink">{value}</p></div><Icon className="text-purple/35" size={34} /></div></div>
}
