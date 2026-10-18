# Intern profile execution plan

This is the sequenced implementation plan for the attached task after the prerequisite `feat/intern-access` work is restored.

1. **Re-orient and freeze contracts**
   - Read the prior migration, role gates, staff directory function, provisioning/offboarding scripts, route/API checks and tests.
   - Record all intern-touched tables and routes.
   - Confirm hard-locked tables and the existing notification mechanism.
2. **Catalogue and data model**
   - Add the additive catalogue, intern profile, grants, presets, requests, audit, journal, feedback and review tables.
   - Add indexes, restrictive RLS and security-definer RPCs with fixed search paths.
   - Seed the registry and presets; add a TypeScript/SQL parity test.
3. **Shared enforcement**
   - Add one request-scoped intern context helper.
   - Map routes and APIs to effective features.
   - Add restrictive policies and function guards for every touched table and storage path.
   - Fail closed if catalogue tables or functions are unavailable.
4. **Admin experience**
   - Add the Interns list and detail screens.
   - Implement status, expiry, preset, toggle, request decision, activity and effective-access controls.
   - Keep managers and DPO read-only unless the restored implementation and product decision explicitly permit otherwise.
5. **Intern experience**
   - Add locked-feature and access-summary pages.
   - Implement journal, feedback, review notes, directory, reports/policies, task and document extensions according to feature gates.
   - Add expiry and access-ended states.
6. **Scripts and regression protection**
   - Update create, extend, seed and offboard scripts with dry-run defaults and `--apply`.
   - Add database privilege matrix, hard-lock, request, preset, parity, route/API, UI and staff regression tests.
7. **Documentation and deployment**
   - Add catalogue, enforcement map, data model, admin guide, manual QA and deployment runbook.
   - Run locally or in staging only, never against a hosted production database.
