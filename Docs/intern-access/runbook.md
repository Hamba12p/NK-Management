# Intern access deployment runbook

This runbook is for the human operator. Confirm the target Supabase project before applying the start-date migration or provisioning an account.

## 1. Confirm the hosted project state

Use the intended staging Supabase project and a read-only SQL session. Run the three exact inventory queries in [00-audit.md](00-audit.md): the `pg_policies` dump, public function definitions, and migration ledger. Compare all policies, function bodies, and applied migration versions with the audit and repository. Stop and reconcile any unexpected difference before deployment.

Confirm whether a feedback module exists in the hosted schema and whether `INTERN_TEAM_DIRECTORY_ENABLED` should be `true`. The checked-in repository has no feedback module. Decide whether expired interns should be hidden from the team page or shown as inactive; the current team directory can show role `Intern` while the optional directory is enabled.

## 2. Back up and prepare

Take a fresh database backup or create the organisation's approved restore point. Confirm a tested restore procedure. Record the approved production project reference and change window. Do not use the production service key in local tests.

## 3. Apply to local or staging first

Use a disposable local Supabase project or isolated staging project with no real learner or volunteer records. Apply the full migration set in timestamp order, then run `supabase/tests/intern_access.sql` using the local database URL. Run the existing database tests as well. Review the restrictive policy list, the three DPO policy groups, and every individual function guard diff in [function-guards.md](function-guards.md).

Run the application checks available in the chosen environment. Confirm the intern route allowlist by direct URL, not only sidebar links. Confirm the document signed-URL endpoint and password-change endpoint reject expired or non-intern accounts. Check Storage listing with no prefix and with `interns/<intern-id>/`.

## 4. Prepare the production release

Deploy the application code only after the database migration has been applied. Ensure the environment contains the existing public Supabase URL/key, a server-only service-role key for the account scripts and password-change endpoint, and `INTERN_TEAM_DIRECTORY_ENABLED=false` unless the human decision is to enable it. Keep environment files out of version control. Do not paste secrets into a terminal transcript, ticket, or runbook.

## 5. Apply the production migration

Apply the intern access migration and the later start-date migration in the approved staging project. Rerun the inventory queries to confirm the new policies/functions and unchanged existing policy definitions. Do not proceed if the role constraint lost any pre-existing value.

## 6. Create and seed the intern workspace

Obtain Nakitto's confirmed email address, agreed start date and approved term from the human decision owner. Do not infer them from the CV or application. Use `--months` for calendar-month terms or `--weeks` for the existing four-to-six-week terms. From a secure operations shell with the service-role key in its environment:

```powershell
node --env-file-if-exists=.env.local scripts/create-intern.mjs --email <confirmed-address> --name "Nakitto Reges" --start YYYY-MM-DD --months 3
node --env-file-if-exists=.env.local scripts/create-intern.mjs --email <confirmed-address> --name "Nakitto Reges" --start YYYY-MM-DD --months 3 --apply
node --env-file-if-exists=.env.local scripts/seed-intern-workspace.mjs --email <confirmed-address> --start YYYY-MM-DD
node --env-file-if-exists=.env.local scripts/seed-intern-workspace.mjs --email <confirmed-address> --start YYYY-MM-DD --apply
```

Review every dry-run summary before adding `--apply`. Account creation sets a random temporary password without displaying it by default. An authorised administrator can review the intern profile in the team directory. On the agreed handover date, reset the password from a secure operations shell and display it once for secure transfer. Do not put passwords in `.env.local`, email, or chat history. Confirm the organisation's Auth email-confirmation settings permit the intended first sign-in. On first login, the intern must change the temporary password before the dashboard is available.

For Nakitto's 2026-11-03 start date, review her profile now as an administrator. On 2026-11-02, run a dry run, then reset and reveal the one-time password only in a secure operations shell:

```powershell
node --env-file-if-exists=.env.local scripts/reset-intern-password.mjs --email regesnakitto@gmail.com
node --env-file-if-exists=.env.local scripts/reset-intern-password.mjs --email regesnakitto@gmail.com --apply --show-password
```

The current workspace seed contains a four-week task and meeting plan. For a longer term, obtain and review the remaining work plan before treating workspace setup as complete. Its current dry run also requires the configured manager profile to exist; do not apply it until the named supervisor accounts have been checked. The seed creates tasks, flagged meetings, an intern-visible announcement requiring acknowledgement, workspace templates, and folder areas. It does not upload reports or real learner/volunteer records. Amina must anonymise and upload any approved copies of the Covenant Junior School, Kyaggwe Road Primary and Nakifuma Modern Secondary reports by hand. Those source reports contain personal accounts from children and volunteer names.

## 7. Verify with a dummy intern account

In staging, sign in as a disposable intern and check the dashboard home, My Work, documents, workspace, tasks, meetings, announcements, settings and search. Confirm the onboarding acknowledgement is available. Confirm names and roles render for document, workspace, meeting and announcement authors, with no staff email or phone fields returned by `staff_directory`.

Try these direct routes and API/data paths as the intern. Each forbidden dashboard route should redirect to the dashboard, and its underlying data must remain inaccessible by direct PostgREST calls:

- `/dashboard/learners`
- `/dashboard/hub`
- `/dashboard/dpo/register`
- `/dashboard/activity-log`
- `/dashboard/analytics`
- `/dashboard/volunteers`
- document access API for a private, unflagged document
- Storage list without a prefix, then attempts to download a non-visible object
- direct reads/writes to learner, guardian, enrolment, attendance, progress, DPO, activity, volunteer, equipment, curriculum and M&E tables

Also verify expired access through both the browser and a direct authenticated database/API request. Check that the proxy signs the user out and shows “Your access has ended”, and that RLS, the directory function, document access API and password-change API deny the expired token.

As DPO, verify Amina can create/update only intern-assigned tasks and her own intern-visible meetings/announcements. As a manager, verify existing task, meeting and announcement rights remain intact. Check admin, DPO, managers, volunteers, board adviser and existing shared volunteers account behaviour against the pre-change baseline. Do not use or alter the shared volunteers account for testing.

## 8. Human handover and monitoring

Confirm the MOU and code of conduct are signed before work begins. Hand the temporary password securely to Amina and confirm she gives it to Nakitto through the approved secure channel. Do not send Foundation material to personal email or messaging apps. Ensure every draft remains marked DRAFT until adopted.

Schedule offboarding for the approved term end. For a three-month term starting 2026-11-03, review the expiry of 2027-02-03 and schedule the final review and offboarding accordingly. Any later extension must be approved; use `extend-intern.mjs` in dry-run mode, review the proposed expiry, then apply. Run the offboarding script in dry-run mode before applying it:

```powershell
node --env-file-if-exists=.env.local scripts/offboard-intern.mjs --email <confirmed-address>
node --env-file-if-exists=.env.local scripts/offboard-intern.mjs --email <confirmed-address> --apply
```

Secure the generated Word export, review task and document ownership transfers, and complete the printed human checklist. The intern account is banned and retained so historical comments, versions and activity remain attributed to her profile.

## Decisions still required from the organisation

- Nakitto's confirmed email address and actual start date.
- Whether managers other than admin and DPO should see the activity log. This branch leaves current activity-log policy unchanged.
- Whether the optional team directory is enabled. It is disabled by default with `INTERN_TEAM_DIRECTORY_ENABLED=false`.
- Whether a feedback module exists in the hosted deployment. None exists in this repository snapshot.
- Whether an expired intern should be hidden from the team page or shown as inactive if the directory is enabled.
