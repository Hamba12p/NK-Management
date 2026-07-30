'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, TrendingUp, Users, FileText, Calendar, Download } from 'lucide-react';

interface Analytics {
  totalUsers: number;
  totalDocuments: number;
  totalMeetings: number;
  totalAnnouncements: number;
  recentActivityCount: number;
  avgDocumentsPerUser: number;
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    totalDocuments: 0,
    totalMeetings: 0,
    totalAnnouncements: 0,
    recentActivityCount: 0,
    avgDocumentsPerUser: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role !== 'admin') {
          setError('Only admins can view analytics');
          setLoading(false);
          return;
        }

        // Fetch counts
        const [
          { count: userCount },
          { count: docCount },
          { count: meetingCount },
          { count: announcementCount },
          { count: activityCount },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('documents').select('*', { count: 'exact', head: true }),
          supabase.from('meetings').select('*', { count: 'exact', head: true }),
          supabase.from('announcements').select('*', { count: 'exact', head: true }),
          supabase.from('activity_log').select('*', { count: 'exact', head: true }),
        ]);

        setAnalytics({
          totalUsers: userCount || 0,
          totalDocuments: docCount || 0,
          totalMeetings: meetingCount || 0,
          totalAnnouncements: announcementCount || 0,
          recentActivityCount: activityCount || 0,
          avgDocumentsPerUser: (docCount || 0) / Math.max(1, userCount || 1),
        });

        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Only admins can access analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (error) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-muted text-lg">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Users,
      label: 'Total Staff',
      value: analytics.totalUsers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: FileText,
      label: 'Documents',
      value: analytics.totalDocuments,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      icon: Calendar,
      label: 'Meetings',
      value: analytics.totalMeetings,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      icon: TrendingUp,
      label: 'Announcements',
      value: analytics.totalAnnouncements,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-gold" />
            Analytics & Reporting
          </h1>
          <p className="text-muted">Platform usage statistics and team activity insights.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`${card.bg} rounded-lg border border-border shadow-sm p-6`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-muted">{card.label}</h3>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted mt-2">Total count</p>
              </div>
            );
          })}
        </div>

        {/* Key Metrics */}
        <div className="bg-cream rounded-lg border border-border shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-ink mb-6">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-warm/40 rounded-lg">
              <p className="text-sm text-muted mb-1">Avg Documents per Staff</p>
              <p className="text-2xl font-bold text-ink">
                {analytics.avgDocumentsPerUser.toFixed(1)}
              </p>
            </div>
            <div className="p-4 bg-warm/40 rounded-lg">
              <p className="text-sm text-muted mb-1">Total Activity Log Entries</p>
              <p className="text-2xl font-bold text-ink">{analytics.recentActivityCount}</p>
            </div>
            <div className="p-4 bg-warm/40 rounded-lg">
              <p className="text-sm text-muted mb-1">Meetings per Staff</p>
              <p className="text-2xl font-bold text-ink">
                {(analytics.totalMeetings / Math.max(1, analytics.totalUsers)).toFixed(1)}
              </p>
            </div>
            <div className="p-4 bg-warm/40 rounded-lg">
              <p className="text-sm text-muted mb-1">Data Collected</p>
              <p className="text-2xl font-bold text-ink">
                {(
                  (analytics.totalDocuments +
                    analytics.totalMeetings +
                    analytics.totalAnnouncements +
                    analytics.recentActivityCount)
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Reports */}
        <div className="bg-cream rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-xl font-bold text-ink mb-6">Generate Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center justify-between p-4 bg-warm/40 hover:bg-warm/60 rounded-lg border border-border transition-colors">
              <div className="text-left">
                <p className="font-semibold text-ink">Usage Report</p>
                <p className="text-sm text-muted">Platform activity and engagement</p>
              </div>
              <Download className="w-5 h-5 text-muted" />
            </button>
            <button className="flex items-center justify-between p-4 bg-warm/40 hover:bg-warm/60 rounded-lg border border-border transition-colors">
              <div className="text-left">
                <p className="font-semibold text-ink">Team Report</p>
                <p className="text-sm text-muted">Staff activity and contributions</p>
              </div>
              <Download className="w-5 h-5 text-muted" />
            </button>
            <button className="flex items-center justify-between p-4 bg-warm/40 hover:bg-warm/60 rounded-lg border border-border transition-colors">
              <div className="text-left">
                <p className="font-semibold text-ink">Document Report</p>
                <p className="text-sm text-muted">File uploads and downloads</p>
              </div>
              <Download className="w-5 h-5 text-muted" />
            </button>
            <button className="flex items-center justify-between p-4 bg-warm/40 hover:bg-warm/60 rounded-lg border border-border transition-colors">
              <div className="text-left">
                <p className="font-semibold text-ink">Audit Report</p>
                <p className="text-sm text-muted">Security and compliance log</p>
              </div>
              <Download className="w-5 h-5 text-muted" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
