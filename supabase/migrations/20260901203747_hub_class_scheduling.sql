-- Hub class scheduling and five-week volunteer teaching rotation.

create table if not exists public.hub_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1200),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hub_classes_name_unique
  on public.hub_classes(lower(name));
create index if not exists idx_hub_classes_status on public.hub_classes(status);

create table if not exists public.hub_class_rotation (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.hub_classes(id) on delete cascade,
  volunteer_profile_id uuid not null references public.volunteer_profiles(profile_id) on delete restrict,
  volunteer_name text not null check (char_length(volunteer_name) between 2 and 100),
  rotation_order integer not null check (rotation_order between 1 and 5),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, rotation_order)
);

create unique index if not exists idx_hub_class_rotation_name_unique
  on public.hub_class_rotation(class_id, lower(volunteer_name));
create index if not exists idx_hub_class_rotation_profile
  on public.hub_class_rotation(volunteer_profile_id, class_id);

create table if not exists public.hub_class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.hub_classes(id) on delete restrict,
  event_id uuid not null unique references public.events(id) on delete restrict,
  cycle_start date not null,
  cycle_week integer not null check (cycle_week between 1 and 5),
  time_slot text not null default 'morning' check (time_slot in ('morning', 'afternoon', 'evening', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hub_class_sessions_class_cycle
  on public.hub_class_sessions(class_id, cycle_start, cycle_week);
create index if not exists idx_hub_class_sessions_status
  on public.hub_class_sessions(status, cycle_start);

create table if not exists public.hub_session_assignments (
  session_id uuid primary key references public.hub_class_sessions(id) on delete cascade,
  volunteer_profile_id uuid not null references public.volunteer_profiles(profile_id) on delete restrict,
  volunteer_name text not null check (char_length(volunteer_name) between 2 and 100),
  rotation_id uuid references public.hub_class_rotation(id) on delete set null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  is_override boolean not null default false,
  assigned_at timestamptz not null default now()
);

create index if not exists idx_hub_session_assignments_volunteer
  on public.hub_session_assignments(volunteer_profile_id, session_id);

alter table public.hub_classes enable row level security;
alter table public.hub_class_rotation enable row level security;
alter table public.hub_class_sessions enable row level security;
alter table public.hub_session_assignments enable row level security;

drop policy if exists "hub_classes_read_authenticated" on public.hub_classes;
drop policy if exists "hub_classes_insert_leadership" on public.hub_classes;
drop policy if exists "hub_classes_update_leadership" on public.hub_classes;
create policy "hub_classes_read_authenticated" on public.hub_classes
  for select to authenticated using ((select auth.uid()) is not null);
create policy "hub_classes_insert_leadership" on public.hub_classes
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_classes_update_leadership" on public.hub_classes
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "hub_class_rotation_read" on public.hub_class_rotation;
drop policy if exists "hub_class_rotation_insert_leadership" on public.hub_class_rotation;
drop policy if exists "hub_class_rotation_update_leadership" on public.hub_class_rotation;
create policy "hub_class_rotation_read" on public.hub_class_rotation
  for select to authenticated using (
    volunteer_profile_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_class_rotation_insert_leadership" on public.hub_class_rotation
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_class_rotation_update_leadership" on public.hub_class_rotation
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "hub_class_sessions_read" on public.hub_class_sessions;
drop policy if exists "hub_class_sessions_insert_leadership" on public.hub_class_sessions;
drop policy if exists "hub_class_sessions_update" on public.hub_class_sessions;
create policy "hub_class_sessions_read" on public.hub_class_sessions
  for select to authenticated using (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
    or exists (
      select 1 from public.hub_session_assignments assignment
      where assignment.session_id = public.hub_class_sessions.id
        and assignment.volunteer_profile_id = (select auth.uid())
    )
  );
create policy "hub_class_sessions_insert_leadership" on public.hub_class_sessions
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_class_sessions_update" on public.hub_class_sessions
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "hub_session_assignments_read" on public.hub_session_assignments;
drop policy if exists "hub_session_assignments_insert_leadership" on public.hub_session_assignments;
drop policy if exists "hub_session_assignments_update_leadership" on public.hub_session_assignments;
create policy "hub_session_assignments_read" on public.hub_session_assignments
  for select to authenticated using (
    volunteer_profile_id = (select auth.uid())
    or (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_session_assignments_insert_leadership" on public.hub_session_assignments
  for insert to authenticated with check (
    assigned_by = (select auth.uid())
    and (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );
create policy "hub_session_assignments_update_leadership" on public.hub_session_assignments
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager'));

drop policy if exists "volunteer_hours_insert_leadership" on public.volunteer_hours;
create policy "volunteer_hours_insert_leadership" on public.volunteer_hours
  for insert to authenticated with check (
    (select role from public.profiles where id = (select auth.uid())) in ('admin', 'manager')
  );

create or replace function public.generate_hub_rotation(
  p_class_id uuid,
  p_start_at timestamptz,
  p_duration_minutes integer default 120,
  p_time_slot text default 'morning',
  p_location text default null
)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_class_name text;
  v_rotation_count integer;
  v_rotation public.hub_class_rotation%rowtype;
  v_event_id uuid;
  v_session_id uuid;
  v_start timestamptz;
  v_week integer;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  select role into v_role from public.profiles where id = v_actor;
  if coalesce(v_role, '') not in ('admin', 'manager') then raise exception 'Only leadership can generate a rotation'; end if;
  if p_duration_minutes < 30 or p_duration_minutes > 480 then raise exception 'Duration must be between 30 and 480 minutes'; end if;
  if p_time_slot not in ('morning', 'afternoon', 'evening', 'other') then raise exception 'Invalid time slot'; end if;

  select name into v_class_name from public.hub_classes where id = p_class_id and status = 'active';
  if v_class_name is null then raise exception 'Active class not found'; end if;
  select count(*) into v_rotation_count from public.hub_class_rotation where class_id = p_class_id and active;
  if v_rotation_count = 0 then raise exception 'Add at least one active volunteer to the class rotation'; end if;

  for v_week in 1..5 loop
    select * into v_rotation
    from public.hub_class_rotation
    where class_id = p_class_id and active
    order by rotation_order
    offset ((v_week - 1) % v_rotation_count)
    limit 1;

    v_start := p_start_at + make_interval(weeks => v_week - 1);
    insert into public.events (name, starts_at, ends_at, location, status, created_by)
    values (v_class_name || ' — Week ' || v_week, v_start, v_start + make_interval(mins => p_duration_minutes), nullif(trim(p_location), ''), 'scheduled', v_actor)
    returning id into v_event_id;

    insert into public.hub_class_sessions (class_id, event_id, cycle_start, cycle_week, time_slot, created_by)
    values (p_class_id, v_event_id, date_trunc('week', p_start_at)::date, v_week, p_time_slot, v_actor)
    returning id into v_session_id;

    insert into public.hub_session_assignments (session_id, volunteer_profile_id, volunteer_name, rotation_id, assigned_by)
    values (v_session_id, v_rotation.volunteer_profile_id, v_rotation.volunteer_name, v_rotation.id, v_actor);

    return next v_session_id;
  end loop;
end;
$$;

create or replace function public.complete_hub_class_session(p_session_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_session public.hub_class_sessions%rowtype;
  v_assignment public.hub_session_assignments%rowtype;
  v_event public.events%rowtype;
begin
  if v_actor is null then raise exception 'You must be signed in'; end if;
  select role into v_role from public.profiles where id = v_actor;
  if coalesce(v_role, '') not in ('admin', 'manager') then raise exception 'Only leadership can complete a session'; end if;
  select * into v_session from public.hub_class_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'Session not found'; end if;
  select * into v_assignment from public.hub_session_assignments where session_id = p_session_id;
  select * into v_event from public.events where id = v_session.event_id;

  update public.hub_class_sessions set status = 'completed', updated_at = now() where id = p_session_id;
  update public.events set status = 'completed' where id = v_session.event_id;
  insert into public.volunteer_hours (volunteer_id, event_id, hours, notes)
  values (v_assignment.volunteer_profile_id, v_session.event_id,
    round((extract(epoch from (v_event.ends_at - v_event.starts_at)) / 3600)::numeric, 2),
    'Class session completed by ' || v_assignment.volunteer_name)
  on conflict (volunteer_id, event_id) do nothing;
  return v_session.event_id;
end;
$$;

revoke all on table public.hub_classes from anon;
revoke all on table public.hub_class_rotation from anon;
revoke all on table public.hub_class_sessions from anon;
revoke all on table public.hub_session_assignments from anon;
grant select, insert, update on public.hub_classes to authenticated;
grant select, insert, update on public.hub_class_rotation to authenticated;
grant select, insert, update on public.hub_class_sessions to authenticated;
grant select, insert, update on public.hub_session_assignments to authenticated;
grant execute on function public.generate_hub_rotation(uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.complete_hub_class_session(uuid) to authenticated;

notify pgrst, 'reload schema';
