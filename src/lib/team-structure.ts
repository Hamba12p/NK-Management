/**
 * NK Udada Hub - Updated Role System
 * 
 * Roles:
 * - admin: Naira Kateregga (Founder & Coordinator) - Full system access
 * - manager: Kizito, Hamba, Balqees, Shamsa - Team leads with program oversight
 * - volunteer: Community volunteers - Limited access to their own volunteer profile
 * - volunteer_senior: Experienced volunteers - Can mentor and moderate
 * 
 * This file documents the team structure and role hierarchy.
 */

// TEAM MEMBERS (as of April 2026)
export const teamMembers = {
  admin: [
    {
      email: 'naira@the-nkfoundation.org',
      name: 'Naira Kateregga',
      title: 'Founder & Coordinator',
      role: 'admin',
      avatar: 'NK',
      color: 'var(--purple)',
      permissions: ['all'],
    },
  ],
  manager: [
    {
      email: 'kizito@the-nkfoundation.org',
      name: 'Kizito Jamal',
      title: 'General Manager',
      role: 'manager',
      avatar: 'KJ',
      color: 'var(--gold)',
      department: 'Operations',
      permissions: [
        'view_all_documents',
        'view_all_meetings',
        'view_all_announcements',
        'manage_volunteers',
        'view_activity_log',
        'export_reports',
      ],
    },
    {
      email: 'hamba@the-nkfoundation.org',
      name: 'Hamba Shabil',
      title: 'Operations & Programs Manager',
      role: 'manager',
      avatar: 'HS',
      color: 'var(--rust)',
      department: 'Programs',
      permissions: [
        'view_all_documents',
        'view_all_meetings',
        'manage_programs',
        'manage_volunteers',
        'view_activity_log',
      ],
    },
    {
      email: 'balqees@the-nkfoundation.org',
      name: 'Balqees Yasin',
      title: 'Consultations & Advisory Board Lead',
      role: 'manager',
      avatar: 'BY',
      color: 'var(--green)',
      department: 'Advisory',
      permissions: [
        'view_all_documents',
        'view_all_meetings',
        'manage_consultations',
        'view_activity_log',
      ],
    },
    {
      email: 'shamsa@the-nkfoundation.org',
      name: 'Shamsa Nantongo',
      title: 'Finance & Procurement Manager',
      role: 'manager',
      avatar: 'SN',
      color: 'var(--purple-lt)',
      department: 'Finance',
      permissions: [
        'view_all_documents',
        'manage_procurement',
        'view_finances',
        'view_activity_log',
        'export_reports',
      ],
    },
  ],
};

// VOLUNTEER TIERS
export const volunteerTiers = {
  volunteer: {
    name: 'Volunteer',
    description: 'New to the NK Udada team',
    permissions: [
      'view_public_documents',
      'view_announcements',
      'update_own_profile',
      'access_volunteer_portal',
    ],
    requirements: { hours: 0, experience: 'none' },
  },
  volunteer_senior: {
    name: 'Senior Volunteer',
    description: 'Experienced volunteer with mentoring capability',
    permissions: [
      'view_public_documents',
      'view_announcements',
      'update_own_profile',
      'access_volunteer_portal',
      'mentor_volunteers',
      'access_training_materials',
    ],
    requirements: { hours: 40, experience: 'basic' },
  },
  volunteer_lead: {
    name: 'Volunteer Lead',
    description: 'Leads volunteer initiatives and events',
    permissions: [
      'view_public_documents',
      'view_announcements',
      'update_own_profile',
      'access_volunteer_portal',
      'mentor_volunteers',
      'access_training_materials',
      'organize_volunteer_events',
      'report_volunteer_hours',
    ],
    requirements: { hours: 100, experience: 'intermediate' },
  },
};
