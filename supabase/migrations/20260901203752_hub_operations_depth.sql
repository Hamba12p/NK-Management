-- Learner progress, curriculum links, and Hub equipment operations.

create table if not exists public.learner_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete restrict,
  class_id uuid not null references public.hub_classes(id) on delete restrict,
  last_session_id uuid references public.hub_class_sessions(id) on delete set null,
  week_number integer not null check (week_number between 1 and 5),
  status text not null default 'on_track' check (status in ('on_track', 'needs_support', 'completed')),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, class_id)
);

create index if not exists idx_learner_progress_class_status
  on public.learner_progress(class_id, status, week_number);

create table if not exists public.hub_curriculum (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.hub_classes(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 5),
  workspace_doc_id uuid not null references public.workspace_docs(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (class_id, week_number),
  unique (workspace_doc_id)
);

create index if not exists idx_hub_curriculum_class_week
  on public.hub_curriculum(class_id, week_number);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null check (char_length(asset_tag) between 2 and 40),
  name text not null default 'Computer' check (char_length(name) between 2 and 120),
  status text not null default 'newly_arrived' check (status in ('working', 'in_repair', 'newly_arrived')),
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_equipment_asset_tag_unique
  on public.equipment(lower(asset_tag));
create index if not exists idx_equipment_status on public.equipment(status);

alter table public.learner_progress enable row level security;
alter table public.hub_curriculum enable row level security;
alter table public.equipment enable row level security;

drop policy if exists "learner_progress_read_authorized" on public.learner_progress;
drop policy if exists "learner_progress_insert_authorized" on public.learner_progress;
drop policy if exists "learner_progress_update_authorized" on public.learner_progress;
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

drop policy if exists "hub_curriculum_read" on public.hub_curriculum;
drop policy if exists "hub_curriculum_insert_leadership" on public.hub_curriculum;
drop policy if exists "hub_curriculum_update_leadership" on public.hub_curriculum;
create policy "hub_curriculum_read" on public.hub_curriculum
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'volunteer', 'volunteer_senior', 'volunteer_lead')
  );
create policy "hub_curriculum_insert_leadership" on public.hub_curriculum
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_curriculum_update_leadership" on public.hub_curriculum
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "equipment_read_authenticated" on public.equipment;
drop policy if exists "equipment_insert_leadership" on public.equipment;
drop policy if exists "equipment_update_leadership" on public.equipment;
create policy "equipment_read_authenticated" on public.equipment
  for select to authenticated using ((select auth.uid()) is not null);
create policy "equipment_insert_leadership" on public.equipment
  for insert to authenticated with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "equipment_update_leadership" on public.equipment
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );

revoke all on table public.learner_progress from anon;
revoke all on table public.hub_curriculum from anon;
revoke all on table public.equipment from anon;
grant select, insert, update on public.learner_progress to authenticated;
grant select, insert, update on public.hub_curriculum to authenticated;
grant select, insert, update on public.equipment to authenticated;

notify pgrst, 'reload schema';
