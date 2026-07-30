'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Trophy, Clock, Plus, Edit, Trash2, Award } from 'lucide-react';

interface Volunteer {
  id: string;
  full_name: string;
  volunteer_tier: 'volunteer' | 'volunteer_senior' | 'volunteer_lead';
  volunteer_hours: number;
  volunteer_join_date: string;
  volunteer_department: string;
  volunteer_status: 'active' | 'inactive' | 'onboarding';
}

export default function VolunteersPage() {
  const supabase = createClient();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', volunteer_department: '', volunteer_tier: 'volunteer' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        // Fetch volunteers (only managers/admins can view all)
        if (profileData?.role === 'admin' || profileData?.role === 'manager') {
          const { data: volunteersData } = await supabase
            .from('profiles')
            .select('*')
            .like('role', 'volunteer%')
            .order('volunteer_hours', { ascending: false });

          if (volunteersData) {
            setVolunteers(volunteersData);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getTierColor = (tier: string) => {
    if (tier === 'volunteer_lead') return 'bg-gold-100 text-gold-800';
    if (tier === 'volunteer_senior') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getTierLabel = (tier: string) => {
    if (tier === 'volunteer_lead') return 'Volunteer Lead';
    if (tier === 'volunteer_senior') return 'Senior Volunteer';
    return 'Volunteer';
  };

  const getTierIcon = (tier: string) => {
    if (tier === 'volunteer_lead') return '👑';
    if (tier === 'volunteer_senior') return '⭐';
    return '🌟';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  const isManager = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-ink mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-gold" />
            Volunteer Network
          </h1>
          <p className="text-muted">
            {isManager ? 'Manage and support our volunteer community' : 'Your volunteer journey with NK Udada'}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gold text-white px-4 py-2 rounded-lg hover:bg-purple"
          >
            <Plus size={16} />
            Add Volunteer
          </button>
        )}
      </div>

      {showForm && isManager && (
        <div className="bg-cream border rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-lg">Register New Volunteer</h2>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
            />
            <input
              type="text"
              placeholder="Department"
              value={form.volunteer_department}
              onChange={(e) => setForm({ ...form, volunteer_department: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
            />
          </div>
          <select
            value={form.volunteer_tier}
            onChange={(e) => setForm({ ...form, volunteer_tier: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none"
          >
            <option value="volunteer">Volunteer</option>
            <option value="volunteer_senior">Senior Volunteer</option>
            <option value="volunteer_lead">Volunteer Lead</option>
          </select>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gold text-white rounded-lg hover:bg-purple"
            >
              Submit
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-warm/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-cream rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Active Volunteers</p>
              <p className="text-3xl font-bold text-ink">{volunteers.filter(v => v.volunteer_status === 'active').length}</p>
            </div>
            <Users className="w-10 h-10 text-white/60" />
          </div>
        </div>
        <div className="bg-cream rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Volunteer Leads</p>
              <p className="text-3xl font-bold text-ink">{volunteers.filter(v => v.volunteer_tier === 'volunteer_lead').length}</p>
            </div>
            <Award className="w-10 h-10 text-gold-200" />
          </div>
        </div>
        <div className="bg-cream rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Total Hours</p>
              <p className="text-3xl font-bold text-ink">{volunteers.reduce((sum, v) => sum + (v.volunteer_hours || 0), 0)}</p>
            </div>
            <Clock className="w-10 h-10 text-purple-200" />
          </div>
        </div>
        <div className="bg-cream rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Avg Hours/Volunteer</p>
              <p className="text-3xl font-bold text-ink">
                {volunteers.length > 0 
                  ? (volunteers.reduce((sum, v) => sum + (v.volunteer_hours || 0), 0) / volunteers.length).toFixed(0)
                  : 0}
              </p>
            </div>
            <Trophy className="w-10 h-10 text-green-200" />
          </div>
        </div>
      </div>

      {/* Volunteers List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink">Volunteer Directory</h2>
        {volunteers.length === 0 ? (
          <div className="bg-cream rounded-lg border p-12 text-center">
            <Users className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">No volunteers yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {volunteers.map((vol) => (
              <div key={vol.id} className="bg-cream rounded-lg border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/20 to-purple/20 flex items-center justify-center font-semibold text-purple">
                      {vol.full_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-ink">{vol.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTierColor(vol.volunteer_tier)}`}>
                          {getTierIcon(vol.volunteer_tier)} {getTierLabel(vol.volunteer_tier)}
                        </span>
                        <span className="text-xs text-muted">{vol.volunteer_department}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-ink">{vol.volunteer_hours || 0}</p>
                    <p className="text-xs text-muted">hours</p>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-2 ml-6">
                      <button className="p-2 hover:bg-warm/60 rounded-lg" title="Edit">
                        <Edit size={16} className="text-muted" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg" title="Remove">
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
