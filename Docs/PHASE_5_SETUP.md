# Phase 5: Announcements Feed - Setup Guide

## Overview
Phase 5 implements a broadcast announcement system with:
- Admin/manager-only posting
- Pinned announcements (appear at top)
- Real-time sync across all users
- All staff can read
- Simple single-table pattern (similar to Phase 3)

---

## Step 1: Create the Announcements Table

Run this SQL in your Supabase project (Database > SQL Editor > New Query):

```sql
-- Announcements table
CREATE TABLE public.announcements (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title     TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body      TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_announcements_pinned ON public.announcements(pinned DESC, created_at DESC);
CREATE INDEX idx_announcements_author_id ON public.announcements(author_id);
CREATE INDEX idx_announcements_created_at ON public.announcements(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can READ all announcements
CREATE POLICY "announcements_read_all"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Only admins and managers can CREATE announcements
CREATE POLICY "announcements_insert_authorized"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    AND auth.uid() = author_id
  );

-- Policy 3: Only announcement author or admin can UPDATE (e.g., pin/unpin)
CREATE POLICY "announcements_update"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy 4: Only announcement author or admin can DELETE
CREATE POLICY "announcements_delete"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Step 2: Test Locally

```bash
# Make sure all env vars are set in .env.local
npm run dev
```

Visit `http://localhost:3000/dashboard/announcements`:

1. **Post Announcement** (admin/manager only):
   - Click "Post Announcement"
   - Fill in title and message
   - Optionally check "Pin this announcement"
   - Click "Post Announcement"

2. **Manage Announcements**:
   - Click pin icon (📌) to toggle pinned status
   - Pinned announcements appear at the top
   - Click trash icon (🗑️) to delete
   - Only author or admin can manage

3. **Real-time Sync**:
   - Open two browser windows
   - Post announcement in one
   - See it appear instantly in the other

---

## Security Features

| Feature | Benefit |
|---------|---------|
| **Role check on INSERT** | Only admins/managers can post |
| **Author/admin on UPDATE** | Only original author or admin can pin |
| **Author/admin on DELETE** | Only original author or admin can delete |
| **All can READ** | Transparency — all staff see all announcements |
| **RLS enforcement** | Database enforces rules, can't bypass from client |

---

## How It Works (The Pattern - Simplified)

Same **Orbit Compression Principle** as Phase 3 & 4, but simpler:

1. **One table** — `announcements` (no nested children)
2. **RLS policies** — Database enforces who can post/manage
3. **Real-time subscriptions** — Component listens for changes
4. **React state** — Local component state for form/UI
5. **Zod validation** — Input validation before DB write

Announcements are the simplest module: just text content, no files or nested tables.

---

## Database Schema

```sql
announcements:
  id (UUID, PK)
  title (TEXT, 3-200 chars)
  body (TEXT, 1-5000 chars)
  pinned (BOOLEAN, default false)
  author_id (UUID, FK profiles)
  created_at (TIMESTAMPTZ)

RLS ensures:
  - All users can READ
  - Only admins/managers can INSERT
  - Only author/admin can UPDATE (pin/unpin)
  - Only author/admin can DELETE
```

---

## UI Features

**Announcement Card:**
- Title + body text (preserves line breaks)
- Author name and timestamp
- Pin icon (amber background when pinned)
- Delete button (for author/admin)
- Pinned announcements sorted to top

**Create Form:**
- Title input (3-200 chars)
- Body textarea (1-5000 chars)
- Pin checkbox
- Error messages for validation
- Success message on post

**Sorting:**
- Pinned announcements appear first
- Within pinned/unpinned, ordered by newest first

---

## Troubleshooting

**Can't post announcements (permission denied)?**
- Verify your role is 'admin' or 'manager' in profiles table
- Check that the RLS policy allows your user to INSERT

**Pin button not appearing?**
- You must be the author or an admin to see pin/delete buttons
- Check your profile role

**Announcements not updating in real-time?**
- Ensure Supabase Realtime is enabled
- Check env vars are correct in `.env.local`
- Open browser DevTools Console to see errors

**Old announcements not showing?**
- The query fetches all announcements regardless of date
- If missing, check RLS policies aren't blocking SELECT

---

## File Structure

```
src/
├── app/dashboard/announcements/
│   └── page.tsx           ✅ Announcements feed UI
└── (other modules from Phases 1-4)
```

---

## Comparison: All Five Phases

| Phase | Feature | Complexity | Tables | Roles |
|-------|---------|-----------|--------|-------|
| 1 | Authentication | Simple | 1 (profiles) | 3 (admin, manager, member) |
| 2 | Navigation | Simple | 0 (UI only) | All |
| 3 | Documents | Medium | 1 (documents) + Storage | All upload; others can read |
| 4 | Meetings | Complex | 2 (meetings + agenda_items) | Admin/manager create; all view |
| 5 | Announcements | Simple | 1 (announcements) | Admin/manager post; all read |

---

## What's Implemented Across All Phases

### Authentication & Access
✅ Magic link auth (Phase 1)  
✅ Role-based permissions (Phases 1-5)  
✅ Row-Level Security on all tables (Phases 1-5)  
✅ Route protection middleware (Phase 1)  

### Features
✅ Upload & manage documents (Phase 3)  
✅ Schedule & track meetings (Phase 4)  
✅ Manage agendas in real-time (Phase 4)  
✅ Post & pin announcements (Phase 5)  

### Real-time Capabilities
✅ Live document list updates (Phase 3)  
✅ Live meeting/agenda changes (Phase 4)  
✅ Live announcement feed (Phase 5)  
✅ Sidebar user profile sync (Phase 2)  

### Security
✅ HTTPS headers (HSTS, CSP, X-Frame-Options)  
✅ Magic links (no passwords)  
✅ Signed URLs for files (15-min expiry)  
✅ RLS policies on every table  
✅ Input validation (Zod schemas)  

---

## Next Steps (Future Phases)

### Phase 6: Activity Log & Audit Trail
- Append-only activity log table
- Track all significant actions
- Privacy-focused logging

### Phase 7: Team Directory
- View all staff members
- Roles and contact info
- Search and filter

### Phase 8: Settings & Preferences
- User profile settings
- Notification preferences
- Dark mode toggle

---

**Estimated Time:** 15-20 minutes (setup + testing)  
**Difficulty:** Easy (simplest phase)  
**Prerequisites:** Complete Phase 1, 2, 3, 4
