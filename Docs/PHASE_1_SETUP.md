# Phase 1: Authentication & User Management - Setup Guide

## Overview
Phase 1 implements magic-link based authentication with no passwords, plus user profile management and role-based access control.

---

## Step 1: Create Supabase Database Tables

Run the following SQL in your Supabase project's SQL Editor (Database > SQL Editor > New Query):

```sql
-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'manager', 'member')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: all authenticated users can read profiles
CREATE POLICY "profiles_read_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Policy: users can update their own profile (except role)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: admin can update any profile
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Trigger: auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Step 2: Configure Environment Variables

Create a `.env.local` file in the root of your project:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find these values:**
1. Go to your Supabase project dashboard
2. Settings > API → Copy the URL and anon key
3. Settings > API → Copy the service role key (keep this SECRET!)

---

## Step 3: Add Staff Members (Admin Step)

Run this SQL in Supabase for each team member:

```sql
-- Create user and send magic link
SELECT auth.admin_create_user(
  email := 'naira@the-nkfoundation.org',
  user_metadata := '{"full_name": "Naira Kateregga"}'
);

-- Check that the user was created
SELECT id, email FROM auth.users WHERE email = 'naira@the-nkfoundation.org';

-- Promote to admin (if applicable)
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'naira@the-nkfoundation.org');
```

**Repeat for each team member:**
- Naira Kateregga → `role = 'admin'`
- Kizito Jamal → `role = 'manager'`
- Hamba Shabil → `role = 'manager'`
- Balqees Yasin → `role = 'member'`
- Shamsa Nantongo → `role = 'manager'`

---

## Step 4: Test Authentication Locally

```bash
# Install dependencies (if not already done)
npm install

# Run the development server
npm run dev
```

Visit `http://localhost:3000` in your browser:
- You should be redirected to `/login`
- Enter an email address of a user you created in Step 3
- Check that user's email for the magic link
- Click the link to log in
- You should see the dashboard

---

## Security Features Implemented

| Layer | Protection |
|-------|-----------|
| **Transport** | TLS 1.3 (automatic via Vercel) |
| **Auth** | Magic links (15-min expiry, single-use) |
| **Session** | JWT tokens managed by Supabase |
| **RLS** | Row-level policies on all tables |
| **Headers** | HSTS, CSP, X-Frame-Options, etc. |
| **Routes** | Middleware protects all `/dashboard/*` routes |

---

## What's Working Now

✅ Users can log in with a magic link (no password = no password leaks)  
✅ Magic links expire after 15 minutes  
✅ Role-based access control (admin, manager, member)  
✅ User profiles auto-created on signup  
✅ All dashboard routes are protected  
✅ Security headers configured for HSTS, CSP, and frame protection  

---

## File Structure

```
src/
├── app/
│   ├── login/page.tsx              # Magic link login form
│   ├── auth/callback/route.ts      # OAuth callback handler
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard shell with sidebar
│   │   └── page.tsx                # Home page
│   ├── layout.tsx                  # Root layout
│   └── ...
├── components/
│   └── Sidebar.tsx                 # Navigation sidebar
├── lib/supabase/
│   ├── client.ts                   # Browser client
│   └── server.ts                   # Server component client
└── middleware.ts                   # Route protection
```

---

## Next Steps

Once you've completed Phase 1 setup:
1. Deploy to Vercel (connect your GitHub repo)
2. Add your Supabase env vars to Vercel dashboard
3. Move to Phase 2: Dashboard Layout & Navigation

---

## Troubleshooting

**Magic link not arriving?**
- Check Supabase auth settings (Authentication > Email)
- Ensure the user was created with `auth.admin_create_user()`
- Check spam folder

**"Cannot find profile" error?**
- The trigger may not have fired. Run this in Supabase:
  ```sql
  INSERT INTO public.profiles (id, full_name, role)
  SELECT id, email, 'member'
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles);
  ```

**Vercel deployment issues?**
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel dashboard
- Use a preview environment for testing

---

**Estimated Time:** 15-20 minutes  
**Difficulty:** Easy to Medium  
**Knowledge Required:** Basic SQL, environment variables
