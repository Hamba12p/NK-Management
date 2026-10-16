# Intern access: read-only audit

Audit date: 15 October 2026 (repository snapshot). Scope: checked-in source and migrations only. No hosted database was queried and no migration or script was applied.

## Deployment state

The repository contains timestamped migrations through `20260922171215_me_board_advisory.sql` (latest), including foundational, volunteer, hub, learner attendance, and M&E modules. This is the schema the repository expects when all checked-in migrations have been applied. The project is marked as production in the supplied task context, but the repository cannot establish which migrations are live. The earlier report about a database password issue is not verifiable here. No Supabase CLI, local database, or database credentials were available in this environment, so there was no local catalog to compare. Hosted migration state must be confirmed by the human before any rollout.

The migration history is not purely additive overall: the existing history contains replacement/drop operations, including `20260922171213_add_board_advisor_role.sql` dropping and recreating `profiles_role_check`, and earlier archive/identity migrations dropping columns. New intern migrations must therefore be reviewed as additive, independent changes; none of those historical operations are being repeated here. The one specifically permitted future replacement is the role constraint.

## Roles

The actual role constraint name is `profiles_role_check`. It is created in `20260811000000_udada_hub.sql` with `admin`, `manager`, `dpo`, `volunteer`, `volunteer_senior`, and `volunteer_lead`; the later `20260922171213_add_board_advisor_role.sql` replacement adds `board_advisor`. That is the latest expected list and all seven values must be retained when adding `intern`.

Role references found in application and scripts:

- `src/proxy.ts`: protected-route role arrays for M&E, admin, DPO, volunteer, manager, and learner/hub paths. Other dashboard paths fall through to any authenticated user.
- `src/components/Sidebar.tsx`: role-based navigation; no `intern` branch exists.
- `src/lib/team-structure.ts`: `HubRole` union and role permissions; union currently omits `board_advisor` despite its later addition and needs a careful update.
- `src/app/dashboard/team/page.tsx`: `ProfileRole`, labels, descriptions, filtering and normalisation; omits `board_advisor` and `intern`.
- `src/lib/me/types.ts`: M&E eligibility helper for `admin` and `board_advisor`.
- Other runtime checks: dashboard home, meetings, workspace task controls, announcements, activity log, analytics, advanced, hub/classes/learners, volunteers and volunteer profile pages.
- SQL role references: initial constraint and auth trigger; volunteer profile foundation/sync; activity and archive RPCs; hub learner and scheduling RPCs; learner/hub policy predicates; document visibility; and the M&E role policies.
- `scripts/seed-users.mjs` provisions existing roles, including the shared `volunteer` account and `board_advisor`. It reads fixed roster addresses and passwords from environment variables. Do not run or modify it for intern provisioning.

## Profile creation side effects

`auth.users` has `on_auth_user_created`, which calls `public.handle_new_user()` (latest definition in `20260823000000_profile_identity_and_attribution.sql`). It inserts a profile and accepts metadata roles only from the older six-role list; unrecognised roles, including `intern` and `board_advisor`, become `volunteer`. The `sync_profile_foundations_after_profile_change` trigger then creates a `user_preferences` row for every profile and creates a `volunteer_profiles` row for volunteer roles. Promoting the new profile to intern fires the sync trigger again but does not remove the volunteer row. No corresponding automatic volunteer-hours row is created. Provisioning must account for this by deleting only the generated `volunteer_profiles` row for the newly created intern after updating the profile role. The preferences row is expected and harmless.

## RLS policy inventory

The SQL policy statements in the checked-in migrations are reproduced in the appendix below. Unless explicitly specified in a policy statement, PostgreSQL policies are permissive, target `authenticated`, and have no unspecified USING/WITH CHECK expression. `FOR ALL` applies to all commands. The advisory migration creates the same three policies (`*_read`, `*_insert`, `*_update`) for each of seven M&E tables using a dynamic loop; those definitions are recorded once below with their full expressions and table list. The current effective hosted catalog is unknown and may differ from these migrations.

Policies that are broad for authenticated users include profile, document, meeting, agenda item, announcement, workspace document/comment, and task reads; agenda item insert/update use `true`; document storage read and insert are bucket-wide. The later active/deleted filters are additional permissive policies, not restrictions. The new intern controls must be restrictive, and must constrain writes as well as reads. RLS does not restrict selected columns, so profiles must be row-limited and team names/roles, if approved, must be served through a separate narrow interface.

Storage policy inventory is for `storage.objects` and bucket `documents`; its policies are included in the appendix. Existing authenticated bucket-wide read/insert rules make a restrictive prefix/link rule essential. Intern uploads use an `interns/<auth.uid()>/` object-name prefix; reads additionally allow storage objects linked to active, standard, `intern_visible` document rows.

## Security-definer routines, views and RPCs

No SQL views or global-search RPC were found in the migration history. Global search in `src/components/GlobalSearch.tsx` uses client-side queries; table RLS is its data boundary.

The five security-definer functions in the checked-in migrations are:

- `public.handle_new_user()`: auth trigger, inserts/updates one profile from auth metadata.
- `public.sync_profile_foundations()`: profile trigger, creates a preferences row and volunteer profile for volunteer roles.
- `public.archive_owned_content(text, uuid)`: archives and soft-deletes supported caller-owned content; validates actor/ownership internally.
- `public.sync_meeting_event()`: mirrors meeting changes to an event row.
- `public.refresh_volunteer_hours_total()`: recomputes a profile's volunteer-hours total after hour changes.

`public.complete_meeting_and_carry_forward(uuid)`, `public.save_workspace_document(...)`, `public.restore_workspace_document_version(uuid)`, `public.generate_hub_rotation(...)`, `public.complete_hub_class_session(uuid)`, and `public.enrol_hub_learner(...)` are `SECURITY INVOKER`; their bodies are reviewed in the additional audit below. `public.profile_initials(text)` is immutable and not security definer. The search component is not a definer/RPC bypass.

## Routes, APIs and service role

`src/proxy.ts` calls Supabase `auth.getUser()` and reads `profiles.role` for routes in its explicit protected-role map. The matcher explicitly excludes all `/api` paths. Dashboard routes without a `protectedRoles` entry therefore rely only on authentication: home, documents, announcements, workspace, meetings, settings and team are examples. Several pages add client-side role checks after rendering/loading; these are not server-side route protection. `src/app/dashboard/layout.tsx` and page source should be checked for any server component guard at rollout.

API routes found: `/api/auth/board-login` uses the publishable client and `/api/documents/[id]/access` uses `SUPABASE_SERVICE_ROLE_KEY` to generate storage access. The latter must enforce authenticated role, document row visibility, and ownership/visibility before using the service role. No Next server actions (`'use server'`) were found. `scripts/seed-users.mjs` uses the service role for account provisioning and is a standalone script, not a route.

The proxy's role allowlist currently has no intern branch, does not enforce expiry or password change, and does not match API routes. Dashboard links are role-conditioned in Sidebar, but the dashboard home renders compliance information/widgets based on profile and requires inspection for intern query suppression.

## Feature/schema notes

- `documents`: `uploaded_by` ownership; later migration adds `deleted_at`, and `20260922170751_restrict_document_visibility.sql` adds/uses restricted visibility. Intern flag still needed. Storage objects use `bucket_id = 'documents'` and object name paths.
- Tasks use both nullable `assignee_id` and `assignee_label`, with a check requiring at least one. Intern tasks must use the intern profile UUID in `assignee_id`; label matching is not an access-control mechanism. `linked_doc_id` references `workspace_docs`.
- Meetings have `created_by`; the checked-in schema has no attendee or invitation join table. Interns read only meetings flagged `intern_visible`; an additional `intern_check_in` flag marks the visible meetings where they may contribute agenda items.
- Agenda items include `meeting_id`, `created_by`; current permissive insert/update policies allow any authenticated user to act on arbitrary rows unless constrained.
- Announcements have `author_id`, `deleted_at`; acknowledgements use `(announcement_id, user_id)` and own-row write policies. An intern-visible flag is needed on announcements.
- The intern migration adds `acknowledgement_required` to announcements and a new `intern_workspace_areas` table for audit, template, fact sheet, SOP, handover and shared-reading folders. Documents and workspace drafts can reference an area additively.
- Workspace documents have `author_id`; comments link to `document_id` and have `author_id`; versions link to `document_id` and `created_by`. Ownership filters must derive through the parent document for comments/versions.
- Document categories/folders are not present as a separate table in the checked-in schema; document `category` is text. Templates can use existing text categories and workspace document content.
- No feedback module tables or routes were found in the repository. Whether one exists in the hosted project remains for the human to confirm.
- Dashboard home queries assigned tasks and also contains compliance/DPO and aggregate widgets; hide and suppress these queries for interns.
- `activity_log` has compliance-read access only for admin/DPO, but intern access must explicitly remain closed.
- `scripts/seed-users.mjs` preflights the profiles schema then creates/updates Auth users and upserts profiles. It uses a shared fixed-password environment variable for non-admin accounts; new scripts must instead create random temporary passwords and must not reuse its roster or fixed-password practice.

## Classification of every public table in checked-in migrations

“Own” means own row/content or assigned rows only; any missing class is closed. Intern access remains blocked until the new restrictive policies are applied.

| Table | Classification | Intended intern boundary |
|---|---|---|
| profiles | own | Own row only; no email/phone directory exposure |
| documents | flagged | `intern_visible` rows plus own uploads |
| meetings | flagged | `intern_visible` meetings only |
| agenda_items | own | Intern-authored agenda items on intern-visible check-ins; parent meeting boundary |
| announcements | flagged | `intern_visible` announcements only |
| announcement_acknowledgements | own | Own acknowledgement for visible announcement |
| activity_log | closed | No access |
| processing_activities | closed | No access |
| data_subject_requests | closed | No access |
| dpo_incidents | closed | No access |
| workspace_docs | own | Own drafts |
| workspace_comments | own | Comments on own drafts; supervisors may comment under existing grants |
| tasks | own | Assigned-to-intern or created-by-intern; assigned status updates and own subtasks |
| workspace_doc_versions | own | Versions of own drafts only |
| volunteer_profiles | closed | No access |
| user_preferences | own | Own settings only |
| intern_workspace_areas | flagged | Intern-visible area rows only; no intern writes |
| events | closed | Volunteer event records are outside the internship scope |
| volunteer_hours | closed | No access |
| deleted_content_archive | closed | No access |
| admin_notifications | closed | No access |
| hub_classes | closed | No access |
| hub_class_rotation | closed | No access |
| hub_class_sessions | closed | No access |
| hub_session_assignments | closed | No access |
| learners | closed | No access |
| learner_guardian_contacts | closed | No access |
| learner_enrolments | closed | No access |
| learner_attendance | closed | No access |
| learner_progress | closed | No access |
| hub_curriculum | closed | No access |
| equipment | closed | No access |
| programs | closed | M&E records outside internship scope |
| program_kpis | closed | M&E records outside internship scope |
| kpi_measurements | closed | M&E records outside internship scope |
| findings | closed | M&E records outside internship scope |
| risks | closed | M&E records outside internship scope |
| evidence_links | closed | M&E/document linkage outside internship scope |
| board_reports | closed | No access |

`storage.objects` (not a public table): read-limited to own `interns/<auth.uid()>/` path or an object linked to an `intern_visible` document; upload/update/delete only under own prefix and own document rows. Listing must be prefix-scoped by this policy.

## Policy statement appendix

The following is a source inventory of policy declarations. Policies without the `AS RESTRICTIVE` keyword are permissive. Expressions are reproduced from migrations; policy history may include older policies left alongside later active/deletion policies.


### 20260811000000_udada_hub.sql

```sql
create policy "profiles_read_authenticated" on public.profiles for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
```


### 20260811000000_udada_hub.sql

```sql
create policy "profiles_admin_update" on public.profiles for update to authenticated using ((select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "documents_read_all" on public.documents for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "documents_insert_own" on public.documents for insert to authenticated with check (auth.uid() = uploaded_by);
```


### 20260811000000_udada_hub.sql

```sql
create policy "documents_update" on public.documents for update to authenticated using (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "documents_delete" on public.documents for delete to authenticated using (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "storage_authenticated_read" on storage.objects for select to authenticated using (bucket_id = 'documents');
```


### 20260811000000_udada_hub.sql

```sql
create policy "storage_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'documents');
```


### 20260811000000_udada_hub.sql

```sql
create policy "storage_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'documents' and auth.uid() = owner);
```


### 20260811000000_udada_hub.sql

```sql
create policy "meetings_read_all" on public.meetings for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "meetings_insert_authorized" on public.meetings for insert to authenticated with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager') and auth.uid() = created_by);
```


### 20260811000000_udada_hub.sql

```sql
create policy "meetings_update" on public.meetings for update to authenticated using (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "meetings_delete" on public.meetings for delete to authenticated using (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "agenda_items_read" on public.agenda_items for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "agenda_items_insert" on public.agenda_items for insert to authenticated with check (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "agenda_items_update" on public.agenda_items for update to authenticated using (true) with check (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "agenda_items_delete" on public.agenda_items for delete to authenticated using ((select created_by from public.meetings where id = meeting_id) = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "announcements_read_all" on public.announcements for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "announcements_insert_authorized" on public.announcements for insert to authenticated with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager') and auth.uid() = author_id);
```


### 20260811000000_udada_hub.sql

```sql
create policy "announcements_update" on public.announcements for update to authenticated using (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "announcements_delete" on public.announcements for delete to authenticated using (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin');
```


### 20260811000000_udada_hub.sql

```sql
create policy "activity_log_read_compliance" on public.activity_log for select to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "activity_log_insert_authenticated" on public.activity_log for insert to authenticated with check (auth.uid() = user_id);
```


### 20260811000000_udada_hub.sql

```sql
create policy "activity_log_deny_all_updates" on public.activity_log for update to authenticated using (false);
```


### 20260811000000_udada_hub.sql

```sql
create policy "activity_log_deny_all_deletes" on public.activity_log for delete to authenticated using (false);
```


### 20260811000000_udada_hub.sql

```sql
create policy "dpo_processing_access" on public.processing_activities for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "dpo_requests_access" on public.data_subject_requests for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "dpo_incidents_read" on public.dpo_incidents for select to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "dpo_incidents_append" on public.dpo_incidents for insert to authenticated with check (auth.uid() = reported_by and (select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_docs_read" on public.workspace_docs for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_docs_create" on public.workspace_docs for insert to authenticated with check (auth.uid() = author_id);
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_docs_update" on public.workspace_docs for update to authenticated using (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')) with check (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_comments_read" on public.workspace_comments for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_comments_create" on public.workspace_comments for insert to authenticated with check (auth.uid() = author_id);
```


### 20260811000000_udada_hub.sql

```sql
create policy "workspace_comments_delete_own" on public.workspace_comments for delete to authenticated using (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
```


### 20260811000000_udada_hub.sql

```sql
create policy "tasks_read" on public.tasks for select to authenticated using (true);
```


### 20260811000000_udada_hub.sql

```sql
create policy "tasks_manage" on public.tasks for all to authenticated using ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager')) with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
```


### 20260811000001_align_activity_log.sql

```sql
create policy "activity_log_insert_authenticated"
  on public.activity_log for insert to authenticated
  with check (auth.uid() = user_id);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "deleted_content_archive_read_compliance" on public.deleted_content_archive
  for select to authenticated
  using ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "admin_notifications_read_own" on public.admin_notifications
  for select to authenticated using (recipient_id = auth.uid());
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "admin_notifications_mark_read_own" on public.admin_notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "documents_read_active" on public.documents for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "documents_update_active" on public.documents for update to authenticated
  using (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (auth.uid() = uploaded_by or (select role from public.profiles where id = auth.uid()) = 'admin'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "storage_read_active_documents" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents' and (
      exists (select 1 from public.documents where file_path = name and deleted_at is null)
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "announcements_read_active" on public.announcements for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "announcements_update_active" on public.announcements for update to authenticated
  using (deleted_at is null and (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (auth.uid() = author_id or (select role from public.profiles where id = auth.uid()) = 'admin'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "meetings_read_active" on public.meetings for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "meetings_update_active" on public.meetings for update to authenticated
  using (deleted_at is null and (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')))
  with check (deleted_at is null and (auth.uid() = created_by or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "agenda_items_read_active" on public.agenda_items for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "agenda_items_insert_own" on public.agenda_items for insert to authenticated with check (created_by = auth.uid());
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "agenda_items_update_active" on public.agenda_items for update to authenticated
  using (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "workspace_docs_read_active" on public.workspace_docs for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "workspace_docs_update_active" on public.workspace_docs for update to authenticated
  using (deleted_at is null and (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')))
  with check (deleted_at is null and (author_id = auth.uid() or (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "workspace_comments_read_active" on public.workspace_comments for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "tasks_read_active" on public.tasks for select to authenticated using (deleted_at is null);
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "tasks_manage_active" on public.tasks for all to authenticated
  using (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'))
  with check (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "dpo_processing_read_active" on public.processing_activities for select to authenticated
  using (deleted_at is null and (select role from public.profiles where id = auth.uid()) in ('admin', 'dpo'));
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "dpo_processing_write_active" on public.processing_activities for insert to authenticated
  with check ((select role from public.profiles where id = auth.uid()) in ('admin', 'dpo') and created_by = auth.uid());
```


### 20260811000002_recoverable_content_deletion.sql

```sql
create policy "dpo_processing_update_active" on public.processing_activities for update to authenticated
  using (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'))
  with check (deleted_at is null and (created_by = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin'));
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "volunteer_profiles_read_own" on public.volunteer_profiles
  for select to authenticated using (profile_id = (select auth.uid()));
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "volunteer_profiles_read_leadership" on public.volunteer_profiles
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "volunteer_profiles_insert_own" on public.volunteer_profiles
  for insert to authenticated with check (
    profile_id = (select auth.uid())
    and tier = (select role from public.profiles where id = (select auth.uid()))
  );
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "volunteer_profiles_update_own" on public.volunteer_profiles
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and tier = (select role from public.profiles where id = (select auth.uid()))
  );
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "volunteer_profiles_update_leadership" on public.volunteer_profiles
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    and tier in ('volunteer', 'volunteer_senior', 'volunteer_lead')
  );
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "user_preferences_read_own" on public.user_preferences
  for select to authenticated using (profile_id = (select auth.uid()));
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check (profile_id = (select auth.uid()));
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
```


### 20260822203257_phase_1_foundations.sql

```sql
create policy "activity_log_insert_authenticated" on public.activity_log
  for insert to authenticated with check ((select auth.uid()) = user_id);
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "events_read_authenticated" on public.events
  for select to authenticated using (true);
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "events_create_leadership" on public.events
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "events_update_leadership" on public.events
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "volunteer_hours_read_own" on public.volunteer_hours
  for select to authenticated using (volunteer_id = (select auth.uid()));
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "volunteer_hours_read_leadership" on public.volunteer_hours
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "volunteer_hours_insert_own" on public.volunteer_hours
  for insert to authenticated with check (volunteer_id = (select auth.uid()));
```


### 20260822203901_phase_2_close_workflow_loops.sql

```sql
create policy "volunteer_hours_update_own" on public.volunteer_hours
  for update to authenticated
  using (volunteer_id = (select auth.uid()))
  with check (volunteer_id = (select auth.uid()));
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "workspace_doc_versions_read" on public.workspace_doc_versions
  for select to authenticated using (
    exists (
      select 1 from public.workspace_docs document
      where document.id = public.workspace_doc_versions.document_id
        and (document.author_id = (select auth.uid())
          or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
    )
  );
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "workspace_doc_versions_insert" on public.workspace_doc_versions
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_docs document
      where document.id = public.workspace_doc_versions.document_id
        and (document.author_id = (select auth.uid())
          or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
    )
  );
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "dpo_incidents_update" on public.dpo_incidents
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'dpo'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'dpo'));
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "announcement_acknowledgements_read" on public.announcement_acknowledgements
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) = 'admin'
  );
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "announcement_acknowledgements_insert_own" on public.announcement_acknowledgements
  for insert to authenticated with check (user_id = (select auth.uid()));
```


### 20260822204337_phase_3_depth_and_compliance.sql

```sql
create policy "announcement_acknowledgements_update_own" on public.announcement_acknowledgements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```


### 20260823023433_fix_document_storage_read_policy.sql

```sql
create policy "storage_authenticated_read_documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid()) is not null
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_classes_read_authenticated" on public.hub_classes
  for select to authenticated using ((select auth.uid()) is not null);
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_classes_insert_leadership" on public.hub_classes
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_classes_update_leadership" on public.hub_classes
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_rotation_read" on public.hub_class_rotation
  for select to authenticated using (
    volunteer_profile_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_rotation_insert_leadership" on public.hub_class_rotation
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_rotation_update_leadership" on public.hub_class_rotation
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_sessions_read" on public.hub_class_sessions
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    or exists (
      select 1 from public.hub_session_assignments assignment
      where assignment.session_id = public.hub_class_sessions.id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_sessions_insert_leadership" on public.hub_class_sessions
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_class_sessions_update" on public.hub_class_sessions
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_session_assignments_read" on public.hub_session_assignments
  for select to authenticated using (
    volunteer_profile_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_session_assignments_insert_leadership" on public.hub_session_assignments
  for insert to authenticated with check (
    assigned_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "hub_session_assignments_update_leadership" on public.hub_session_assignments
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203747_hub_class_scheduling.sql

```sql
create policy "volunteer_hours_insert_leadership" on public.volunteer_hours
  for insert to authenticated with check (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learners_read_authorized" on public.learners
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
    or exists (
      select 1
      from public.learner_enrolments enrolment
      join public.hub_class_sessions session on session.class_id = enrolment.class_id
      join public.hub_session_assignments assignment on assignment.session_id = session.id
      where enrolment.learner_id = public.learners.id
        and enrolment.status = 'active'
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learners_insert_leadership" on public.learners
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learners_update_leadership" on public.learners
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_guardian_contacts_read_private" on public.learner_guardian_contacts
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_guardian_contacts_insert_leadership" on public.learner_guardian_contacts
  for insert to authenticated with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_guardian_contacts_update_leadership" on public.learner_guardian_contacts
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_enrolments_read_authorized" on public.learner_enrolments
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
    or exists (
      select 1
      from public.hub_class_sessions session
      join public.hub_session_assignments assignment on assignment.session_id = session.id
      where session.class_id = public.learner_enrolments.class_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_enrolments_insert_leadership" on public.learner_enrolments
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_enrolments_update_leadership" on public.learner_enrolments
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_attendance_read_authorized" on public.learner_attendance
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
    or exists (
      select 1 from public.hub_session_assignments assignment
      where assignment.session_id = public.learner_attendance.session_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_attendance_insert_authorized" on public.learner_attendance
  for insert to authenticated with check (
    marked_by = (select auth.uid())
    and exists (
      select 1
      from public.hub_class_sessions session
      join public.learner_enrolments enrolment
        on enrolment.class_id = session.class_id and enrolment.learner_id = public.learner_attendance.learner_id
      where session.id = public.learner_attendance.session_id and enrolment.status = 'active'
    )
    and (
      (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
      or exists (
        select 1 from public.hub_session_assignments assignment
        where assignment.session_id = public.learner_attendance.session_id
          and assignment.volunteer_profile_id = (select auth.uid())
      )
    )
  );
```


### 20260901203749_learner_attendance.sql

```sql
create policy "learner_attendance_update_authorized" on public.learner_attendance
  for update to authenticated
  using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    or exists (
      select 1 from public.hub_session_assignments assignment
      where assignment.session_id = public.learner_attendance.session_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  )
  with check (
    marked_by = (select auth.uid())
    and (
      (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
      or exists (
        select 1 from public.hub_session_assignments assignment
        where assignment.session_id = public.learner_attendance.session_id
          and assignment.volunteer_profile_id = (select auth.uid())
      )
    )
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "learner_progress_read_authorized" on public.learner_progress
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
    or exists (
      select 1
      from public.hub_class_sessions session
      join public.hub_session_assignments assignment on assignment.session_id = session.id
      where session.class_id = public.learner_progress.class_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "learner_progress_insert_authorized" on public.learner_progress
  for insert to authenticated with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.learner_enrolments enrolment
      where enrolment.learner_id = public.learner_progress.learner_id
        and enrolment.class_id = public.learner_progress.class_id
        and enrolment.status = 'active'
    )
    and (
      (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
      or exists (
        select 1
        from public.hub_class_sessions session
        join public.hub_session_assignments assignment on assignment.session_id = session.id
        where session.class_id = public.learner_progress.class_id
          and assignment.volunteer_profile_id = (select auth.uid())
      )
    )
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "learner_progress_update_authorized" on public.learner_progress
  for update to authenticated
  using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    or exists (
      select 1
      from public.hub_class_sessions session
      join public.hub_session_assignments assignment on assignment.session_id = session.id
      where session.class_id = public.learner_progress.class_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  )
  with check (
    updated_by = (select auth.uid())
    and (
      (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
      or exists (
        select 1
        from public.hub_class_sessions session
        join public.hub_session_assignments assignment on assignment.session_id = session.id
        where session.class_id = public.learner_progress.class_id
          and assignment.volunteer_profile_id = (select auth.uid())
      )
    )
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "hub_curriculum_read" on public.hub_curriculum
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'volunteer', 'volunteer_senior', 'volunteer_lead')
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "hub_curriculum_insert_leadership" on public.hub_curriculum
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "hub_curriculum_update_leadership" on public.hub_curriculum
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "equipment_read_authenticated" on public.equipment
  for select to authenticated using ((select auth.uid()) is not null);
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "equipment_insert_leadership" on public.equipment
  for insert to authenticated with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260901203752_hub_operations_depth.sql

```sql
create policy "equipment_update_leadership" on public.equipment
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
```


### 20260922170751_restrict_document_visibility.sql

```sql
create policy "documents_read_active" on public.documents
for select to authenticated
using (
  deleted_at is null
  and (
    visibility = 'standard'
    or (
      visibility = 'restricted'
      and (select role from public.profiles where id = (select auth.uid()))
        in ('admin', 'board_advisor')
    )
  )
);
```


### 20260922170751_restrict_document_visibility.sql

```sql
create policy "storage_authenticated_read_documents" on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid()) is not null
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and exists (
    select 1 from public.documents d
    where d.file_path = storage.objects.name
      and d.deleted_at is null
      and (
        d.visibility = 'standard'
        or (
          d.visibility = 'restricted'
          and (select role from public.profiles where id = (select auth.uid()))
            in ('admin', 'board_advisor')
        )
      )
  )
);
```


### 20260922171215_me_board_advisory.sql

```sql
create policy %I on public.%I for select to authenticated using ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor''))', table_name || '_read', table_name);
```


### 20260922171215_me_board_advisory.sql

```sql
create policy %I on public.%I for insert to authenticated with check ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'') and deleted_at is null and deleted_by is null)', table_name || '_insert', table_name);
```


### 20260922171215_me_board_advisory.sql

```sql
create policy %I on public.%I for update to authenticated using ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'')) with check ((select role from public.profiles where id = (select auth.uid())) in (''admin'', ''board_advisor'') and ((deleted_at is null and deleted_by is null) or (deleted_at is not null and deleted_by = (select auth.uid()))))', table_name || '_update', table_name);
```


### 20260922171215_me_board_advisory.sql

```sql
create policy tasks_board_action_insert on public.tasks for insert to authenticated
with check (
  (select role from public.profiles where id = (select auth.uid())) = 'board_advisor'
  and created_by = (select auth.uid()) and deleted_at is null
  and source_meeting_id is null and source_agenda_item_id is null and linked_doc_id is null
  and (
    (source_risk_id is null and exists (select 1 from public.findings f
      where f.id = source_finding_id and f.deleted_at is null
        and f.program_id is not distinct from source_program_id))
    or (source_finding_id is null and exists (select 1 from public.risks r
      where r.id = source_risk_id and r.deleted_at is null
        and r.program_id is not distinct from source_program_id))
  )
);
```


The `20260922171215_me_board_advisory.sql` migration creates policies dynamically in a loop rather than containing literal `CREATE POLICY` statements for each table. For each of `programs`, `program_kpis`, `kpi_measurements`, `findings`, `risks`, `evidence_links`, and `board_reports`, it creates: `<table>_read` (`SELECT`, authenticated, USING current role admin/board_advisor); `<table>_insert` (`INSERT`, WITH CHECK current role admin/board_advisor and deleted_at/deleted_by null); and `<table>_update` (`UPDATE`, USING current role admin/board_advisor, WITH CHECK same role and active row or deleted_by caller). These are permissive.

## Decisions and additional audit

The approved design removes meeting invitations. Meeting access is based on `intern_visible` only. Agenda item writes will be limited to a meeting created by the intern. No attendee table is planned.

### Function body review

Read each function body in the migration that defines its latest version. The five `SECURITY DEFINER` functions are `handle_new_user`, `sync_profile_foundations`, `sync_meeting_event`, `refresh_volunteer_hours_total`, and `archive_owned_content`. `handle_new_user` and `sync_profile_foundations` are trigger functions; neither checks the caller's role or ownership, and both operate on the trusted trigger row. They do not expose caller-selected closed data. Their bodies remain unchanged apart from adding `intern` to the accepted metadata roles in `handle_new_user`; `sync_profile_foundations` still creates volunteer profiles only for volunteer roles. `sync_meeting_event` mirrors the triggering meeting into events and has no role or ownership check; it touches closed event data, so the migration adds an early intern guard. `refresh_volunteer_hours_total` recomputes a total for the changed volunteer-hours row, with no role or ownership check; it touches closed volunteer data, so the migration adds an early intern guard. `archive_owned_content` checks authentication and ownership, with admin exception, before archiving each supported resource; it touches the closed archive and also receives an early intern guard.

`complete_meeting_and_carry_forward`, `generate_hub_rotation`, `complete_hub_class_session`, `enrol_hub_learner`, `save_workspace_document`, and `restore_workspace_document_version` are `SECURITY INVOKER`, not definer. Their bodies were reviewed too: meeting carry-forward checks authentication and creator/admin/manager access; hub rotation/session functions check admin/manager; enrolment checks admin/manager; save/restore checks document ownership or admin/manager. The intern-access migration adds early intern guards to the closed-data carry-forward, hub rotation/session, and learner enrolment operations. The requested function diffs are in [function-guards.md](function-guards.md), separately for review.

### API review

The only API handler using a service-role key for data access is `GET /api/documents/[id]/access`. It authenticates with the server Supabase client, reads the document through caller RLS, then creates a signed URL with service role. The intern implementation explicitly denies missing or expired expiry, enforces the required password change, and requires either an own prefixed upload or an active standard intern-visible document before signing. `POST /api/auth/board-login` uses only a publishable key and a configured server-side credential pair to sign in the configured board account; it is a public credential exchange, not an authenticated data API. It must not be used for intern provisioning. The new password-change API separately validates the session, intern role, expiry and password-change flag before using the service key. These are all three `/api` route handlers found in the repository; all have been checked for service-role or authenticated-data bypasses. No Next server actions (`'use server'`) were found. `scripts/seed-users.mjs` uses the service role for account provisioning and is a standalone script, not a route.

### Existing agenda policy weakness

`agenda_items_insert` and `agenda_items_update` in the initial migration use `WITH CHECK (true)` and `USING (true) WITH CHECK (true)` respectively. They let any authenticated user insert and update agenda rows, subject only to table constraints/grants. This is an existing weakness affecting all roles. This branch leaves those permissive staff policies untouched; the new restrictive intern policies constrain agenda reads to intern-visible or own meetings and writes to intern-authored agenda items on intern-visible check-ins.

### Exact hosted pre-application inventory queries

Before applying any migration, run these read-only queries against the hosted project and compare the output with this file and the checked-in migration list. Do not continue if an unexpected policy, function or migration is present.

```sql
-- Every policy on public tables and storage.objects, including expressions.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- All public functions, with identity arguments, security mode, fixed search path and body.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_settings,
       pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- Supabase migration ledger.
select version, name, statements
from supabase_migrations.schema_migrations
order by version;
```

The migration ledger schema can vary by Supabase CLI version. If the third query reports that a named column is absent, inspect `information_schema.columns` for `supabase_migrations.schema_migrations` and select its available version/name fields; do not infer that no migrations were applied.
