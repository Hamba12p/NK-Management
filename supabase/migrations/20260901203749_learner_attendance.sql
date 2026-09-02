-- Minimal learner directory, private guardian contact, enrolment, and roll-call.

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learners_name on public.learners(lower(full_name));

create table if not exists public.learner_guardian_contacts (
  learner_id uuid primary key references public.learners(id) on delete cascade,
  guardian_contact text not null check (char_length(guardian_contact) between 5 and 200),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_enrolments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete restrict,
  class_id uuid not null references public.hub_classes(id) on delete restrict,
  enrolled_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, class_id)
);

create index if not exists idx_learner_enrolments_class_status
  on public.learner_enrolments(class_id, status, enrolled_on);

create table if not exists public.learner_attendance (
  session_id uuid not null references public.hub_class_sessions(id) on delete restrict,
  learner_id uuid not null references public.learners(id) on delete restrict,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid not null references public.profiles(id) on delete restrict,
  marked_at timestamptz not null default now(),
  primary key (session_id, learner_id)
);

create index if not exists idx_learner_attendance_learner
  on public.learner_attendance(learner_id, session_id);

alter table public.learners enable row level security;
alter table public.learner_guardian_contacts enable row level security;
alter table public.learner_enrolments enable row level security;
alter table public.learner_attendance enable row level security;

drop policy if exists "learners_read_authorized" on public.learners;
drop policy if exists "learners_insert_leadership" on public.learners;
drop policy if exists "learners_update_leadership" on public.learners;
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
create policy "learners_insert_leadership" on public.learners
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "learners_update_leadership" on public.learners
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "learner_guardian_contacts_read_private" on public.learner_guardian_contacts;
drop policy if exists "learner_guardian_contacts_insert_leadership" on public.learner_guardian_contacts;
drop policy if exists "learner_guardian_contacts_update_leadership" on public.learner_guardian_contacts;
create policy "learner_guardian_contacts_read_private" on public.learner_guardian_contacts
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
  );
create policy "learner_guardian_contacts_insert_leadership" on public.learner_guardian_contacts
  for insert to authenticated with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "learner_guardian_contacts_update_leadership" on public.learner_guardian_contacts
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check (
    updated_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );

drop policy if exists "learner_enrolments_read_authorized" on public.learner_enrolments;
drop policy if exists "learner_enrolments_insert_leadership" on public.learner_enrolments;
drop policy if exists "learner_enrolments_update_leadership" on public.learner_enrolments;
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
create policy "learner_enrolments_insert_leadership" on public.learner_enrolments
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "learner_enrolments_update_leadership" on public.learner_enrolments
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "learner_attendance_read_authorized" on public.learner_attendance;
drop policy if exists "learner_attendance_insert_authorized" on public.learner_attendance;
drop policy if exists "learner_attendance_update_authorized" on public.learner_attendance;
create policy "learner_attendance_read_authorized" on public.learner_attendance
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager', 'dpo')
    or exists (
      select 1 from public.hub_session_assignments assignment
      where assignment.session_id = public.learner_attendance.session_id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
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

create or replace function public.enrol_hub_learner(
  p_full_name text,
  p_class_id uuid,
  p_enrolled_on date default current_date,
  p_guardian_contact text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_learner_id uuid;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  if coalesce((select role from public.profiles where id = v_actor), '') not in ('admin', 'manager') then
    raise exception 'Only leadership can enrol learners';
  end if;
  if char_length(trim(p_full_name)) < 2 then raise exception 'Learner name is required'; end if;
  if not exists (select 1 from public.hub_classes where id = p_class_id and status = 'active') then
    raise exception 'Active class not found';
  end if;

  insert into public.learners (full_name, created_by)
  values (trim(p_full_name), v_actor)
  returning id into v_learner_id;

  insert into public.learner_enrolments (learner_id, class_id, enrolled_on, created_by)
  values (v_learner_id, p_class_id, p_enrolled_on, v_actor);

  if nullif(trim(p_guardian_contact), '') is not null then
    insert into public.learner_guardian_contacts (learner_id, guardian_contact, updated_by)
    values (v_learner_id, trim(p_guardian_contact), v_actor);
  end if;
  return v_learner_id;
end;
$$;

revoke all on table public.learners from anon;
revoke all on table public.learner_guardian_contacts from anon;
revoke all on table public.learner_enrolments from anon;
revoke all on table public.learner_attendance from anon;
grant select, insert, update on public.learners to authenticated;
grant select, insert, update on public.learner_guardian_contacts to authenticated;
grant select, insert, update on public.learner_enrolments to authenticated;
grant select, insert, update on public.learner_attendance to authenticated;
grant execute on function public.enrol_hub_learner(text, uuid, date, text) to authenticated;

notify pgrst, 'reload schema';
