# NK Udada Hub — UI Redesign & Simplification Instructions
## For Claude Haiku — Execute All Changes Precisely

---

## CONTEXT

You are working on **NK Udada Hub**, a Next.js 15 App Router + TypeScript + Tailwind CSS + Supabase staff dashboard for a Ugandan NGO. The codebase lives in `src/`. The design system uses custom CSS variables defined in `globals.css`. All pages are in `src/app/dashboard/`.

**Do not change any Supabase query logic, authentication logic, zod validation, or realtime subscription code. Only change visual structure, layout, and styling.**

---

## PROBLEM SUMMARY

1. **Dual navigation bug** — Both `Header.tsx` (fixed top bar) AND `Sidebar.tsx` exist simultaneously. They both render the NK Udada logo. This is redundant and visually broken.
2. **Style inconsistency** — `team/page.tsx` and `settings/page.tsx` use generic Tailwind slate/blue/gray colors instead of the project's design system variables.
3. **Dashboard home shows `—` placeholders** instead of real live counts from the database.
4. **Header causes broken layout spacing** — `main` has `pt-16` to avoid the fixed header, creating awkward gaps.
5. **Loading states are inconsistent** across pages.
6. **Settings page has three fake toggle switches** (dark_mode, notifications_enabled, email_digest) that don't save to the database and mislead users.
7. **Pages lack a unified page header pattern** — every page invents its own h1/description structure differently.

---

## DESIGN SYSTEM REFERENCE

These are the ONLY colors, fonts, and component classes you are allowed to use. Never use Tailwind's built-in `slate-`, `blue-`, `red-`, `gray-` color classes except for error states (`red-`).

```css
/* CSS Variables already defined in globals.css */
--ink: #0A0A0A        /* primary text */
--cream: #FEFEFE      /* page background */
--warm: #FFF0F8       /* soft pink tint, used for hover/subtle bg */
--gold: #EA519D       /* primary accent (pink) — use for highlights, CTAs */
--gold-lt: #F5A0C5    /* lighter gold for hover states */
--purple: #8B2C6B     /* secondary accent — use for roles, badges */
--purple-lt: #C46AA6  /* lighter purple */
--muted: #5F5F5F      /* secondary text */
--border: #E9DFE6     /* dividers and card borders */
--rust: #B84C1A       /* error states only */

/* Tailwind tokens already extended in tailwind.config.ts */
bg-cream, bg-warm, bg-gold, bg-purple
text-ink, text-muted, text-gold, text-purple
border-border
```

```css
/* Component classes already defined in globals.css */
.card           /* white card, rounded-2xl, border-border, shadow-sm */
.btn-primary    /* purple background, white text, rounded-full, px-8 py-3 */
.btn-secondary  /* transparent, border-border, rounded-full */
.serif-display  /* Playfair Display, weight 900 */
```

**Role badge colors** — use these everywhere roles appear:
- `admin` → `bg-purple/20 text-purple`
- `manager` → `bg-gold/20 text-gold`
- `member` → `bg-border text-muted`
- `volunteer` / `volunteer_senior` / `volunteer_lead` → `bg-green-100 text-green-700`

---

## CHANGE 1 — Remove the Header Component from the Layout

**File: `src/app/dashboard/layout.tsx`**

The `Header` component must be removed. The Sidebar already handles navigation and branding. Delete the Header import and the `<Header>` JSX. Remove `pt-16` from `<main>` since there is no longer a fixed top bar.

Replace the entire file with exactly this:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
```

---

## CHANGE 2 — Create a Reusable PageHeader Component

**File to CREATE: `src/components/PageHeader.tsx`**

Every dashboard page will use this component for its top section. Create the file with exactly this content:

```tsx
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-ink serif-display mb-1">{title}</h1>
        {description && (
          <p className="text-muted text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-6">{action}</div>}
    </div>
  )
}
```

---

## CHANGE 3 — Create a Reusable EmptyState Component

**File to CREATE: `src/components/EmptyState.tsx`**

```tsx
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-warm flex items-center justify-center mb-4">
        <Icon size={24} className="text-gold" />
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-muted max-w-xs">{description}</p>
    </div>
  )
}
```

---

## CHANGE 4 — Dashboard Home: Fetch Real Counts

**File: `src/app/dashboard/page.tsx`**

The dashboard home currently shows `—` (em dashes) as stat numbers. Replace the entire file with a version that fetches real counts from the database. Preserve the exact visual layout (4-card grid + 2-column bottom section) but populate actual numbers.

Replace the entire file with:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, FileText, Bell, Users, ArrowRight } from 'lucide-react'

export default async function DashboardHome() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: profile },
    { count: docCount },
    { count: announcementCount },
    { count: meetingCount },
    { count: teamCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('meetings').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const dateStr = new Date().toLocaleDateString('en-UG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div>
      {/* Welcome */}
      <div className="mb-10">
        <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">{dateStr}</p>
        <h1 className="text-4xl font-bold text-ink serif-display">
          Good to see you, <span className="text-gold">{firstName}</span>
        </h1>
        <p className="text-muted mt-2 text-sm">Here's what's happening at NK Udada today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card group hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
              <FileText size={18} className="text-gold" />
            </div>
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Docs</span>
          </div>
          <p className="text-3xl font-bold text-ink serif-display">{docCount ?? 0}</p>
          <a href="/dashboard/documents" className="inline-flex items-center gap-1 text-xs font-semibold text-gold mt-3 hover:text-gold-lt transition-colors">
            Browse <ArrowRight size={12} />
          </a>
        </div>

        <div className="card group hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple/10 flex items-center justify-center">
              <Bell size={18} className="text-purple" />
            </div>
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Updates</span>
          </div>
          <p className="text-3xl font-bold text-ink serif-display">{announcementCount ?? 0}</p>
          <a href="/dashboard/announcements" className="inline-flex items-center gap-1 text-xs font-semibold text-purple mt-3 hover:text-purple-lt transition-colors">
            View all <ArrowRight size={12} />
          </a>
        </div>

        <div className="card group hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
              <Calendar size={18} className="text-gold" />
            </div>
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Meetings</span>
          </div>
          <p className="text-3xl font-bold text-ink serif-display">{meetingCount ?? 0}</p>
          <a href="/dashboard/meetings" className="inline-flex items-center gap-1 text-xs font-semibold text-gold mt-3 hover:text-gold-lt transition-colors">
            Upcoming <ArrowRight size={12} />
          </a>
        </div>

        <div className="card group hover:-translate-y-1 transition-transform">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple/10 flex items-center justify-center">
              <Users size={18} className="text-purple" />
            </div>
            <span className="text-xs font-medium text-muted uppercase tracking-wider">Team</span>
          </div>
          <p className="text-3xl font-bold text-ink serif-display">{teamCount ?? 0}</p>
          <a href="/dashboard/team" className="inline-flex items-center gap-1 text-xs font-semibold text-purple mt-3 hover:text-purple-lt transition-colors">
            Directory <ArrowRight size={12} />
          </a>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-base font-bold text-ink serif-display mb-4">Your Access</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted">Name</span>
              <span className="text-sm font-semibold text-ink">{profile?.full_name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted">Role</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                profile?.role === 'admin' ? 'bg-purple/20 text-purple' :
                profile?.role === 'manager' ? 'bg-gold/20 text-gold' :
                'bg-border text-muted'
              }`}>
                {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted">Status</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple/5 to-gold/5 border-gold/20">
          <h3 className="text-base font-bold text-ink serif-display mb-4">Quick Links</h3>
          <div className="space-y-2">
            {[
              { label: 'Upload a document', href: '/dashboard/documents' },
              { label: 'Post an announcement', href: '/dashboard/announcements' },
              { label: 'Schedule a meeting', href: '/dashboard/meetings' },
              { label: 'View the team', href: '/dashboard/team' },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-warm transition-colors group"
              >
                <span className="text-sm font-medium text-ink">{label}</span>
                <ArrowRight size={14} className="text-muted group-hover:text-gold transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## CHANGE 5 — Fix Team Page: Replace All Non-Design-System Colors

**File: `src/app/dashboard/team/page.tsx`**

The team page uses `bg-slate-50`, `text-slate-900`, `text-blue-700`, `border-red-200` etc. These must all be replaced with design system tokens. **Keep all data-fetching, filtering, realtime, and TypeScript logic exactly as-is.** Only change JSX className strings.

Apply these replacements throughout the file:

- `bg-gradient-to-br from-slate-50 to-slate-100` and any outer wrapper `div` with `min-h-screen` padding → remove these outer wrappers entirely; the layout already provides the page container. The component's root element should just be `<div>` with no background.
- `text-slate-900` → `text-ink`
- `text-slate-700` → `text-ink`
- `text-slate-600` → `text-muted`
- `text-slate-500` → `text-muted`
- `bg-white rounded-lg border border-gray-200 shadow-sm` → `card` (use the .card class)
- `focus:ring-pink-500` → `focus:ring-gold`
- `text-pink-600` → `text-gold`
- All loading states: replace `<div className="min-h-screen ..."><div className="... flex items-center justify-center min-h-96"><div className="text-slate-600 text-lg">Loading...</div></div></div>` with:
  ```tsx
  <div className="flex items-center justify-center py-24">
    <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
  </div>
  ```
- The three `roleColors` map entries for card backgrounds — replace with:
  ```ts
  const roleColors = {
    admin: { bg: 'bg-purple/5', text: 'text-purple', border: 'border-purple/20' },
    manager: { bg: 'bg-gold/5', text: 'text-gold', border: 'border-gold/20' },
    member: { bg: 'bg-warm', text: 'text-muted', border: 'border-border' },
  }
  ```
- The `roleBadgeColors` map — replace with:
  ```ts
  const roleBadgeColors = {
    admin: { bg: 'bg-purple/20', text: 'text-purple' },
    manager: { bg: 'bg-gold/20', text: 'text-gold' },
    member: { bg: 'bg-border', text: 'text-muted' },
  }
  ```
- The page `<h1>` — remove the `<Users>` icon from inside h1. The title should just read `Team Directory` in `text-3xl font-bold text-ink serif-display`.
- The footer `<div className="mt-12 text-center text-slate-600">` → remove it entirely; the member count is already shown in the description line.
- Import and use `PageHeader` at the top of the return, replacing the current manual header div:
  ```tsx
  import PageHeader from '@/components/PageHeader'
  // ...
  <PageHeader title="Team Directory" description={`${filteredMembers.length} of ${totalCount} members`} />
  ```

---

## CHANGE 6 — Fix Settings Page: Remove Fake Toggles

**File: `src/app/dashboard/settings/page.tsx`**

The settings page currently shows three toggle switches for `notifications_enabled`, `dark_mode`, and `email_digest`. These settings are never saved to the database — they are fake UI. Remove them entirely.

**Keep:** The profile section that lets users update their `full_name`. Keep all the `handleSave` logic. Keep the saved/error feedback.

**Remove:** The `notifications_enabled`, `dark_mode`, and `email_digest` state fields and all JSX that renders those toggles.

**Replace all non-design-system colors** using the same rules as Change 5.

The final settings page should have exactly two sections:
1. **Profile** — shows email (read-only), lets user edit full_name, has a Save button
2. **Account** — shows role (read-only with a role badge) and the account creation date

Replace the outer `min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8` wrapper div and `max-w-2xl mx-auto` inner div with just `<div>`. The layout already handles the container.

Add at the top of the JSX return:
```tsx
import PageHeader from '@/components/PageHeader'
// ...
<PageHeader title="Settings" description="Manage your profile and account details" />
```

---

## CHANGE 7 — Unify Documents Page Header

**File: `src/app/dashboard/documents/page.tsx`**

At the top of the return statement, the current manual header:
```tsx
<div className="mb-8">
  <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
  <p className="text-gray-500">Upload and manage shared files</p>
</div>
```

Replace with:
```tsx
import PageHeader from '@/components/PageHeader'
// In JSX:
<PageHeader
  title="Documents"
  description="Upload and access shared files"
/>
```

Change the upload zone border from `border-pink-200` and `hover:border-pink-400` to `border-gold/30` and `hover:border-gold`. Change `bg-pink-50` to `bg-warm`. Change `text-pink-600` to `text-gold`. Change the upload button from `from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800` to `btn-primary` class.

---

## CHANGE 8 — Unify Announcements Page Header

**File: `src/app/dashboard/announcements/page.tsx`**

Find and replace the manual h1/description block at the top of the return with:
```tsx
import PageHeader from '@/components/PageHeader'
// In JSX:
<PageHeader
  title="Announcements"
  description="Stay up to date with what's happening"
  action={canPost ? (
    <button onClick={() => setShowForm(!showForm)} className="btn-primary">
      {showForm ? 'Cancel' : '+ New'}
    </button>
  ) : undefined}
/>
```

Remove any standalone "+ New Announcement" button that currently exists elsewhere on the page, since it is now in the PageHeader action slot.

---

## CHANGE 9 — Unify Meetings Page Header

**File: `src/app/dashboard/meetings/page.tsx`**

Apply the same PageHeader pattern:
```tsx
import PageHeader from '@/components/PageHeader'
// In JSX:
<PageHeader
  title="Meetings"
  description="Upcoming meetings and agenda tracker"
  action={(profile?.role === 'admin' || profile?.role === 'manager') ? (
    <button onClick={() => setShowForm(!showForm)} className="btn-primary">
      {showForm ? 'Cancel' : '+ Schedule'}
    </button>
  ) : undefined}
/>
```

---

## CHANGE 10 — Unify Analytics, Activity Log, Advanced, Volunteer Pages

For each of these files, apply the same two changes:

1. Remove the outer `min-h-screen bg-gradient-to-br` wrapper divs. The root element becomes a plain `<div>`.
2. Replace the manual `<h1>` + `<p>` header block with `<PageHeader title="..." description="..." />`.

| File | Title | Description |
|------|-------|-------------|
| `analytics/page.tsx` | Analytics | Usage statistics across the hub |
| `activity-log/page.tsx` | Activity Log | Full audit trail of all actions |
| `advanced/page.tsx` | Advanced | Document history and exports |
| `volunteer-profile/page.tsx` | My Profile | Your volunteer information |
| `volunteer-hours/page.tsx` | My Hours | Track and log your volunteer time |
| `volunteers/page.tsx` | Volunteers | Manage volunteer team members |

Replace any `text-slate-`, `text-gray-`, `bg-slate-`, `bg-gray-`, `border-gray-` classes with design system equivalents as specified in the rules above.

---

## CHANGE 11 — Sidebar: Add Settings Link

**File: `src/components/Sidebar.tsx`**

In the `baseItems` array (visible to all roles), add a settings link at the bottom:

```ts
import { Settings } from 'lucide-react' // add to existing imports

// Add to baseItems array:
{ href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: false },
```

---

## FINAL VERIFICATION CHECKLIST

After making all changes, verify:

- [ ] No `<Header />` component is rendered anywhere in the dashboard layout
- [ ] No `pt-16` class exists on the main content wrapper
- [ ] `PageHeader` is used on every dashboard page (documents, announcements, meetings, team, settings, analytics, activity-log, advanced, volunteer-profile, volunteer-hours, volunteers)
- [ ] Dashboard home stat cards show real numbers (not `—`)
- [ ] Team page uses zero `slate-`, `blue-`, `red-`, `gray-` color classes
- [ ] Settings page has no fake toggle switches
- [ ] All pages render inside the existing layout container (no inner `min-h-screen` wrappers)
- [ ] `EmptyState` component exists at `src/components/EmptyState.tsx`
- [ ] `PageHeader` component exists at `src/components/PageHeader.tsx`
- [ ] Settings link appears in sidebar for all users

---

## DO NOT CHANGE

- Any file in `src/lib/`
- `src/middleware.ts`
- `globals.css`
- `tailwind.config.ts`
- `next.config.mjs`
- Any Supabase query, insert, update, delete, or realtime subscription
- Any zod schema or validation logic
- The `Sidebar.tsx` profile section, sign-out logic, or role-based nav logic (only add the Settings link)
- `src/app/auth/callback/route.ts`
- `src/app/login/page.tsx`
- `src/app/layout.tsx` (root layout)
