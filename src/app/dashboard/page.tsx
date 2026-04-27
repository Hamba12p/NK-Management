import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, FileText, Bell, Users, ArrowRight } from 'lucide-react'

export default async function DashboardHome() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const welcomeMessage = profile?.role === 'admin' 
    ? 'Welcome back, Admin' 
    : 'Welcome to NK Udada Hub'

  const dateStr = new Date().toLocaleDateString('en-UG', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warm border border-gold/30 mb-6">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
          <span className="text-xs font-medium text-gold uppercase tracking-wider">Welcome back</span>
        </div>
        <h1 className="text-5xl font-bold text-ink serif-display mb-3">
          {welcomeMessage}
        </h1>
        <p className="text-lg text-muted font-medium">
          {dateStr}
        </p>
      </div>

      {/* Dashboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {/* Documents Card */}
        <div className="card group hover:-translate-y-1">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-gold uppercase tracking-widest mb-2">Documents</p>
              <p className="text-3xl font-bold text-ink serif-display">—</p>
            </div>
            <div className="p-3 rounded-full bg-warm group-hover:bg-gold/20 transition-colors">
              <FileText size={24} className="text-gold" />
            </div>
          </div>
          <p className="text-sm text-muted mb-4">Manage and access files</p>
          <a href="/dashboard/documents" className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-gold-lt transition-colors">
            Browse Documents <ArrowRight size={14} />
          </a>
        </div>

        {/* Announcements Card */}
        <div className="card group hover:-translate-y-1">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-purple uppercase tracking-widest mb-2">Announcements</p>
              <p className="text-3xl font-bold text-ink serif-display">—</p>
            </div>
            <div className="p-3 rounded-full bg-warm group-hover:bg-purple/20 transition-colors">
              <Bell size={24} className="text-purple" />
            </div>
          </div>
          <p className="text-sm text-muted mb-4">Stay updated with news</p>
          <a href="/dashboard/announcements" className="inline-flex items-center gap-2 text-sm font-semibold text-purple hover:text-purple-lt transition-colors">
            View Announcements <ArrowRight size={14} />
          </a>
        </div>

        {/* Meetings Card */}
        <div className="card group hover:-translate-y-1">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-gold uppercase tracking-widest mb-2">Meetings</p>
              <p className="text-3xl font-bold text-ink serif-display">—</p>
            </div>
            <div className="p-3 rounded-full bg-warm group-hover:bg-gold/20 transition-colors">
              <Calendar size={24} className="text-gold" />
            </div>
          </div>
          <p className="text-sm text-muted mb-4">Schedule and manage events</p>
          <a href="/dashboard/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-gold-lt transition-colors">
            See Meetings <ArrowRight size={14} />
          </a>
        </div>

        {/* Team Card */}
        <div className="card group hover:-translate-y-1">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-purple uppercase tracking-widest mb-2">Team</p>
              <p className="text-3xl font-bold text-ink serif-display">—</p>
            </div>
            <div className="p-3 rounded-full bg-warm group-hover:bg-purple/20 transition-colors">
              <Users size={24} className="text-purple" />
            </div>
          </div>
          <p className="text-sm text-muted mb-4">Collaborate with your team</p>
          <a href="/dashboard/team" className="inline-flex items-center gap-2 text-sm font-semibold text-purple hover:text-purple-lt transition-colors">
            View Team <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <div className="card">
          <h3 className="text-xl font-bold text-ink serif-display mb-6">Your Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted text-sm">Last login</span>
              <span className="text-ink font-semibold">{dateStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted text-sm">Role</span>
              <span className="text-gold font-semibold capitalize">{profile?.role || 'Member'}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted text-sm">Status</span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="font-semibold text-ink">Active</span>
              </span>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="card bg-gradient-to-br from-warm to-cream">
          <h3 className="text-xl font-bold text-ink serif-display mb-6">Getting Started</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold text-lg">✓</span>
              <span className="text-sm text-ink">Complete your profile information</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold text-lg">✓</span>
              <span className="text-sm text-ink">Explore the available documents</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold text-lg">✓</span>
              <span className="text-sm text-ink">Join upcoming meetings and events</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gold font-bold text-lg">✓</span>
              <span className="text-sm text-ink">Connect with your team members</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
