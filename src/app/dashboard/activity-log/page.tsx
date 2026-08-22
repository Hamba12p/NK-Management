'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileUp, FileDown, Calendar, MessageSquare, Pin, Trash2, LogIn, LogOut, Eye, Filter } from 'lucide-react';
import CreatorTag from '@/components/CreatorTag';

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
  profiles?: { full_name: string; display_tag: string | null; display_color: string | null } | null;
}

interface AdminNotification {
  id: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

const actionIcons: Record<string, React.ReactNode> = {
  document_upload: <FileUp className="w-4 h-4 text-purple" />,
  document_download: <FileDown className="w-4 h-4 text-green" />,
  document_delete: <Trash2 className="w-4 h-4 text-rust" />,
  meeting_create: <Calendar className="w-4 h-4 text-purple" />,
  meeting_update: <Calendar className="w-4 h-4 text-purple-lt" />,
  meeting_delete: <Trash2 className="w-4 h-4 text-rust" />,
  announcement_post: <MessageSquare className="w-4 h-4 text-purple" />,
  announcement_pin: <Pin className="w-4 h-4 text-gold" />,
  announcement_unpin: <Pin className="w-4 h-4 text-muted" />,
  announcement_delete: <Trash2 className="w-4 h-4 text-rust" />,
  login: <LogIn className="w-4 h-4 text-green" />,
  logout: <LogOut className="w-4 h-4 text-muted" />,
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
        .select('*, profiles!activity_log_user_id_fkey(*)')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error: err } = await query;

      if (err) throw err;

      const activities = (data || []) as ActivityEntry[];
      setActivities(filter === 'all' ? activities : activities.filter((entry) => entry.action_type === filter));
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
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="record-surface bg-rust/10 p-6 text-rust">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="text-muted text-lg">Loading activity log...</div>
      </div>
    );
  }

  const actionTypes = Array.from(
    new Set(activities.map((a) => a.action_type))
  ).sort();

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="serif-display text-4xl text-ink mb-2 flex items-center gap-3">
            <Eye className="w-8 h-8 text-purple" />
            Activity Log & Audit Trail
          </h1>
          <p className="text-muted">
            Track all user actions across the platform. This is an append-only log for compliance and security.
          </p>
        </div>

        {userRole === 'admin' && deletionNotices.length > 0 && (
          <section className="record-surface mb-8 bg-rust/10 p-5">
            <h2 className="serif-display text-xl text-ink">Deletion notices</h2>
            <div className="mt-3 space-y-2">
              {deletionNotices.map((notice) => {
                const title = typeof notice.payload.title === 'string' ? notice.payload.title : 'Untitled content';
                const resourceType = typeof notice.payload.resource_type === 'string' ? notice.payload.resource_type.replace(/_/g, ' ') : 'content';
                return (
                  <div key={notice.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-cream/70 px-3 py-2 text-sm">
                    <p className={notice.read_at ? 'text-muted' : 'font-medium text-ink'}>
                      {title} ({resourceType}) was removed and retained in the archive.
                    </p>
                    {!notice.read_at && <button onClick={() => markNoticeRead(notice.id)} className="rounded border border-rust/30 px-2 py-1 text-xs font-semibold text-rust">Mark read</button>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Date Range Filter */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted mb-3">
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
                className="w-full border border-border px-4 py-2"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted mb-3">
                Action Type
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => {
                  setSelectedFilter(e.target.value);
                  setLoading(true);
                  fetchActivities(e.target.value, dateRange);
                }}
                className="w-full border border-border px-4 py-2"
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
                <p className="text-sm text-muted mb-2">Total Entries</p>
                <p className="serif-display text-3xl text-purple">{activities.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="record-surface p-8 text-center">
              <Eye className="w-12 h-12 text-purple/35 mx-auto mb-4" />
              <p className="text-muted text-lg">No activities found</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="record-surface p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {actionIcons[activity.action_type] || <Eye className="w-4 h-4 text-muted" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <p className="font-semibold text-ink">
                        {formatActionLabel(activity.action_type, activity.details)}
                      </p>
                      <time className="text-sm text-muted flex-shrink-0">
                        {formatDate(activity.created_at)}
                      </time>
                    </div>
                    <p className="text-sm text-muted">
                      <CreatorTag profile={activity.profiles} contributorName={activity.details?.volunteer_name ? String(activity.details.volunteer_name) : null} showName />
                      {activity.ip_address && (
                        <span className="ml-3 text-muted">IP: {activity.ip_address}</span>
                      )}
                    </p>

                    {/* Details */}
                    {Object.keys(activity.details || {}).length > 0 && (
                      <div className="mt-2 rounded bg-warm/70 px-3 py-2 text-xs text-muted">
                        {Object.entries(activity.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-purple">{key}:</span> {String(value)}
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
        <div className="mt-8 border-t border-purple/20 p-4 text-center text-sm text-muted">
          <p>
            This activity log is <strong>append-only</strong> — entries cannot be deleted. This ensures compliance and audit trail integrity.
          </p>
        </div>
      </div>
    </div>
  );
}
