'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Clock, Award, FileText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { formatRole } from '@/lib/utils';

export default function VolunteerProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    setSaveError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          volunteer_department: form.volunteer_department,
        })
        .eq('id', user.id);

      if (error) { setSaveError(error.message); return; }

      setProfile(form);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(`Error: ${err}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Profile" description="Your volunteer information" />

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-700 font-medium">✓ Profile saved successfully</p>
        </div>
      )}
      {saveError && (
        <div className="bg-rust/10 border border-rust rounded-lg p-4 mb-6">
          <p className="text-sm text-rust font-medium">{saveError}</p>
        </div>
      )}

      {/* Profile Card — NK Udada design tokens */}
      <div className="card mb-6">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-border">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/20 to-purple/20 flex items-center justify-center font-bold text-2xl text-gold serif-display">
            {profile?.full_name?.[0] ?? '?'}
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Volunteer Status</p>
            <p className="text-xl font-bold text-ink">{formatRole(profile?.volunteer_tier)}</p>
            {profile?.volunteer_join_date && (
              <p className="text-sm text-muted mt-1">
                Member since {new Date(profile.volunteer_join_date).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Department</label>
              <input
                type="text"
                value={form.volunteer_department || ''}
                onChange={(e) => setForm({ ...form, volunteer_department: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-gold outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="btn-primary">Save Changes</button>
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted">Full Name</span>
              <span className="text-sm font-semibold text-ink">{profile?.full_name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted">Department</span>
              <span className="text-sm font-semibold text-ink">{profile?.volunteer_department || 'Not specified'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted">Email</span>
              <span className="text-sm font-semibold text-ink">{profile?.email}</span>
            </div>
            <button onClick={() => setEditing(true)} className="btn-secondary">Edit Profile</button>
          </div>
        )}
      </div>

      {/* Stats — NK Udada tokens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Volunteer Hours</p>
              <p className="text-3xl font-bold text-ink">{profile?.volunteer_hours || 0}</p>
            </div>
            <Clock className="w-10 h-10 text-gold/30" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Tier Level</p>
              <p className="text-lg font-bold text-ink">{formatRole(profile?.volunteer_tier) || 'Volunteer'}</p>
            </div>
            <Award className="w-10 h-10 text-purple/30" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Status</p>
              <p className="text-lg font-bold text-ink capitalize">{profile?.volunteer_status || 'active'}</p>
            </div>
            <FileText className="w-10 h-10 text-gold/30" />
          </div>
        </div>
      </div>

      {/* Journey card — NK Udada branding */}
      <div className="card bg-gradient-to-br from-purple/5 to-gold/5 border-gold/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-purple flex items-center justify-center text-white font-bold text-xs serif-display shrink-0">
            NK
          </div>
          <h2 className="font-bold text-ink serif-display">About Your Volunteer Journey</h2>
        </div>
        <p className="text-muted leading-relaxed mb-4 text-sm">
          Thank you for being part of the NK Udada team! As a volunteer, you're contributing to real change in communities across Uganda — empowering young women through education, health, and opportunity.
        </p>
        <div className="space-y-3">
          {[
            { label: 'Structured Support', desc: 'We provide training and mentorship to help you grow' },
            { label: 'Real Impact', desc: "Your work directly affects young people's lives" },
            { label: 'Community', desc: 'Be part of a passionate team of changemakers' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-gold font-bold mt-0.5">✓</span>
              <div>
                <p className="font-semibold text-ink text-sm">{label}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
