# 🚀 Quick Start — Phase 0 Complete

Your NK Udada Hub is ready. Follow these 4 steps to get running.

## Step 1: Set Up Supabase (5 minutes)

1. Go to https://supabase.com and sign in (or create account)
2. Click **"New Project"**
3. Fill in:
   - Name: `nk-udada-hub`
   - Region: **South Africa (Cape Town)** ← Important!
   - Database Password: Save this somewhere safe
4. Wait for project to create (~1 min)
5. Go to **Settings > API** and copy:
   - `Project URL` → save as `NEXT_PUBLIC_SUPABASE_URL`
   - `Anon Key` → save as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Service Role Key` → save as `SUPABASE_SERVICE_ROLE_KEY`

## Step 2: Add Credentials Locally (2 minutes)

```bash
# Navigate to project directory
cd "d:\PROBOOK\NK Management\nk-udada-hub"

# Create .env.local from template
cp .env.local.example .env.local
```

Open `.env.local` in VS Code and paste your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
RESEND_API_KEY=re_... (leave blank for now, only needed in Phase 8)
NEXT_PUBLIC_APP_URL=https://app.the-nkfoundation.org
```

⚠️ **IMPORTANT:** Never commit `.env.local` — it's already in `.gitignore`

## Step 3: Run Development Server (1 minute)

```bash
npm run dev
```

You should see:
```
> nk-udada-hub@0.1.0 dev
> next dev

  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000
```

Open browser to **http://localhost:3000** — you should see the Phase 0 status page ✓

## Step 4: Verify Everything Works (2 minutes)

Check that you see:
- ✓ All 8 green checkmarks on the home page
- ✓ "Phase 0 — Foundation Setup Complete" header
- ✓ "All configurations ready" message
- ✓ Next Steps section with 4 action items

If you see any errors, check:
- [ ] `.env.local` has correct Supabase URL and keys
- [ ] Supabase project was created in South Africa (Cape Town) region
- [ ] You're in the correct directory: `nk-udada-hub`

---

## What's Installed?

✅ Next.js 14 with TypeScript  
✅ Tailwind CSS  
✅ Supabase (real-time database)  
✅ Security headers (CSP, HSTS)  
✅ Route middleware (auth protection)  
✅ GitHub Actions (security audits)

---

## Next: Phase 1

Once you verify the dev server runs, you're ready for **Phase 1 — Authentication & User Management**.

This will add:
- 🔐 Magic link login (no passwords)
- 👥 User profiles with roles
- 📝 Dashboard layout
- 🚪 Sign out functionality

See `PHASE_0_README.md` for detailed documentation.

---

## Troubleshooting

### Port 3000 already in use?
```bash
# Use a different port
npm run dev -- -p 3001
```

### Environment variables not loading?
1. Stop the dev server (Ctrl+C)
2. Delete `.next/` folder
3. Restart: `npm run dev`

### Can't connect to Supabase?
1. Check Supabase project is active (green status in dashboard)
2. Verify `.env.local` credentials match exactly
3. Try opening Supabase dashboard URL directly in browser

### Still stuck?
See `PHASE_0_README.md` for the full troubleshooting guide, or contact:  
**admin@the-nkfoundation.org**

---

**You're all set! Next step: `npm run dev` and proceed to Phase 1.**
