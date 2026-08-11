'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileUp, FileDown, Calendar, MessageSquare, Pin, Trash2, LogIn, LogOut, Eye, Filter } from 'lucide-react';

interface ActivityEntry {
  id: string;
  user_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
}

interface AdminNotification {
  id: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

const actionIcons: Record<string, React.ReactNode> = {
  document_upload: <FileUp className="w-4 h-4 text-blue-500" />,
  document_download: <FileDown className="w-4 h-4 text-green-500" />,
  document_delete: <Trash2 className="w-4 h-4 text-red-500" />,
  meeting_create: <Calendar className="w-4 h-4 text-purple-500" />,
  meeting_update: <Calendar className="w-4 h-4 text-purple-400" />,
  meeting_delete: <Trash2 className="w-4 h-4 text-red-500" />,
  announcement_post: <MessageSquare className="w-4 h-4 text-orange-500" />,
  announcement_pin: <Pin className="w-4 h-4 text-amber-500" />,
  announcement_unpin: <Pin className="w-4 h-4 text-gray-400" />,
  announcement_delete: <Trash2 className="w-4 h-4 text-red-500" />,
  login: <LogIn className="w-4 h-4 text-green-600" />,
  logout: <LogOut className="w-4 h-4 text-gray-500" />,
};

const actionLabels: Record<string, string> = {
  document_upload: 'Uploaded Document',
  document_download: 'Downloaded Document',
  document_delete: 'Deleted Document',
  meeting_create: 'Created Meeting',
  meeting_update: 'Updated Meeting',
  meeting_delete: 'Deleted Meeting',
  agenda_item_add: 'Added Agenda Item',
  agenda_item_update: 'Updated Agenda Item',
  agenda_item_delete: 'Deleted Agenda Item',
  announcement_post: 'Posted Announcement',
  announcement_pin: 'Pinned Announcement',
  announcement_unpin: 'Unpinned Announcement',
  announcement_delete: 'Deleted Announcement',
  login: 'Logged In',
  logout: 'Logged Out',
  user_invite: 'Invited User',
  user_role_change: 'Changed User Role',
  settings_update: 'Updated Settings',
};

function formatActionLabel(actionType: string, details?: Record<string, unknown>): string {
  const baseLabel = actionLabels[actionType] || actionType;
  
  if (details?.fileName) {
    return `${baseLabel}: ${details.fileName}`;
  }
  if (details?.title) {
    return `${baseLabel}: "${details.title}"`;
  }
  
  return baseLabel;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityLogPage() {
  const supabase = createClient();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [deletionNotices, setDeletionNotices] = useState<AdminNotification[]>([]);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // DPOs need this read-only audit view for incident review; RLS enforces it too.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'dpo'].includes(profile.role)) {
        setError('Only administrators and the Data Protection Officer can view the activity log');
        setLoading(false);
        return;
      }

      setUserRole(profile.role);
      if (profile.role === 'admin') {
        const { data: notices } = await supabase
          .from('admin_notifications')
          .select('id, payload, created_at, read_at')
          .eq('event_type', 'content_deleted')
          .order('created_at', { ascending: false })
          .limit(10);
        setDeletionNotices(notices || []);
      }
      await fetchActivities();
    };

    checkAccess();
  }, []);

  async function fetchActivities(filter = selectedFilter, range = dateRange) {
    try {
      let startDate = new Date();

      switch (range) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      const query = supabase
        .from('activity_log')
        .select(`
          *
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error: err } = await query;

      if (err) throw err;

      // The compatibility migration upgrades older actor_id/action/meta rows,
      // but normalize them here as well so the audit view remains usable while
      // a project is awaiting that deployment.
      const normalized = (data || []).map((entry: any) => entry.user_id ? entry : ({
        ...entry,
        user_id: entry.actor_id || '',
        action_type: entry.action || 'activity',
        resource_type: entry.target_type || 'system',
        resource_id: entry.target_id || null,
        details: entry.meta || {},
      })) as ActivityEntry[];
      setActivities(filter === 'all' ? normalized : normalized.filter((entry) => entry.action_type === filter));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userRole || !['admin', 'dpo'].includes(userRole)) return;

    const channel = supabase
      .channel('activity-log-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          setActivities((prev) => [payload.new as ActivityEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'admin') return;

    const channel = supabase
      .channel('admin-deletion-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, (payload) => {
        setDeletionNotices((current) => [payload.new as AdminNotification, ...current].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  async function markNoticeRead(id: string) {
    const { error: updateError } = await supabase
      .from('admin_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (!updateError) {
      setDeletionNotices((current) => current.map((notice) =>
        notice.id === id ? { ...notice, read_at: new Date().toISOString() } : notice,
      ));
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-red-400">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex items-center justify-center">
        <div className="text-slate-300 text-lg">Loading activity log...</div>
      </div>
    );
  }

  const actionTypes = Array.from(
    new Set(activities.map((a) => a.action_type))
  ).sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Eye className="w-8 h-8 text-blue-400" />
            Activity Log & Audit Trail
          </h1>
          <p className="text-slate-400">
            Track all user actions across the platform. This is an append-only log for compliance and security.
          </p>
        </div>

        {userRole === 'admin' && deletionNotices.length > 0 && (
          <section className="mb-8 rounded-lg border border-amber-400/30 bg-amber-400/10 p-5">
            <h2 className="text-lg font-semibold text-amber-100">Deletion notices</h2>
            <div className="mt-3 space-y-2">
              {deletionNotices.map((notice) => {
                const title = typeof notice.payload.title === 'string' ? notice.payload.title : 'Untitled content';
                const resourceType = typeof notice.payload.resource_type === 'string' ? notice.payload.resource_type.replace(/_/g, ' ') : 'content';
                return (
                  <div key={notice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-950/30 px-3 py-2 text-sm">
                    <p className={notice.read_at ? 'text-slate-400' : 'font-medium text-white'}>
                      {title} ({resourceType}) was removed and retained in the archive.
                    </p>
                    {!notice.read_at && <button onClick={() => markNoticeRead(notice.id)} className="rounded border border-amber-300/50 px-2 py-1 text-xs font-semibold text-amber-100">Mark read</button>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Date Range Filter */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                <Filter className="w-4 h-4 inline mr-2" />
                Time Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as any);
                  setLoading(true);
                  fetchActivities(selectedFilter, e.target.value as typeof dateRange);
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Action Type
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => {
                  setSelectedFilter(e.target.value);
                  setLoading(true);
                  fetchActivities(e.target.value, dateRange);
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              >
                <option value="all">All Actions</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {actionLabels[type] || type}
                  </option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div className="flex items-end">
              <div>
                <p className="text-sm text-slate-400 mb-2">Total Entries</p>
                <p className="text-3xl font-bold text-blue-400">{activities.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-lg p-8 text-center">
              <Eye className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No activities found</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-lg p-4 hover:border-slate-600/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {actionIcons[activity.action_type] || <Eye className="w-4 h-4 text-slate-500" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className="font-semibold text-white">
                        {formatActionLabel(activity.action_type, activity.details)}
                      </p>
                      <time className="text-sm text-slate-400 flex-shrink-0">
                        {formatDate(activity.created_at)}
                      </time>
                    </div>
                    <p className="text-sm text-slate-400">
                      <span className="font-medium text-slate-300">{activity.details?.volunteer_name ? `Volunteer (${String(activity.details.volunteer_name)})` : activity.user_name || 'Team member'}</span>
                      {activity.ip_address && (
                        <span className="ml-3 text-slate-500">IP: {activity.ip_address}</span>
                      )}
                    </p>

                    {/* Details */}
                    {Object.keys(activity.details || {}).length > 0 && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-900/40 rounded px-3 py-2">
                        {Object.entries(activity.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-400">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-slate-800/20 border border-slate-700/20 rounded-lg p-4 text-center text-sm text-slate-400">
          <p>
            This activity log is <strong>append-only</strong> — entries cannot be deleted. This ensures compliance and audit trail integrity.
          </p>
        </div>
      </div>
    </div>
  );
}
