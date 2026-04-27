# Phase 7: Team Directory - Setup Guide

## Overview
Phase 7 implements a searchable team directory with:
- View all staff members at a glance
- Search by name (real-time filtering)
- Filter by role (admin, manager, member)
- Member profile cards with contact info
- Join date tracking
- Real-time sync as staff members are added
- Role-based capability descriptions

This phase reuses the existing `profiles` table from Phase 1 — no new database table needed.

---

## Database Setup

### RLS Policies (Already Exist from Phase 1)

The `profiles` table already has RLS policies that allow:
- All authenticated users to READ (SELECT) profiles
- Users can only UPDATE their own profile
- Admins can UPDATE any profile

**Verify these policies exist in Supabase:**

```sql
-- Policy 1: All authenticated users can READ (SELECT) profiles
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%read%';

-- Should return:
-- policyname: "profiles_read_all"
-- QUAL: (true) -- All users can read

-- Policy 2: Users can UPDATE their own profile
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%update%';

-- Should return:
-- policyname: "profiles_update_own"
-- QUAL: (auth.uid() = id) -- Only own profile
```

**If policies are missing, run:**

```sql
-- Policy 1: All authenticated users can READ profiles
CREATE POLICY "profiles_read_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Users can UPDATE their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Only admins can UPDATE other profiles
CREATE POLICY "profiles_admin_update_any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy 4: Only admins can DELETE profiles
CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Step 1: Verify Profiles Table

The `profiles` table should exist from Phase 1 with this structure:

```sql
-- Check if table exists and has correct structure
\d public.profiles

-- Expected columns:
-- id (UUID, PRIMARY KEY)
-- full_name (TEXT, NOT NULL)
-- role (TEXT, CHECK role IN ('admin', 'manager', 'member'))
-- avatar_url (TEXT, optional)
-- created_at (TIMESTAMPTZ, NOT NULL)
-- updated_at (TIMESTAMPTZ, NOT NULL)
```

**If the table is missing or incomplete, create it:**

```sql
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies (from above)
```

---

## Step 2: Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000/dashboard/team`:

1. **Page Loads:**
   - See "Team Directory" header
   - Search box appears
   - Role filter dropdown appears
   - Member count displayed

2. **Display Members:**
   - See cards for all staff members
   - Each card shows:
     - Initials avatar (colored)
     - Full name
     - Role badge (color-coded)
     - Join date
   - Cards are organized in a responsive grid

3. **Search:**
   - Type a name in search box
   - Members filter in real-time
   - Result count updates
   - Clear search to see all

4. **Filter by Role:**
   - Select "Admins" → see only admins
   - Select "Managers" → see only managers
   - Select "Members" → see only members
   - Select "All Roles" → see everyone
   - Filters combine with search

5. **Real-time Sync:**
   - Open Team Directory in two browser windows
   - In Supabase → Create a new staff user (or add profile)
   - See new member appear instantly in both windows

---

## Step 3: Add New Team Members (via Supabase)

To add staff members to the directory, create new profiles in Supabase.

### Option A: Via Supabase Dashboard

1. Go to Supabase → Database → profiles table
2. Click "Insert" → "Insert new row"
3. Fill in:
   - `id`: Leave blank (auto-generated from auth.users)
   - `full_name`: Staff member's full name
   - `role`: Select from dropdown (admin, manager, member)
   - `avatar_url`: Leave blank (optional)
4. Click "Save"

### Option B: Via SQL Script

```sql
-- Create a new staff member with admin role
INSERT INTO public.profiles (id, full_name, role)
VALUES (gen_random_uuid(), 'Naira Kateregga', 'admin');

-- Create a manager
INSERT INTO public.profiles (id, full_name, role)
VALUES (gen_random_uuid(), 'Jane Smith', 'manager');

-- Create a team member
INSERT INTO public.profiles (id, full_name, role)
VALUES (gen_random_uuid(), 'John Doe', 'member');
```

---

## Features Explained

### Search
- **Real-time filtering** by full name
- Case-insensitive matching
- Results update instantly as you type
- Works while filtering by role

### Role Filter
- **Admin:** Full access, can view audit logs
- **Manager:** Can create meetings and post announcements
- **Member:** Can view and download documents
- Descriptions appear on each card

### Member Cards
- **Avatar:** Colored circle with member's initials
- **Name:** Full name displayed prominently
- **Role Badge:** Color-coded (red=admin, blue=manager, gray=member)
- **Contact Info:** Email address (if available)
- **Join Date:** When member joined the organization
- **Role Description:** What that role can do

### Real-time Updates
- New members appear instantly
- Updated profile info syncs live
- Deleted members removed from view
- Via Supabase Realtime subscriptions

---

## Security & Access

| User Type | Can See | Can Search | Can Filter |
|-----------|---------|-----------|-----------|
| Authenticated | All members | Yes | Yes |
| Non-authenticated | — | — | — |
| Admin | All members | Yes | Yes |
| Manager | All members | Yes | Yes |
| Member | All members | Yes | Yes |

**Key:** All authenticated staff can view the team directory. This promotes transparency and team cohesion.

---

## Database Schema

```sql
profiles (from Phase 1):
  id (UUID, PK, FK auth.users)
  full_name (TEXT, NOT NULL)
  role (TEXT: admin | manager | member)
  avatar_url (TEXT, optional)
  created_at (TIMESTAMPTZ)
  updated_at (TIMESTAMPTZ)

RLS Policies:
  - SELECT: All authenticated users
  - INSERT: Created via auth signup
  - UPDATE: User's own profile OR admin for any
  - DELETE: Admin only
```

---

## UI Components

### Search Box
```
[Search team members...]
```

### Role Filter
```
[All Roles ▼]
  - All Roles
  - Admins
  - Managers
  - Members
```

### Member Card
```
╔═══════════════════════════════╗
║  [Avatar] Name               ║
║           Admin Role         ║
║                              ║
║  📧 email@domain.com         ║
║  📅 Joined Sep 15, 2024      ║
║                              ║
║  Role Details                ║
║  Full access to all features ║
╚═══════════════════════════════╝
```

---

## File Structure

```
Created Files:
  src/app/dashboard/team/page.tsx     — Team directory page (~340 lines)
  PHASE_7_SETUP.md                    — This setup guide

Updated Files:
  src/components/Sidebar.tsx          — Already includes Team link
  COMPLETE_IMPLEMENTATION_SUMMARY.md  — Will be updated with Phase 7
```

---

## How It Works

### 1. Fetch Members
- Component loads and calls `supabase.from('profiles').select('*')`
- Returns all staff members ordered by join date (newest first)
- No filtering on backend — all filtering happens on frontend

### 2. Real-time Subscription
- Component subscribes to `profiles` table changes
- On INSERT: Add new member to list
- On UPDATE: Update member card in place
- On DELETE: Remove member from list
- All updates appear instantly in real-time

### 3. Search & Filter
- User types in search box → filters by name (client-side)
- User selects role → filters by role (client-side)
- Both filters combine (AND logic)
- Result count updates

### 4. Display
- Grid layout (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each member shown as a card with:
  - Avatar with initials
  - Name and role badge
  - Join date
  - Role capabilities description
- Empty state if no results

---

## Testing Checklist

- [ ] `/dashboard/team` page loads successfully
- [ ] See all team members displayed in cards
- [ ] Search by name filters members in real-time
- [ ] Role filter works (Admin, Manager, Member, All)
- [ ] Combining search + role filter works
- [ ] Result counter updates correctly
- [ ] Member card shows correct role badge colors
- [ ] Join dates formatted correctly
- [ ] Open in two browsers, add new member in one → appears in other
- [ ] Empty state displays when no results
- [ ] Mobile layout is responsive
- [ ] Initials avatar displays correctly for each member

---

## Comparison: All Seven Phases

| Phase | Feature | Tables | Visibility | Real-time |
|-------|---------|--------|-----------|-----------|
| 1 | Authentication | 1 (profiles) | User only | — |
| 2 | Navigation | 0 (UI only) | All | — |
| 3 | Documents | 1 + storage | Role-based | ✅ |
| 4 | Meetings | 2 | Role-based | ✅ |
| 5 | Announcements | 1 | All read | ✅ |
| 6 | Audit Log | 1 | Admin only | ✅ |
| **7** | **Team Directory** | **1 (profiles)** | **All** | **✅** |

---

## What Phase 7 Adds

### Core Capability
✅ View all staff members at a glance  
✅ Search by name  
✅ Filter by role (admin, manager, member)  
✅ Real-time sync as staff members are added  
✅ Join date tracking  

### User Experience
✅ Responsive grid layout  
✅ Color-coded role badges  
✅ Member initials avatars  
✅ Contact info display  
✅ Role capability descriptions  
✅ Live filtering and search  

---

## Troubleshooting

**No team members showing?**
- Verify profiles table exists and has data
- Check RLS policy allows SELECT for authenticated users
- Query: `SELECT * FROM profiles;` in Supabase SQL

**Search not working?**
- Make sure you're typing in the search box
- Filtering is case-insensitive
- Try searching partial names

**Real-time not updating?**
- Refresh page to verify data is there
- Check browser console for errors
- Verify Supabase Realtime is enabled

**Members not appearing?**
- Go to Supabase → insert test profile manually
- Verify profiles table has correct structure
- Check RLS policies are correct

---

## Next Steps (Future Phases)

### Phase 8: Settings & Preferences
- User profile settings
- Notification preferences
- Dark mode toggle
- Language selection

### Phase 9: Advanced Features
- Meeting recordings
- Document versioning
- Calendar integration
- Export capabilities

### Phase 10: Mobile App
- React Native app
- Offline support
- Push notifications
- Mobile-optimized UI

---

**Estimated Time:** 15-20 minutes (setup + testing)  
**Difficulty:** Easy (mostly UI, uses existing profiles table)  
**Prerequisites:** Complete Phases 1-6  

---

## Summary

Phase 7 adds a **searchable team directory** to your platform:
- Lists all staff members
- Filters by name and role
- Real-time updates
- Professional card-based layout
- Complete team transparency

Your team can now easily find colleague information and understand each other's roles!

This phase uses the existing `profiles` table from Phase 1, so there's no database migration needed — just implement the UI component and you're done.
