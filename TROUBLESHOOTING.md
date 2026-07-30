# NK Management App - Troubleshooting Guide

## Quick Fixes for Common Issues

### 1. Turbopack Compilation Errors
**Symptoms:** "An unexpected Turbopack error occurred"

**Solutions:**
- Clear the `.next` build cache: `rm -r .next`
- Restart the dev server
- Check for duplicate config files (only one next.config file should exist)
- Verify all imports are correctly resolved

**Prevention:**
- Only keep `next.config.mjs` (delete any `next.config.js`)
- Use valid Next.js 16 configuration options only
- Avoid experimental features unless necessary

### 2. Build Cache Issues
**Symptoms:** Stale code being served, changes not reflecting

**Solutions:**
```bash
rm -r .next
npm run dev
```

### 3. Missing Environment Variables
**Symptoms:** Supabase connection errors

**Verify `.env.local` has (see `.env.local.example` — these are the only two vars the app reads):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 4. Module Resolution Issues
**Symptoms:** "Cannot find module" errors

**Check:**
- Path aliases in `tsconfig.json` are correct
- All imports use the `@/` prefix for local files
- No circular imports
- TypeScript compilation is clean

### 5. Slow Filesystem (Network Drive)
**Warning:** "Slow filesystem detected. The benchmark took 205ms."

**Solutions:**
- Move project to local SSD if possible
- Or ignore if working on network intentionally

### 6. Authentication Issues
**Symptoms:** Redirect loops, unauthorized errors

**Check:**
- Middleware is correctly configured
- Environment variables are set
- Supabase session is valid
- Cookies are being set properly

## Server Status Commands
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process on port 3000 (Windows)
taskkill /PID <PID> /F

# Full clean rebuild
rm -r .next node_modules
npm install
npm run dev
```

## Files to Keep Clean
- Keep ONLY `next.config.mjs` (delete any `.js` version)
- Middleware configurations should be single source of truth
- Environment files should never be committed

## Prevention Checklist
- [ ] Only one Next config file exists
- [ ] No experimental/invalid options in config
- [ ] Environment variables are loaded
- [ ] TypeScript has no errors
- [ ] Middleware is working (or migrated to proxy)
- [ ] Build cache is clean if issues occur
