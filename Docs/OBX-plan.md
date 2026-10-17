# OBX Implementation Plan

## Existing contracts mapped

- Next.js 16 App Router uses `src/proxy.ts` to refresh Supabase Auth and gate selected dashboard paths. Public `/obx` pages and APIs need an early bypass, while `/dashboard/onboarding` needs an explicit `admin`, `manager`, `dpo` gate in both proxy and server page.
- Browser and server Supabase clients use the publishable key and SSR cookies. OBX data access will use a separate server-only service-role client, with all authorisation performed in handlers before privileged operations.
- `volunteer_profiles` is keyed by `profile_id` and currently contains tier, department, status, join date and hours. The roster will reference it optionally without modifying it.
- Existing RLS role checks query `public.profiles` inline. `activity_log` uses `user_id`, `action_type`, `resource_type`, `resource_id`, and `details`; anonymous OBX completion cannot truthfully attribute an authenticated hub actor, so the completion audit event will use the documented canonical log contract with a nullable actor.
- Migration workflow is imperative timestamped SQL under `supabase/migrations`; `config.toml` has no declarative schema paths. Existing brand tokens already match the requested colours and fonts.

## Files to add or change

### Foundation
- Add additive migrations for OBX roster/progress/answer/rate-limit tables, indexes, constraints, grants, and management-only RLS policies.
- Add server-only OBX config, roster normalisation, session signing, service-role client, role checks, scoring, content keys, and data access helpers under `src/lib/obx/`.
- Add public typed English content under `src/content/obx/en/` and launch placeholders/config under `src/content/obx/config.ts`.
- Add `/api/obx/*` session, progress, answer, completion, sign-off, stop-five, and sign-out handlers.
- Update `src/proxy.ts` for public OBX bypass and management-only onboarding route access.

### Learner experience and reward
- Add isolated `src/app/obx/layout.tsx`, welcome, trail, and badge routes, with client components for the six interactions, progress map, drawers, SVG badge, certificate, and Pocket Card.
- Add OBX styles in `src/app/globals.css` only where reusable design tokens or reduced-motion rules are needed.

### Management and hub integration
- Add `/dashboard/onboarding` server page and management components/API handlers for roster, import, progress, insights, reset, and export.
- Update `src/components/Sidebar.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/volunteers/page.tsx`, and `src/app/login/page.tsx` for navigation, summary, roster status, and the OBX entry point.
- Add a server-only activity log writer that preserves the existing activity log schema and handles anonymous completion honestly.

### Verification and hand-off
- Add unit tests for normalisation, scoring, session tamper/expiry, and rate limiting; add a fake-only seed script using NKV-900 onward and SQL access assertions for `anon` and ordinary authenticated users.
- Add `docs/OBX-plan.md` (this plan), `docs/OBX.md`, and `docs/OBX-operations.md` with review checklist, setup, migration order, and operational instructions.
- Update `package.json` scripts only if required; add no runtime dependencies.

## Delivery order

1. Foundation and security contracts, then build and lint.
2. Learner trail and draft content, then build and lint.
3. Badge, certificate, Pocket Card and completion routing, then build and lint.
4. Management views, proxy/page gates, activity logging and directory integration, then build and lint.
5. Login action, accessibility/performance polish, requested tests and final documentation.

All safeguarding and organisational facts remain explicitly marked as draft or verify-before-launch. Live Supabase migration, role-denial, and browser-flow claims will be reported only if actually verified against the relevant environment.
