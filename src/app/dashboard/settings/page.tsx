'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings, User, Bell, Moon, Lock, ChevronRight } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-slate-600 text-lg">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-pink-600" />
            Settings & Preferences
          </h1>
          <p className="text-slate-600">Manage your account and application preferences.</p>
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-pink-600" />
            <h2 className="text-xl font-bold text-slate-900">Profile Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={settings.full_name}
                onChange={(e) =>
                  setSettings({ ...settings, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Role
              </label>
              <input
                type="text"
                value={settings.role.charAt(0).toUpperCase() + settings.role.slice(1)}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-slate-600"
              />
              <p className="text-xs text-slate-500 mt-1">Role cannot be changed. Contact an admin.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || 'N/A'}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-pink-600" />
            <h2 className="text-xl font-bold text-slate-900">Preferences</h2>
          </div>

          <div className="space-y-4">
            {/* Notifications Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Notifications</p>
                <p className="text-sm text-slate-600">Get alerts for important updates</p>
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
                    ? 'bg-pink-600'
                    : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Dark Mode</p>
                <p className="text-sm text-slate-600">Easier on the eyes in low light</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, dark_mode: !settings.dark_mode })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.dark_mode ? 'bg-pink-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.dark_mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email Digest Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Weekly Email Digest</p>
                <p className="text-sm text-slate-600">Summary of team activity and documents</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, email_digest: !settings.email_digest })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.email_digest ? 'bg-pink-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.email_digest ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-pink-600" />
            <h2 className="text-xl font-bold text-slate-900">Security</h2>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
              <div className="text-left">
                <p className="font-semibold text-slate-900">Change Password</p>
                <p className="text-sm text-slate-600">Update your login credentials</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
              <div className="text-left">
                <p className="font-semibold text-slate-900">Two-Factor Authentication</p>
                <p className="text-sm text-slate-600">Add extra security to your account</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
              <div className="text-left">
                <p className="font-semibold text-slate-900">Active Sessions</p>
                <p className="text-sm text-slate-600">Manage your login sessions</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Save Changes
          </button>
          <button className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
