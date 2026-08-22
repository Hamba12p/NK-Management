'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Filter, Mail, Badge, Calendar } from 'lucide-react';
import HubIcon from '@/components/HubIcon';
import { EmptyLedger } from '@/components/BrandIllustrations';
import { teamMembers } from '@/lib/team-structure';

type ProfileRole = 'admin' | 'manager' | 'dpo' | 'volunteer' | 'volunteer_senior' | 'volunteer_lead';

interface TeamMember {
  id: string;
  full_name: string;
  email?: string;
  job_title?: string;
  account_type?: 'person' | 'organization' | 'shared';
  display_tag?: string;
  display_color?: string;
  role: string;
  avatar_url?: string;
  created_at?: string;
}

const roleColors: Record<ProfileRole, { bg: string; text: string; border: string }> = {
  admin: {
    bg: 'bg-rust/10',
    text: 'text-rust',
    border: 'border-rust/25',
  },
  manager: {
    bg: 'bg-purple/10',
    text: 'text-purple',
    border: 'border-purple/25',
  },
  dpo: {
    bg: 'bg-purple-lt/15',
    text: 'text-purple',
    border: 'border-purple-lt/35',
  },
  volunteer_lead: {
    bg: 'bg-gold/10',
    text: 'text-purple',
    border: 'border-gold/30',
  },
  volunteer_senior: {
    bg: 'bg-green/10',
    text: 'text-green',
    border: 'border-green/20',
  },
  volunteer: {
    bg: 'bg-warm/40',
    text: 'text-muted',
    border: 'border-border',
  },
};

const roleBadgeColors: Record<ProfileRole, { bg: string; text: string }> = {
  admin: {
    bg: 'bg-rust/15',
    text: 'text-rust',
  },
  manager: {
    bg: 'bg-purple/10',
    text: 'text-purple',
  },
  dpo: {
    bg: 'bg-purple-lt/20',
    text: 'text-purple',
  },
  volunteer_lead: {
    bg: 'bg-gold/15',
    text: 'text-purple',
  },
  volunteer_senior: {
    bg: 'bg-green/10',
    text: 'text-green',
  },
  volunteer: {
    bg: 'bg-warm/60',
    text: 'text-ink',
  },
};

const roleLabels: Record<ProfileRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  dpo: 'DPO',
  volunteer_lead: 'Volunteer Lead',
  volunteer_senior: 'Senior Volunteer',
  volunteer: 'Volunteer',
};

const roleDescriptions: Record<ProfileRole, string> = {
  admin: 'Full access to all features and audit logs',
  manager: 'Can create meetings and post announcements',
  dpo: 'Manages data protection processing activities and requests',
  volunteer_lead: 'Coordinates volunteers and can view team activity',
  volunteer_senior: 'Elevated volunteer with additional hour-tracking access',
  volunteer: 'Can view and download documents',
};

function normalizeRole(role?: string): ProfileRole {
  return role && role in roleColors ? role as ProfileRole : 'volunteer';
}

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | ProfileRole>('all');
  const [totalCount, setTotalCount] = useState(0);

  async function fetchMembers() {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      setMembers(data || []);
      setTotalCount(data?.length || 0);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The initial remote fetch intentionally hydrates the client-side directory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMembers();
  }, []);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMembers((prev) => [payload.new as TeamMember, ...prev]);
            setTotalCount((prev) => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            setMembers((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as TeamMember) : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
            setTotalCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter members
  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = member.full_name.toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query);
    const matchesRole = selectedRole === 'all' || normalizeRole(member.role) === selectedRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-muted text-lg">Loading team members...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="serif-display text-4xl text-ink mb-2 flex items-center gap-3">
            <HubIcon name="team" className="h-8 w-8 text-purple" />
            Team Directory
          </h1>
          <p className="text-muted">
            View and search all staff members. {totalCount} team {totalCount === 1 ? 'member' : 'members'} total.
          </p>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                Search by Name
              </label>
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-muted mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Filter by Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="dpo">DPOs</option>
                <option value="volunteer_lead">Volunteer Leads</option>
                <option value="volunteer_senior">Senior Volunteers</option>
                <option value="volunteer">Volunteers</option>
              </select>
            </div>

            {/* Stats */}
            <div className="flex items-end">
              <div>
                <p className="text-sm text-muted mb-2">Showing Results</p>
                <p className="serif-display text-3xl text-purple">{filteredMembers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="record-surface mb-8 bg-rust/10 p-4 text-rust">
            {error}
          </div>
        )}

        {/* Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.length === 0 ? (
            <div className="record-surface col-span-full p-12 text-center">
              <EmptyLedger variant="ledger" className="empty-illustration mx-auto mb-4" />
              <p className="text-muted text-lg">No team members found</p>
              {searchQuery && (
                <p className="text-muted text-sm mt-2">
                  Try adjusting your search terms
                </p>
              )}
            </div>
          ) : (
            filteredMembers.map((member) => {
              const role = normalizeRole(member.role);
              const rosterMember = teamMembers.find(item => item.name === member.full_name);
              const accountType = member.account_type || (member.full_name === 'Volunteers' ? 'shared' : member.full_name === 'Admin' ? 'organization' : 'person');
              return (
              <div
                key={member.id}
                className="record-surface bg-cream p-6"
              >
                {/* Avatar & Name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="creator-avatar" data-color={member.display_color || 'burgundy'}>{member.display_tag || rosterMember?.avatar || member.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-ink truncate">
                        {member.full_name}
                      </h3>
                      <div className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        roleBadgeColors[role].bg
                      } ${roleBadgeColors[role].text}`}>
                        <Badge className="w-3 h-3 inline mr-1" />
                        {roleLabels[role]}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3 pt-4 border-t border-current border-opacity-10">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted flex-shrink-0" />
                    <span className="text-muted truncate">
                      {accountType === 'shared' ? 'Shared volunteer login' : member.email || rosterMember?.email || (accountType === 'organization' ? 'Organization account' : 'Email pending profile sync')}
                    </span>
                  </div>

                  {member.created_at && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-muted flex-shrink-0" />
                      <span className="text-muted">
                        Joined {new Date(member.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Role Badge (larger, for reference) */}
                <div className="mt-4 pt-4 border-t border-current border-opacity-10">
                  <p className="text-xs text-muted uppercase tracking-wide">Role Details</p>
                  <p className={`mt-1 text-sm font-medium ${roleColors[role].text}`}>
                    {member.job_title || rosterMember?.title || roleDescriptions[role]}
                  </p>
                </div>
              </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-muted">
          <p className="text-sm">
            Total staff members: <strong>{totalCount}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
