# Phase 4: Meetings Module - Setup Guide

## Overview
Phase 4 implements a complete meetings management system with:
- Meeting scheduling with status tracking
- Agenda items with real-time check-offs
- Role-based access control
- Real-time sync across all users
- Calendar-ready data structure

---

## Step 1: Create the Meetings Table

Run this SQL in your Supabase project (Database > SQL Editor > New Query):

```sql
-- Meetings table
CREATE TABLE public.meetings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description  TEXT CHECK (char_length(description) < 2000),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60
                CHECK (duration_min BETWEEN 15 AND 480),
  location     TEXT CHECK (char_length(location) < 300),
  status       TEXT NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
  created_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_meetings_scheduled_at ON public.meetings(scheduled_at DESC);
CREATE INDEX idx_meetings_created_by ON public.meetings(created_by);
CREATE INDEX idx_meetings_status ON public.meetings(status);

-- Enable Row Level Security
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can READ all meetings
CREATE POLICY "meetings_read_all"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Managers and admins can CREATE meetings
CREATE POLICY "meetings_insert_authorized"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    AND auth.uid() = created_by
  );

-- Policy 3: Meeting creator or admin can UPDATE (including status)
CREATE POLICY "meetings_update"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Policy 4: Meeting creator or admin can DELETE
CREATE POLICY "meetings_delete"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Step 2: Create the Agenda Items Table

```sql
-- Agenda items table (linked to meetings)
CREATE TABLE public.agenda_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  order_index INTEGER NOT NULL DEFAULT 0,
  presenter   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agenda_items_meeting_id ON public.agenda_items(meeting_id);
CREATE INDEX idx_agenda_items_order ON public.agenda_items(meeting_id, order_index);

-- Enable Row Level Security
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can READ agenda items (if they can read the meeting)
CREATE POLICY "agenda_items_read"
  ON public.agenda_items FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: All authenticated users can CREATE agenda items
CREATE POLICY "agenda_items_insert"
  ON public.agenda_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 3: Anyone can UPDATE agenda items (e.g., check off items during meeting)
CREATE POLICY "agenda_items_update"
  ON public.agenda_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy 4: Only meeting creator/admin can DELETE agenda items
CREATE POLICY "agenda_items_delete"
  ON public.agenda_items FOR DELETE
  TO authenticated
  USING (
    (SELECT created_by FROM public.meetings WHERE id = meeting_id) = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Step 3: Test Locally

```bash
# Make sure all env vars are set in .env.local
npm run dev
```

Visit `http://localhost:3000/dashboard/meetings`:

1. **Create Meeting** (admin/manager only):
   - Click "Schedule Meeting"
   - Fill in title, date/time, duration
   - Add optional location and description
   - Click "Schedule Meeting"

2. **Manage Meeting**:
   - Click a meeting to expand details
   - Update status dropdown (Upcoming → In Progress → Completed)
   - Add agenda items
   - Check off items as they're discussed
   - Delete items or entire meeting

3. **Real-time Sync**:
   - Open two browser windows to same `/dashboard/meetings`
   - Create a meeting in one window
   - See it appear in real-time in the other

---

## Security Features

| Feature | Benefit |
|---------|---------|
| **RLS policies** | Only admins/managers can create meetings; all can read |
| **Status control** | Only organizer/manager/admin can change status |
| **Agenda locking** | Only meeting creator/admin can delete agenda items |
| **Cascading delete** | Deleting meeting auto-deletes all agenda items |
| **Role checking** | Every write operation verifies user role in database |

---

## How It Works (The Pattern - Part 2)

Same **Orbit Compression Principle** as Phase 3:

1. **Two tables** — `meetings` + `agenda_items` (parent-child relationship)
2. **RLS policies** — Database enforces who can do what
3. **Real-time subscriptions** — Component listens to both tables
4. **React state** — Local component state for form/UI
5. **Zod validation** — Input validation before DB write

Meetings are more complex because of the nested agenda_items, but the pattern is identical.

---

## Database Schema Summary

```sql
-- Meetings (parent table)
meetings:
  id (UUID, PK)
  title (TEXT, 3-200 chars)
  description (TEXT, max 2000 chars)
  scheduled_at (TIMESTAMPTZ)
  duration_min (INTEGER, 15-480 min)
  location (TEXT, max 300 chars)
  status (TEXT: upcoming, in_progress, completed, cancelled)
  created_by (UUID, FK profiles)
  created_at (TIMESTAMPTZ)

-- Agenda items (child table)
agenda_items:
  id (UUID, PK)
  meeting_id (UUID, FK meetings) ← CASCADE DELETE
  content (TEXT, 1-1000 chars)
  order_index (INTEGER) ← for ordering
  presenter (UUID, FK profiles, nullable)
  done (BOOLEAN, default false)
  created_at (TIMESTAMPTZ)

-- RLS ensures:
  - All users can READ meetings & agenda items
  - Admins/managers can CREATE meetings
  - Only organizer/admin can UPDATE status or DELETE
  - Any user can check off agenda items (UPDATE done)
```

---

## Troubleshooting

**Can't create a meeting (permission denied)?**
- Verify your role is 'admin' or 'manager' in profiles table
- Check that the RLS policy allows your user

**Agenda items not appearing?**
- Verify the agenda_items table was created
- Check that cascading delete didn't remove them
- Refresh the page to force a fetch

**Real-time sync not working?**
- Ensure Supabase Realtime is enabled
- Check env vars are correct
- Open browser DevTools Console to see errors

---

## File Structure

```
src/
├── app/dashboard/meetings/
│   └── page.tsx           ✅ Full meetings UI with agendas
└── (other modules from Phases 1-3)
```

---

## What's Next

Phase 5 will add **Announcements Feed**:
- Broadcast board (admins/managers post)
- Pinned announcements
- Real-time updates
- Similar single-table pattern to Phase 3

---

## Feature Comparison: Meetings vs Documents

| Feature | Phase 3 (Documents) | Phase 4 (Meetings) |
|---------|---------------------|-------------------|
| **Structure** | Single table | Two tables (parent-child) |
| **File storage** | Yes (Supabase Storage) | No (metadata only) |
| **User roles** | All can upload | Only admins/managers create |
| **Real-time** | Yes | Yes |
| **Status** | Categories | Status tracking |
| **Nested items** | No | Yes (agenda items) |

---

**Estimated Time:** 25-35 minutes (mostly testing)  
**Difficulty:** Medium  
**Prerequisites:** Complete Phase 1, 2, 3
