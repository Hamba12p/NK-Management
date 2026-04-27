'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Clock, Award, FileText } from 'lucide-react';

export default function VolunteerProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(data);
        setForm(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          volunteer_department: form.volunteer_department,
        })
        .eq('id', user.id);

      setProfile(form);
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  const getTierLabel = (tier: string) => {
    if (tier === 'volunteer_lead') return '👑 Volunteer Lead';
    if (tier === 'volunteer_senior') return '⭐ Senior Volunteer';
    return '🌟 Volunteer';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <User className="w-8 h-8 text-pink-600" />
          My Volunteer Profile
        </h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border p-8 mb-6">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center font-bold text-2xl text-pink-700">
            {profile?.full_name?.[0] ?? '?'}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Volunteer Status</p>
            <p className="text-2xl font-bold text-slate-900">{getTierLabel(profile?.volunteer_tier)}</p>
            <p className="text-sm text-gray-600 mt-2">Member since {new Date(profile?.volunteer_join_date).toLocaleDateString()}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Department</label>
              <input
                type="text"
                value={form.volunteer_department || ''}
                onChange={(e) => setForm({ ...form, volunteer_department: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">
                Save Changes
              </button>
              <button onClick={() => setEditing(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">Full Name</p>
              <p className="text-lg font-medium text-slate-900">{profile?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Department</p>
              <p className="text-lg font-medium text-slate-900">{profile?.volunteer_department || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Email</p>
              <p className="text-lg font-medium text-slate-900">{profile?.email}</p>
            </div>
            <button onClick={() => setEditing(true)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Volunteer Hours</p>
              <p className="text-3xl font-bold text-slate-900">{profile?.volunteer_hours || 0}</p>
            </div>
            <Clock className="w-10 h-10 text-pink-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tier Level</p>
              <p className="text-lg font-bold text-slate-900">{profile?.volunteer_tier === 'volunteer_lead' ? 'Lead' : profile?.volunteer_tier === 'volunteer_senior' ? 'Senior' : 'Volunteer'}</p>
            </div>
            <Award className="w-10 h-10 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-lg font-bold text-slate-900 capitalize">{profile?.volunteer_status || 'active'}</p>
            </div>
            <FileText className="w-10 h-10 text-green-200" />
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-100 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">About Your Volunteer Journey</h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          Thank you for being part of the NK Udada team! As a volunteer, you're contributing to real change in communities across Uganda.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-pink-600 font-bold">✓</span>
            <div>
              <p className="font-medium text-slate-900">Structured Support</p>
              <p className="text-sm text-gray-600">We provide training and mentorship to help you grow</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-pink-600 font-bold">✓</span>
            <div>
              <p className="font-medium text-slate-900">Real Impact</p>
              <p className="text-sm text-gray-600">Your work directly affects young people's lives</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-pink-600 font-bold">✓</span>
            <div>
              <p className="font-medium text-slate-900">Community</p>
              <p className="text-sm text-gray-600">Be part of a passionate team of changemakers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
