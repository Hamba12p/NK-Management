'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Plus, Trash2, TrendingUp } from 'lucide-react';

interface VolunteerHour {
  id: string;
  date: string;
  hours: number;
  description: string;
  program: string;
  approved: boolean;
}

export default function VolunteerHoursPage() {
  const supabase = createClient();
  const [hours, setHours] = useState<VolunteerHour[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', hours: '', description: '', program: 'general' });
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('volunteer_hours')
          .eq('id', user.id)
          .single();

        setProfile(profileData);
        setTotalHours(profileData?.volunteer_hours || 0);

        // In a real app, this would fetch from a volunteer_hours table
        // For now, we'll show sample data
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newHours = parseFloat(form.hours);
      setTotalHours(totalHours + newHours);
      
      // Add to list
      setHours([
        ...hours,
        {
          id: Math.random().toString(),
          date: form.date,
          hours: newHours,
          description: form.description,
          program: form.program,
          approved: false,
        },
      ]);

      setForm({ date: '', hours: '', description: '', program: 'general' });
      setShowForm(false);
    } catch (err) {
      console.error('Error logging hours:', err);
    }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-ink mb-2 flex items-center gap-3">
            <Clock className="w-8 h-8 text-gold" />
            Volunteer Hours
          </h1>
          <p className="text-muted">Track and log your volunteer time with NK Udada</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-gold text-white px-4 py-2 rounded-lg hover:bg-purple"
        >
          <Plus size={16} />
          Log Hours
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-warm to-purple/10 rounded-lg border border-gold/20 p-6">
          <p className="text-sm text-muted mb-2">Total Hours Logged</p>
          <p className="text-4xl font-bold text-ink">{totalHours}</p>
          <p className="text-xs text-muted mt-2">All time</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-6">
          <p className="text-sm text-muted mb-2">Hours This Month</p>
          <p className="text-4xl font-bold text-ink">
            {hours.filter(h => new Date(h.date).getMonth() === new Date().getMonth()).reduce((sum, h) => sum + h.hours, 0)}
          </p>
          <p className="text-xs text-muted mt-2">This month</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100 p-6">
          <p className="text-sm text-muted mb-2">Pending Approval</p>
          <p className="text-4xl font-bold text-ink">
            {hours.filter(h => !h.approved).reduce((sum, h) => sum + h.hours, 0)}
          </p>
          <p className="text-xs text-muted mt-2">Awaiting review</p>
        </div>
      </div>

      {/* Log Form */}
      {showForm && (
        <div className="bg-cream border rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-lg">Log Volunteer Hours</h2>
          <form onSubmit={handleLogHours} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  placeholder="e.g., 2.5"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Program</label>
              <select
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
              >
                <option value="general">General Support</option>
                <option value="school_outreach">School Outreach</option>
                <option value="menstrual_health">Menstrual Health</option>
                <option value="community_health">Community Health</option>
                <option value="admin">Administrative</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What did you do?"
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-gold text-white rounded-lg hover:bg-purple"
              >
                Log Hours
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-warm/40"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hours List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-ink">Hours Log</h2>
        {hours.length === 0 ? (
          <div className="bg-cream rounded-lg border p-12 text-center">
            <Clock className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">No hours logged yet. Start by clicking "Log Hours".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hours.map((entry) => (
              <div key={entry.id} className="bg-cream rounded-lg border p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-semibold text-ink">{entry.hours} hours</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${entry.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {entry.approved ? '✓ Approved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{entry.description}</p>
                  <p className="text-xs text-muted mt-1">{new Date(entry.date).toLocaleDateString()} · {entry.program}</p>
                </div>
                <button className="p-2 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
