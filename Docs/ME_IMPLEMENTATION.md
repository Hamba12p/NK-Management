# M&E and Board Advisory implementation

Status: implemented in the working tree and verified locally on 2026-09-23. No production migrations, deployment, commit, or push were performed. Hub and Learners were not modified.

## Migrations in order

1. `20260922170751_restrict_document_visibility.sql` (from the preceding visibility task): adds `documents.visibility`, retains the `standard` default, replaces only the document and Storage SELECT policies, and limits restricted reads to admin/board_advisor. Storage matches `documents.file_path` to `storage.objects.name`. Unmatched and deleted document objects are unreadable.
2. `20260922171213_add_board_advisor_role.sql`: changes only the profiles role CHECK constraint, adding board_advisor to the six existing roles.
3. `20260922171215_me_board_advisory.sql`: creates programs, program_kpis, kpi_measurements, findings, risks, evidence_links and board_reports; adds three nullable task source foreign keys; adds role policies, explicit grants and indexes. There is no DELETE grant/policy on the seven new tables.

Apply the complete existing migration chain in order through the repository's normal release process. Assign board_advisor through trusted profile administration after the role migration; the existing signup trigger and user-provisioning workflows were not modified.

## Files created

- `src/app/dashboard/me/page.tsx`
- `src/app/dashboard/me/programs/page.tsx`
- `src/app/dashboard/me/programs/[id]/page.tsx`
- `src/app/dashboard/me/findings/page.tsx`
- `src/app/dashboard/me/risks/page.tsx`
- `src/app/dashboard/me/reports/page.tsx`
- `src/app/dashboard/me/documents/[id]/page.tsx`
- `src/components/me/MEFrame.tsx`
- `src/components/me/RecordList.tsx`
- `src/components/me/EvidencePanel.tsx`
- `src/lib/me/client.ts`
- `src/lib/me/types.ts`
- `src/lib/me/report.ts`
- The three migrations above.
- `supabase/tests/document_visibility.sql` (preceding task), `supabase/tests/me_bootstrap.sql`, `supabase/tests/me_access.sql`.
- `scripts/test-me-report.mjs`, `scripts/me-ui-fixture.mjs`.
- `artifacts/me/overview-desktop.png`, `artifacts/me/reports-mobile.png`, `artifacts/me/risks-mobile.png` (local fixture screenshots).
- This handoff document.

## Existing files changed

- `src/proxy.ts`: gates both `/dashboard/me` and descendants to admin/board_advisor.
- `src/components/Sidebar.tsx`: adds M&E & Board for those roles and shared Meetings navigation for board advisors.
- `src/lib/utils.ts`: human-readable Board Advisor label.

## Behavior

Programme CRUD uses attributed soft deletion. Programme details include KPI create/edit/archive, measurement create/edit/archive and a numeric delta between the latest two readings, findings, risks, actions, and evidence. Finding and risk editors provide programme/level/status filters, soft deletion, source associations, evidence links, and conversion into the existing task system. Every successful module write calls the existing activity logger.

New evidence and report uploads explicitly insert `visibility: 'restricted'`. Attaching an existing document does not change that document's visibility. Module activity details omit confidential descriptions and file names. Shared tasks require a separately entered title and do not copy private descriptions. Duplicate conversion is prevented by partial unique indexes.

The report generator pages through query results and chunks KPI ID filters. It uses UTC reporting boundaries: findings/risks created in the period, the latest KPI reading whose period ends within the period, and currently open M&E tasks created before the day after period end. Overdue is evaluated against period end. Statuses are current at generation, not reconstructed historical states; the report states this explicitly. The persisted snapshot captures its methodology, totals, KPI readings, findings, risks, and actions.

DOCX output uses the existing docx library and Packer.toBlob, uploads as category report, records the board_report, logs `generate` / `board_report`, and downloads via a temporary object URL. The saved link opens the existing DocumentModal through an additional M&E document route, with a link to the existing repository. A failed board_report write can retry with the same document ID and report ID in the current page session.

## Deviations and permission conflict

- Measurements, evidence links, and board reports also receive `deleted_at` and `deleted_by`, which were omitted from their field lists but are required by the all-new-tables soft-deletion instruction. Authorized roles can SELECT retained rows; normal UI queries filter active rows.
- Board advisors need an INSERT exception on the existing tasks table to perform the requested conversion. The additive policy is limited to an active finding or risk, with matching programme, the current creator, and no unrelated meeting/workspace linkage. It grants no general task write access and leaves existing task policies intact.
- **Strict read-only access outside M&E is not enforced.** The specification asks both for board-advisor read-only shared tables and no shared-table RLS changes. Existing policies permit authenticated users to create documents/workspace records and perform some owner writes. A board advisor inherits those existing rights. The user was asked which boundary to prioritize; without an answer, existing policies were preserved. No claim is made that a hidden control enforces read-only access. Existing Team-page role presentation and signup role handling are also unchanged under the no-existing-route/table-change boundary.
- A new `/dashboard/me/documents/[id]` wrapper reuses DocumentModal without modifying the existing Documents route. Its writes remain subject to the existing document owner/admin policy.
- Failed document-row creation after Storage upload can leave an unreadable orphan object; existing Storage DELETE policies were not broadened for cleanup. Previously issued signed URLs remain bearer links until their existing 900-second expiry; the migration controls row access and new URL issuance, not revocation of existing tokens.

## Verification performed

- Complete migration chain replayed successfully on isolated native PostgreSQL 18 with minimal Supabase auth/Storage fixture schemas.
- `supabase/tests/me_access.sql` passed: seven roles across all seven new tables; SELECT/INSERT/UPDATE, attributed soft deletion, hard-delete denial, document/Storage role isolation, board task conversion, duplicate conversion rejection, invalid programme scope, evidence target and date checks. Test data rolls back.
- Earlier `document_visibility.sql` passed: standard defaults, CHECK/NOT NULL, unchanged document write policies, seven-role/unknown-role visibility, deleted rows, orphan objects, other buckets, anonymous sign-in and unauthenticated reads.
- `node scripts/test-me-report.mjs` passed: invalid periods, real date validation, zero baseline, latest reading by measurement period rather than insertion time, overdue boundary/completed-task handling, scope filters, pagination, empty summaries, and DOCX generation.
- `npx tsc --noEmit` passed.
- Targeted ESLint passed with no findings. `npm run lint` passed with zero errors and 15 warnings in unchanged files.
- `npm run build` passed; all seven new routes are in the build output.
- Browser tests against the loopback UI fixture passed for overview, programme creation, measurement creation, restricted evidence upload/link, finding-to-action conversion, DOCX/report/snapshot generation, and activity entries. Fixture state confirmed both created documents were restricted and the shared task had no copied private description.
- Browser role gates: admin and board_advisor allowed; manager, DPO and volunteer redirected to `/dashboard?access=denied`; manager denied on a nested route too. SQL tests cover senior/lead volunteers as well.
- Desktop overview and 375px mobile report/risk screenshots inspected. Report page measured 375px content width at a 375px viewport. A fresh browser session on the recovered dev server reported zero page errors.
- Sample DOCX rendered in Microsoft Word through invisible COM automation, then rasterized with PyMuPDF. Both pages inspected: clean title page and readable tables with no clipping. The packaged renderer could not run because pdf2image was unavailable; no dependency was added to the app.

## Local test instructions

Use an empty disposable PostgreSQL database only. Run `me_bootstrap.sql`, every file in `supabase/migrations` in filename order with `psql -X -v ON_ERROR_STOP=1`, then `me_access.sql`. The bootstrap stubs Supabase schemas and creates test database roles; never run it against a deployed database. `document_visibility.sql` is a separate standalone fixture intended for a fresh disposable cluster (its role creation assumes the authenticated/anon roles do not already exist).

For fixture UI checks, start `node scripts/me-ui-fixture.mjs`, then start Next with process-local `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55440`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture`, and `SUPABASE_SERVICE_ROLE_KEY=fixture-server`, using `next dev --webpack -H 127.0.0.1 -p 3123`. Open `http://127.0.0.1:55440/fixture/login`; its optional role query parameter selects the test role. This fixture is loopback-only and does not validate RLS or real credentials. It must never be deployed.

Initial Turbopack dev verification stalled during hydration and later returned a generated-route 404 after restart. Existing dev artifacts were preserved under `.next/dev-me-before-webpack`; the fresh Webpack dev instance hydrated successfully. No application source changes were made to work around that cache/dev-host issue.

The fixture server, browser session, dev server, and disposable PostgreSQL server were stopped after testing. A final production build passed after shutdown, with no concurrent dev-server process.

## Not performed

Production migration application, authenticated live Supabase CRUD/Storage verification, production Office preview, deployment, commits, and pushes. Local PostgreSQL and mock-browser results do not substitute for those checks. Resolve the shared-table read-only conflict before asserting that stronger access guarantee.
