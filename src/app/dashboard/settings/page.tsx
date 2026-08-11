'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings, User, Bell, Lock } from 'lucide-react';

interface UserSettings {
  full_name: string;
  role: string;
  notifications_enabled: boolean;
  dark_mode: boolean;
  email_digest: boolean;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<UserSettings>({
    full_name: '',
    role: '',
    notifications_enabled: true,
    dark_mode: false,
    email_digest: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        setUser(user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setSettings({
            full_name: profile.full_name,
            role: profile.role,
            notifications_enabled: true,
            dark_mode: false,
            email_digest: false,
          });
        }

        setError(null);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchUserSettings();
  }, []);

  const handleSave = async () => {
    try {
      if (!user) throw new Error('Not authenticated');

      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: settings.full_name,
        })
        .eq('id', user.id);

      if (err) throw err;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setError(null);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword.length < 8) {
      setPasswordMessage('Use at least 8 characters.');
      return;
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordError) {
      setPasswordMessage(passwordError.message);
      return;
    }
    setNewPassword('');
    setPasswordMessage('Password updated successfully.');
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-muted text-lg">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-gold" />
            Settings & Preferences
          </h1>
          <p className="text-muted">Manage your account and application preferences.</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-700">
            ✓ Settings saved successfully
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-cream rounded-lg border border-border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-bold text-ink">Profile Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-muted mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={settings.full_name}
                onChange={(e) =>
                  setSettings({ ...settings, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted mb-2">
                Role
              </label>
              <input
                type="text"
                value={settings.role.charAt(0).toUpperCase() + settings.role.slice(1)}
                disabled
                className="w-full px-4 py-2 border border-border rounded-lg bg-warm/40 text-muted"
              />
              <p className="text-xs text-muted mt-1">Role cannot be changed. Contact an admin.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || 'N/A'}
                disabled
                className="w-full px-4 py-2 border border-border rounded-lg bg-warm/40 text-muted"
              />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-cream rounded-lg border border-border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-bold text-ink">Preferences</h2>
          </div>

          <div className="space-y-4">
            {/* Notifications Toggle */}
            <div className="flex items-center justify-between p-4 bg-warm/40 rounded-lg">
              <div>
                <p className="font-semibold text-ink">Notifications</p>
                <p className="text-sm text-muted">Get alerts for important updates</p>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    notifications_enabled: !settings.notifications_enabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications_enabled
                    ? 'bg-gold'
                    : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-cream transition-transform ${
                    settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-warm/40 rounded-lg">
              <div>
                <p className="font-semibold text-ink">Dark Mode</p>
                <p className="text-sm text-muted">Easier on the eyes in low light</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, dark_mode: !settings.dark_mode })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.dark_mode ? 'bg-gold' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-cream transition-transform ${
                    settings.dark_mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email Digest Toggle */}
            <div className="flex items-center justify-between p-4 bg-warm/40 rounded-lg">
              <div>
                <p className="font-semibold text-ink">Weekly Email Digest</p>
                <p className="text-sm text-muted">Summary of team activity and documents</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, email_digest: !settings.email_digest })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.email_digest ? 'bg-gold' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-cream transition-transform ${
                    settings.email_digest ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-cream rounded-lg border border-border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-bold text-ink">Security</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <p className="text-sm text-muted">Change your password whenever you need to. There is no forced first-login reset.</p>
            <label className="block text-sm font-semibold text-muted">New password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 w-full rounded-lg border border-border px-4 py-2 text-ink outline-none focus:ring-2 focus:ring-gold" />
            </label>
            {passwordMessage && <p className="text-sm text-muted">{passwordMessage}</p>}
            <button className="rounded-lg bg-purple px-4 py-2 font-semibold text-white hover:bg-purple-lt">Update password</button>
          </form>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-gold hover:bg-purple text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Save Changes
          </button>
          <button className="flex-1 bg-border hover:bg-border text-ink font-semibold py-3 px-6 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
